# Technical Design Document — 컴포넌트와 인터페이스

> [design.md](../design.md)로 돌아가기

## Components and Interfaces

### 1. Order Place Service

주문 접수의 핵심 흐름을 담당합니다. 상품 카탈로그 호출을 트랜잭션 밖에 두기 위해 이 클래스 자체에는 `@Transactional`을 붙이지 않습니다.

```kotlin
@Service
class OrderPlaceService(
    private val validator: OrderRequestValidator,
    private val idempotencyService: OrderIdempotencyService,
    private val productCatalog: ProductCatalog,
    private val orderWriter: OrderWriter,
    private val clock: Clock,
) {
    /**
     * 주문을 접수합니다.
     * 1. 주문 항목 검증 (개수 → 수량 → 중복 상품)
     * 2. 중복 주문 방지 키 형식 검증
     * 3. 같은 키로 접수된 주문 확인 → 있으면 기존 주문 반환
     * 4. 상품 카탈로그 조회 (트랜잭션 밖)
     * 5. 상품 존재 / 판매 여부 확인, 주문 금액 계산, 한도 확인
     * 6. 주문번호·주문명·결제 기한 결정
     * 7. 주문 + 주문 항목 + 결제 저장 (한 트랜잭션)
     */
    fun place(command: PlaceOrderCommand): PlaceOrderResult {
        validator.validateItems(command.items)
        validator.validateIdempotencyKey(command.idempotencyKey)

        val fingerprint = OrderFingerprint.of(command.items)
        idempotencyService.findExisting(command.memberId, command.idempotencyKey, fingerprint)
            ?.let { return PlaceOrderResult.existing(it) }

        val products = productCatalog.findProducts(command.items.map { it.productId })
        val lines = OrderLines.of(command.items, products)
        val draft = OrderDraft.create(command, lines, fingerprint, clock.instant())

        return try {
            PlaceOrderResult.created(orderWriter.create(draft))
        } catch (e: DataIntegrityViolationException) {
            // 같은 키로 동시에 들어온 요청 중 늦은 쪽: 먼저 접수된 주문을 돌려준다
            idempotencyService.resolveConcurrent(command.memberId, command.idempotencyKey, fingerprint)
        }
    }
}
```

**구현 책임:**
- 검증은 요구사항에 적힌 순서대로 하고, 처음 어긋난 하나만 응답 (Bean Validation `@Valid`는 여러 위반을 한꺼번에 모으므로 쓰지 않음)
- 요청에 금액이 들어 있어도 쓰지 않음 (요청 DTO에 금액 필드 자체가 없음)
- 주문 접수 중에는 PG를 호출하지 않음
- 상품 카탈로그 장애는 `PRODUCT_CATALOG_UNAVAILABLE`로 변환

### 2. Order Request Validator

주문 요청의 항목과 중복 주문 방지 키를 검증합니다.

```kotlin
@Component
class OrderRequestValidator {

    companion object {
        private const val MIN_ITEMS = 1
        private const val MAX_ITEMS = 20
        private const val MIN_QUANTITY = 1
        private const val MAX_QUANTITY = 99
        private val IDEMPOTENCY_KEY_PATTERN = Regex("^[A-Za-z0-9_-]{1,64}$")
    }

    fun validateItems(items: List<OrderItemCommand>?) {
        if (items.isNullOrEmpty() || items.size > MAX_ITEMS) {
            throw OrderException(OrderErrorCode.INVALID_ORDER_ITEM_COUNT)
        }
        if (items.any { it.quantity !in MIN_QUANTITY..MAX_QUANTITY }) {
            throw OrderException(OrderErrorCode.INVALID_ORDER_QUANTITY)
        }
        if (items.map { it.productId }.toSet().size != items.size) {
            throw OrderException(OrderErrorCode.DUPLICATED_ORDER_ITEM)
        }
    }

    fun validateIdempotencyKey(key: String?) {
        if (key == null || !IDEMPOTENCY_KEY_PATTERN.matches(key)) {
            throw OrderException(OrderErrorCode.INVALID_IDEMPOTENCY_KEY)
        }
    }
}
```

### 3. Order Idempotency Service

중복 주문 방지 키로 같은 주문이 두 번 접수되지 않게 합니다.

```kotlin
@Service
class OrderIdempotencyService(
    private val orderRepository: OrderRepository,
    private val clock: Clock,
) {

    companion object {
        private val RETENTION_PERIOD = Duration.ofHours(24)
    }

    /**
     * 같은 회원이 같은 키로 접수한 주문을 찾습니다.
     * - 없음 → null (새로 접수)
     * - 24시간 지남 → 기존 주문에서 키를 떼어내고 null (새로 접수)
     * - 24시간 안 + 같은 주문 내용 → 기존 주문 반환
     * - 24시간 안 + 다른 주문 내용 → IDEMPOTENCY_KEY_REUSED
     */
    @Transactional
    fun findExisting(memberId: Long, key: String, fingerprint: String): Order? {
        val order = orderRepository.findByMemberIdAndIdempotencyKey(memberId, key) ?: return null

        val now = clock.instant()
        if (!now.isBefore(order.createdAt.plus(RETENTION_PERIOD))) {
            orderRepository.detachIdempotencyKey(order.id!!, now)
            return null
        }

        if (order.requestHash != fingerprint) {
            throw OrderException(OrderErrorCode.IDEMPOTENCY_KEY_REUSED)
        }
        return order
    }

    /** 동시 요청으로 유니크 제약에 걸린 경우, 먼저 접수된 주문을 다시 읽어 판단합니다. */
    @Transactional(readOnly = true)
    fun resolveConcurrent(memberId: Long, key: String, fingerprint: String): PlaceOrderResult
}
```

**구현 책임:**
- 키는 회원별로 구분 (`(member_id, idempotency_key)` 유니크 제약)
- 주문 내용이 같은지는 상품·수량 구성으로만 판단, 항목 순서는 무시 (`OrderFingerprint`)
- 같은 키로 동시에 여러 요청이 와도 주문은 하나만 접수 (유니크 제약 + 재조회)

**주문 내용 지문:**

```kotlin
object OrderFingerprint {
    /** 상품 ID 오름차순으로 정렬한 "상품ID:수량" 목록의 SHA-256 */
    fun of(items: List<OrderItemCommand>): String =
        items.sortedBy { it.productId }
            .joinToString(",") { "${it.productId}:${it.quantity}" }
            .sha256Hex()
}
```

### 4. Product Catalog Adapter

상품 정보를 제공하는 외부 시스템과의 연동입니다. 주문 시스템은 조회만 합니다.

```kotlin
interface ProductCatalog {
    /**
     * 상품 정보를 조회합니다.
     * 존재하지 않는 상품은 결과 맵에서 빠집니다.
     * 연결 실패, 타임아웃, 5XX, 파싱 불가 응답이면 ProductCatalogUnavailableException을 던집니다.
     */
    fun findProducts(productIds: Collection<Long>): Map<Long, CatalogProduct>
}

data class CatalogProduct(
    val productId: Long,
    val name: String,
    val price: Long,
    val onSale: Boolean,
)
```

**HTTP 구현:**

```kotlin
@Component
class HttpProductCatalog(
    @Qualifier("catalogRestClient") private val restClient: RestClient,
) : ProductCatalog {

    override fun findProducts(productIds: Collection<Long>): Map<Long, CatalogProduct> = try {
        restClient.get()
            .uri { it.path("/products").queryParam("ids", productIds.joinToString(",")).build() }
            .retrieve()
            .body<List<CatalogProductResponse>>()
            .orEmpty()
            .associate { it.productId to it.toDomain() }
    } catch (e: RestClientException) {
        throw ProductCatalogUnavailableException("상품 카탈로그 조회 실패", e)
    }
}
```

### 5. Order Lines / Order Draft

카탈로그 정보로 주문 항목과 주문 금액을 만들고, 주문번호·주문명·결제 기한을 정합니다.

```kotlin
object OrderLines {

    private const val MAX_ORDER_AMOUNT = 10_000_000L

    /**
     * 1. 존재하지 않는 상품 확인 → PRODUCT_NOT_FOUND
     * 2. 판매 중이 아닌 상품 확인 → PRODUCT_NOT_ON_SALE
     * 3. 항목 금액 = 판매가 × 수량, 주문 금액 = 항목 금액의 합
     * 4. 주문 금액 10,000,000원 초과 → ORDER_AMOUNT_LIMIT_EXCEEDED
     */
    fun of(items: List<OrderItemCommand>, products: Map<Long, CatalogProduct>): OrderLines {
        items.firstOrNull { it.productId !in products }?.let {
            throw OrderException(OrderErrorCode.PRODUCT_NOT_FOUND, it.productId.toString())
        }
        items.map { products.getValue(it.productId) }.firstOrNull { !it.onSale }?.let {
            throw OrderException(OrderErrorCode.PRODUCT_NOT_ON_SALE, it.name)
        }

        val lines = items.map { item ->
            val product = products.getValue(item.productId)
            OrderLine(product.productId, product.name, product.price, item.quantity,
                Math.multiplyExact(product.price, item.quantity.toLong()))
        }
        val totalAmount = lines.sumOf { it.lineAmount }
        if (totalAmount > MAX_ORDER_AMOUNT) {
            throw OrderException(OrderErrorCode.ORDER_AMOUNT_LIMIT_EXCEEDED)
        }
        return OrderLines(lines, totalAmount)
    }
}

object OrderDraft {

    private val PAYMENT_TTL = Duration.ofMinutes(30)

    fun create(command: PlaceOrderCommand, lines: OrderLines, fingerprint: String, now: Instant) = Order(
        orderId = "ORD_" + UlidCreator.getMonotonicUlid(),      // ORD_ + 26자
        memberId = command.memberId,
        totalAmount = lines.totalAmount,
        orderName = orderName(lines),
        requestHash = fingerprint,
        idempotencyKey = command.idempotencyKey,
        expiresAt = now.plus(PAYMENT_TTL),
        createdAt = now,
        items = lines.toOrderItems(),
    )

    /** "아메리카노" 또는 "아메리카노 외 1건" */
    private fun orderName(lines: OrderLines): String {
        val first = lines.first().productName
        return if (lines.size == 1) first else "$first 외 ${lines.size - 1}건"
    }
}
```

### 6. Order Writer

주문, 주문 항목, 결제를 한 트랜잭션에서 저장합니다. 하나라도 실패하면 아무것도 저장되지 않습니다.

```kotlin
@Component
class OrderWriter(
    private val orderRepository: OrderRepository,
    private val paymentRepository: PaymentRepository,
    private val clock: Clock,
) {
    @Transactional
    fun create(order: Order): OrderWithPayment {
        val savedOrder = orderRepository.save(order)                       // 주문 항목은 cascade
        val payment = paymentRepository.save(Payment.forOrder(savedOrder, clock.instant()))
        return OrderWithPayment(savedOrder, payment)
    }
}
```

결제는 `READY`(승인 대기) 상태로, 금액과 결제 기한은 주문과 같은 값으로 만들어집니다.

### 7. Order Query Service

주문 조회와 주문 내역을 담당합니다.

```kotlin
@Service
@Transactional(readOnly = true)
class OrderQueryService(
    private val orderRepository: OrderRepository,
    private val paymentRepository: PaymentRepository,
) {

    companion object {
        private const val MAX_PAGE_SIZE = 50
    }

    /**
     * 주문번호로 본인 주문을 조회합니다.
     * 다른 회원의 주문은 없는 주문과 똑같이 ORDER_NOT_FOUND로 응답합니다.
     */
    fun getOrder(memberId: Long, orderId: String): OrderResponse {
        val order = orderRepository.findByOrderIdAndMemberId(orderId, memberId)
            ?: throw OrderException(OrderErrorCode.ORDER_NOT_FOUND)
        val payment = paymentRepository.findByOrderId(orderId)!!
        return OrderResponse.of(order, payment)
    }

    /**
     * 본인 주문 내역을 최근 주문부터 페이지 단위로 조회합니다.
     * 페이지 크기는 기본 20건, 50건보다 크게 요청하면 50건만 보여줍니다.
     */
    fun getOrders(memberId: Long, page: Int, size: Int): OrderSliceResponse {
        if (page < 0 || size < 1) throw OrderException(OrderErrorCode.INVALID_PAGE_REQUEST)

        val pageable = PageRequest.of(page, minOf(size, MAX_PAGE_SIZE),
            Sort.by(Sort.Direction.DESC, "createdAt", "id"))
        val slice = orderRepository.findByMemberId(memberId, pageable)
        return OrderSliceResponse(slice.content.map(OrderSummaryResponse::of), slice.hasNext())
    }
}
```

**구현 책임:**
- 주문 항목은 주문 시점의 상품명·단가(스냅샷)로 보여주고, 조회 중 상품 카탈로그를 호출하지 않음
- 결제가 진행 중이면 주문은 `PENDING_PAYMENT`, 결제는 실제 상태(`IN_PROGRESS`/`UNKNOWN`) 그대로 보여줌
- 내역은 전체 건수를 세지 않고 다음 페이지 유무만 응답 (`Slice`)

### 8. Order Cancel Service

결제 전 주문의 취소를 담당합니다. PG에는 어떤 요청도 보내지 않습니다 (승인 전이라 환불할 금액이 없음).

```kotlin
@Service
class OrderCancelService(
    private val orderRepository: OrderRepository,
    private val paymentRepository: PaymentRepository,
    private val synchronizer: OrderPaymentSynchronizer,
    private val clock: Clock,
) {
    /**
     * 1. 본인 주문 조회 (없거나 남의 주문 → ORDER_NOT_FOUND)
     * 2. 이미 취소됨 → 현재 주문 그대로 성공 응답
     * 3. 결제 완료 / 결제 실패 / 기한 만료 → ORDER_NOT_CANCELABLE
     * 4. 결제 진행 중(IN_PROGRESS, UNKNOWN) → PAYMENT_IN_PROGRESS
     * 5. 결제 READY → FAILED(ORDER_CANCELED), 그 사이 승인이 시작됐으면 PAYMENT_IN_PROGRESS
     * 6. 주문 PENDING_PAYMENT → CANCELED
     */
    @Transactional
    fun cancel(memberId: Long, orderId: String): OrderResponse {
        val order = orderRepository.findByOrderIdAndMemberId(orderId, memberId)
            ?: throw OrderException(OrderErrorCode.ORDER_NOT_FOUND)
        val payment = paymentRepository.findByOrderId(orderId)!!

        if (order.status == OrderStatus.CANCELED) return OrderResponse.of(order, payment)
        if (order.status != OrderStatus.PENDING_PAYMENT) {
            throw OrderException(OrderErrorCode.ORDER_NOT_CANCELABLE, order.status.displayName)
        }
        if (payment.status in setOf(PaymentStatus.IN_PROGRESS, PaymentStatus.UNKNOWN)) {
            throw PaymentException(PaymentErrorCode.PAYMENT_IN_PROGRESS)
        }

        val updated = paymentRepository.failReady(orderId, "ORDER_CANCELED", "주문 취소", clock.instant())
        if (updated == 0) throw PaymentException(PaymentErrorCode.PAYMENT_IN_PROGRESS)

        synchronizer.changeOrderStatus(order, OrderStatus.CANCELED, reason = "ORDER_CANCELED")
        return OrderResponse.of(orderRepository.findByOrderId(orderId)!!, paymentRepository.findByOrderId(orderId)!!)
    }
}
```

### 9. Payment Confirm Service (변경)

기존 결제 승인 흐름은 그대로 유지하고, 다음만 바뀝니다.

```kotlin
@Service
class PaymentStateService(...) {

    // 삭제: fun prepare(memberId, orderId, amount)  — 결제는 주문 접수 때만 만들어진다

    @Transactional
    fun begin(cmd: ConfirmCommand): BeginResult {
        // ... 결제 없음 / 남의 결제 / 금액 불일치 확인 (기존 그대로)

        when (payment.status) {
            DONE -> { /* 기존 그대로: 같은 결제 키면 기존 결과, 다르면 PAYMENT_KEY_MISMATCH */ }
            IN_PROGRESS, UNKNOWN -> throw PaymentException(PaymentErrorCode.PAYMENT_IN_PROGRESS)
            FAILED -> {
                // 추가: 취소·만료된 주문은 별도 에러
                if (payment.failCode in setOf("ORDER_CANCELED", "ORDER_EXPIRED")) {
                    throw PaymentException(PaymentErrorCode.ORDER_NOT_PAYABLE)
                }
                throw PaymentException(PaymentErrorCode.ALREADY_FAILED)
            }
            READY -> Unit
        }

        // ... 기한 확인, READY → IN_PROGRESS (기존 그대로)
    }

    @Transactional
    fun markDone(pg: PgPayment): PaymentResult {
        val updated = repository.markDone(...)          // 기존 그대로
        if (updated == 1) synchronizer.onPaymentDone(pg.orderId)       // 추가: 주문 결제 완료
        // ... 정합성 경보 (기존 그대로)
    }

    @Transactional
    fun markFailed(orderId: String, code: String, message: String?) {
        val updated = repository.markFailed(...)        // 반환값을 확인하도록 변경
        if (updated == 1) synchronizer.onPaymentFailed(orderId, code)  // 추가: 주문 결제 실패
    }
}
```

**구현 책임:**
- 결제 준비 API(`POST /api/payments/prepare`) 제거 → 404
- 취소·기한 만료된 주문의 결제 승인 요청은 `ORDER_NOT_PAYABLE`, 그 외 실패 결제는 기존대로 `ALREADY_FAILED`
- 결제 결과(승인 완료 / 결제 실패)를 같은 트랜잭션에서 주문에 반영
- 미도달(`READY` 복구), 결과 불명(`UNKNOWN`)은 주문을 바꾸지 않음

### 10. Order Payment Synchronizer

결제 상태가 바뀌는 트랜잭션 **안에서** 주문 상태를 함께 바꿉니다. 혼자서는 트랜잭션을 열지 않습니다.

```kotlin
@Component
class OrderPaymentSynchronizer(
    private val orderRepository: OrderRepository,
    private val clock: Clock,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /** 결제 승인 완료 → 주문 결제 완료 */
    @Transactional(propagation = Propagation.MANDATORY)
    fun onPaymentDone(orderId: String) = change(orderId, OrderStatus.PAID, reason = "PAYMENT_DONE")

    /** 결제 실패 확정 → 주문 결제 실패 */
    @Transactional(propagation = Propagation.MANDATORY)
    fun onPaymentFailed(orderId: String, failCode: String) = change(orderId, OrderStatus.PAYMENT_FAILED, reason = failCode)

    /** 주문 취소·기한 만료처럼 주문 쪽에서 시작하는 변경 */
    @Transactional(propagation = Propagation.MANDATORY)
    fun changeOrderStatus(order: Order, to: OrderStatus, reason: String) = change(order.orderId, to, reason)

    private fun change(orderId: String, to: OrderStatus, reason: String) {
        val order = orderRepository.findByOrderId(orderId)!!
        val updated = orderRepository.changeStatusFromPending(orderId, to, clock.instant())
        if (updated == 0) {
            // 결제는 바뀌었는데 주문은 이미 결제 대기가 아님 → 결제 변경은 그대로 두고 경보
            log.error("[정합성 경보] 주문 상태 불일치 orderId={} payment={} order={}", orderId, to, order.status)
            return
        }
        log.info("[주문] orderId={} memberId={} {}→{} reason={}", orderId, order.memberId, order.status, to, reason)
    }
}
```

**구현 책임:**
- 승인 응답, 즉시 조회, 대사 — 어느 경로로 결제가 확정되든 같은 방식으로 주문에 반영
- 주문 상태가 바뀔 때마다 INFO 로그
- 종결된 주문(결제 완료·결제 실패·취소·만료)의 상태는 다시 바꾸지 않음

### 11. Order Expiration Scheduler

결제 기한이 지난 주문을 1분마다 만료 처리합니다.

```kotlin
@Component
class OrderExpirationScheduler(
    private val orderRepository: OrderRepository,
    private val expirer: OrderExpirer,
    private val clock: Clock,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        private const val BATCH_SIZE = 100
    }

    /**
     * 대상: 주문 PENDING_PAYMENT + 결제 READY + 결제 기한 ≤ 현재 시각
     * 결제 기한이 오래된 순으로 최대 100건, 한 건이 실패해도 나머지는 계속 처리
     */
    @Scheduled(fixedDelayString = "\${order.expiration.fixed-delay:60000}")
    fun expireOverdueOrders() {
        val targets = orderRepository.findExpirable(clock.instant(), PageRequest.of(0, BATCH_SIZE))
        targets.forEach { orderId ->
            runCatching { expirer.expire(orderId) }
                .onFailure { log.error("[만료] 실패 orderId={}", orderId, it) }
        }
    }
}

@Component
class OrderExpirer(
    private val orderRepository: OrderRepository,
    private val paymentRepository: PaymentRepository,
    private val synchronizer: OrderPaymentSynchronizer,
    private val clock: Clock,
) {
    /** 결제 READY → FAILED(ORDER_EXPIRED) 성공 시에만 주문 → EXPIRED. 그 사이 승인이 시작됐으면 건너뜀 */
    @Transactional
    fun expire(orderId: String) {
        val updated = paymentRepository.failReadyExpired(orderId, "ORDER_EXPIRED", "결제 기한 만료", clock.instant())
        if (updated == 0) return
        synchronizer.changeOrderStatus(orderRepository.findByOrderId(orderId)!!, OrderStatus.EXPIRED, reason = "ORDER_EXPIRED")
    }
}
```

**구현 책임:**
- 결제가 진행 중(`IN_PROGRESS`, `UNKNOWN`)인 주문은 기한이 지나도 만료하지 않음 — 돈이 나갔을 수 있으므로 대사로 확정
- 여러 서버에서 동시에 돌아도 결제 조건부 UPDATE를 한 번만 통과하므로 주문은 한 번만 만료
