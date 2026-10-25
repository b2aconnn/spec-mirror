# Technical Design Document — 데이터 모델 · API

> [design.md](../design.md)로 돌아가기

## Data Models

### Domain Entities

#### Order Entity

```kotlin
@Entity
@Table(
    name = "orders",
    uniqueConstraints = [
        UniqueConstraint(name = "uk_orders_order_id", columnNames = ["order_id"]),
        UniqueConstraint(name = "uk_orders_member_idempotency", columnNames = ["member_id", "idempotency_key"]),
    ],
    indexes = [
        Index(name = "idx_orders_member_created", columnList = "member_id, created_at, id"),
        Index(name = "idx_orders_status_expires", columnList = "status, expires_at"),
    ]
)
class Order(
    @Column(name = "order_id", nullable = false, length = 30)
    val orderId: String,                 // ORD_ + ULID 26자

    @Column(name = "member_id", nullable = false)
    val memberId: Long,

    @Column(name = "total_amount", nullable = false)
    val totalAmount: Long,               // 접수 후 바뀌지 않음

    @Column(name = "order_name", nullable = false, length = 255)
    val orderName: String,

    @Column(name = "request_hash", nullable = false, length = 64)
    val requestHash: String,             // 주문 내용 지문

    @Column(name = "expires_at", nullable = false)
    val expiresAt: Instant,              // 접수 시각 + 30분

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = createdAt,

    idempotencyKey: String?,

    @OneToMany(cascade = [CascadeType.PERSIST])
    @JoinColumn(name = "order_pk", nullable = false)
    @OrderColumn(name = "line_no")
    val items: List<OrderItem>,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    /** 상태 변경은 Repository 조건부 UPDATE로만 한다 (Payment와 같은 규칙) */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: OrderStatus = OrderStatus.PENDING_PAYMENT
        protected set

    /** 24시간이 지나 다른 주문에서 키를 다시 쓰면 NULL로 떼어낸다 */
    @Column(name = "idempotency_key", length = 64)
    var idempotencyKey: String? = idempotencyKey
        protected set
}
```

#### Order Item Entity

```kotlin
@Entity
@Table(
    name = "order_items",
    uniqueConstraints = [UniqueConstraint(name = "uk_order_items_product", columnNames = ["order_pk", "product_id"])]
)
class OrderItem(
    @Column(name = "product_id", nullable = false)
    val productId: Long,

    @Column(name = "product_name", nullable = false, length = 255)
    val productName: String,             // 주문 시점 상품명 (스냅샷)

    @Column(name = "unit_price", nullable = false)
    val unitPrice: Long,                 // 주문 시점 판매가 (스냅샷)

    @Column(nullable = false)
    val quantity: Int,

    @Column(name = "line_amount", nullable = false)
    val lineAmount: Long,                // 판매가 × 수량
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
```

#### Payment Entity (변경)

필드는 그대로이고, 주문 접수 때 결제를 만드는 팩토리만 추가합니다.

```kotlin
class Payment(...) {
    companion object {
        /** 금액·결제 기한은 주문과 같은 값, 상태는 READY */
        fun forOrder(order: Order, now: Instant) =
            Payment(order.orderId, order.memberId, order.totalAmount, order.expiresAt, now)
    }
}
```

### Repositories

```kotlin
interface OrderRepository : JpaRepository<Order, Long> {
    fun findByOrderId(orderId: String): Order?
    fun findByOrderIdAndMemberId(orderId: String, memberId: Long): Order?
    fun findByMemberIdAndIdempotencyKey(memberId: Long, idempotencyKey: String): Order?
    fun findByMemberId(memberId: Long, pageable: Pageable): Slice<Order>

    /** 주문 상태 변경: 결제 대기일 때만. 0이면 이미 종결된 주문 */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
        update Order o set o.status = :to, o.updatedAt = :now
         where o.orderId = :orderId and o.status = 'PENDING_PAYMENT'
    """)
    fun changeStatusFromPending(orderId: String, to: OrderStatus, now: Instant): Int

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Order o set o.idempotencyKey = null, o.updatedAt = :now where o.id = :id")
    fun detachIdempotencyKey(id: Long, now: Instant): Int

    /** 만료 대상: 결제 대기 + 결제 READY + 기한 지남, 기한 오래된 순 */
    @Query("""
        select o.orderId from Order o, Payment p
         where p.orderId = o.orderId
           and o.status = 'PENDING_PAYMENT' and p.status = 'READY'
           and o.expiresAt <= :now
         order by o.expiresAt asc
    """)
    fun findExpirable(now: Instant, pageable: Pageable): List<String>
}

interface PaymentRepository : JpaRepository<Payment, Long> {
    // 기존 메서드 유지

    /** 주문 취소: READY일 때만 FAILED */
    fun failReady(orderId: String, code: String, message: String, now: Instant): Int

    /** 기한 만료: READY이고 결제 기한 ≤ now일 때만 FAILED */
    fun failReadyExpired(orderId: String, code: String, message: String, now: Instant): Int
}
```

### DTOs (Data Transfer Objects)

#### Place Order Request DTO

```kotlin
data class PlaceOrderRequest(
    val items: List<OrderItemRequest>? = null,   // 금액 필드 없음
)

data class OrderItemRequest(
    val productId: Long,
    val quantity: Int,
)
```

#### Order Response DTO

주문 접수, 주문 조회, 주문 취소 응답에 함께 씁니다.

```kotlin
data class OrderResponse(
    val orderId: String,
    val status: OrderStatus,
    val totalAmount: Long,
    val orderName: String,
    val items: List<OrderItemResponse>,
    val orderedAt: Instant,
    val expiresAt: Instant,
    val payment: OrderPaymentResponse,
)

data class OrderItemResponse(
    val productId: Long,
    val productName: String,
    val unitPrice: Long,
    val quantity: Int,
    val lineAmount: Long,
)

data class OrderPaymentResponse(
    val status: PaymentStatus,
    val method: String?,
    val approvedAt: Instant?,
    val failCode: String?,
)
```

#### Order List Response DTO

```kotlin
data class OrderSliceResponse(
    val orders: List<OrderSummaryResponse>,
    val hasNext: Boolean,
)

data class OrderSummaryResponse(
    val orderId: String,
    val status: OrderStatus,
    val totalAmount: Long,
    val orderName: String,
    val orderedAt: Instant,
)
```

#### Error Response DTO (기존)

```kotlin
data class ErrorResponse(
    val code: String,
    val message: String,
    val pgCode: String? = null,
)
```

### Enums

```kotlin
enum class OrderStatus(val displayName: String) {
    PENDING_PAYMENT("결제 대기"),
    PAID("결제 완료"),
    PAYMENT_FAILED("결제 실패"),
    CANCELED("주문 취소"),
    EXPIRED("기한 만료");

    /** 결제 대기 외에는 모두 종결 상태 */
    val isTerminal: Boolean get() = this != PENDING_PAYMENT
}

// 기존 그대로
enum class PaymentStatus {
    READY, IN_PROGRESS, UNKNOWN, DONE, FAILED
}
```

**주문 상태 전이:**

```
PENDING_PAYMENT ──(결제 승인 완료)──▶ PAID
       ├──────────(결제 실패 확정)──▶ PAYMENT_FAILED
       ├──────────(회원 취소)──────▶ CANCELED
       └──────────(결제 기한 만료)──▶ EXPIRED
```

**주문 상태와 결제 상태의 짝:**

| 결제 상태 | 주문 상태 |
|---|---|
| READY, IN_PROGRESS, UNKNOWN | PENDING_PAYMENT |
| DONE | PAID |
| FAILED | PAYMENT_FAILED, CANCELED, EXPIRED 중 하나 |

### 도메인 용어 ↔ 코드

| 도메인 용어 | 코드 |
|---|---|
| 회원 | `memberId` (`X-Member-Id` 헤더) |
| 상품 카탈로그 | `ProductCatalog`, `HttpProductCatalog` |
| 주문 / 주문 항목 | `Order` / `OrderItem` |
| 주문번호 | `Order.orderId` (= `Payment.orderId` = PG orderId) |
| 주문 금액 | `Order.totalAmount` (= `Payment.amount`) |
| 결제 기한 | `Order.expiresAt` (= `Payment.expiresAt`) |
| 결제 실패 사유 | `Payment.failCode` |
| 중복 주문 방지 키 | `Idempotency-Key` 헤더 → `Order.idempotencyKey` |
| 대사 | `PaymentReconciler` |

### API Endpoints

#### 1. 주문 접수

```
POST /api/orders
X-Member-Id: 1
Idempotency-Key: idem-0001
Content-Type: application/json

Request:
{
  "items": [
    { "productId": 101, "quantity": 2 },
    { "productId": 102, "quantity": 1 }
  ]
}

Response (201 Created — 새로 접수 / 200 OK — 같은 키·같은 내용 재요청):
{
  "orderId": "ORD_01JHQ4Z8K3M5N7P9R1S3T5V7X9",
  "status": "PENDING_PAYMENT",
  "totalAmount": 14000,
  "orderName": "아메리카노 외 1건",
  "items": [
    { "productId": 101, "productName": "아메리카노", "unitPrice": 4500, "quantity": 2, "lineAmount": 9000 },
    { "productId": 102, "productName": "카페라떼", "unitPrice": 5000, "quantity": 1, "lineAmount": 5000 }
  ],
  "orderedAt": "2026-01-15T01:00:00Z",
  "expiresAt": "2026-01-15T01:30:00Z",
  "payment": { "status": "READY", "method": null, "approvedAt": null, "failCode": null }
}
```

#### 2. 주문 조회

```
GET /api/orders/{orderId}
X-Member-Id: 1

Response (200 OK):
{
  "orderId": "ORD_01JHQ4Z8K3M5N7P9R1S3T5V7X9",
  "status": "PAID",
  "totalAmount": 14000,
  "orderName": "아메리카노 외 1건",
  "items": [ ... ],
  "orderedAt": "2026-01-15T01:00:00Z",
  "expiresAt": "2026-01-15T01:30:00Z",
  "payment": { "status": "DONE", "method": "카드", "approvedAt": "2026-01-15T01:05:00Z", "failCode": null }
}
```

#### 3. 주문 내역 조회

```
GET /api/orders?page=0&size=20
X-Member-Id: 1

Response (200 OK):
{
  "orders": [
    {
      "orderId": "ORD_01JHQ4Z8K3M5N7P9R1S3T5V7X9",
      "status": "PAID",
      "totalAmount": 14000,
      "orderName": "아메리카노 외 1건",
      "orderedAt": "2026-01-15T01:00:00Z"
    }
  ],
  "hasNext": false
}
```

#### 4. 결제 전 주문 취소

```
POST /api/orders/{orderId}/cancel
X-Member-Id: 1

Response (200 OK):
{
  "orderId": "ORD_01JHQ4Z8K3M5N7P9R1S3T5V7X9",
  "status": "CANCELED",
  ...
  "payment": { "status": "FAILED", "method": null, "approvedAt": null, "failCode": "ORDER_CANCELED" }
}
```

#### 5. 결제 승인 (기존)

```
POST /api/payments/confirm
X-Member-Id: 1
Content-Type: application/json

Request:
{
  "paymentKey": "pk_1",
  "orderId": "ORD_01JHQ4Z8K3M5N7P9R1S3T5V7X9",
  "amount": 14000
}

Response (200 OK):
{
  "orderId": "ORD_01JHQ4Z8K3M5N7P9R1S3T5V7X9",
  "paymentKey": "pk_1",
  "status": "DONE",
  "amount": 14000,
  "method": "카드",
  "approvedAt": "2026-01-15T01:05:00Z",
  "failCode": null,
  "failMessage": null
}
```

#### 6. 결제 준비 (제거)

```
POST /api/payments/prepare

Response (404 Not Found)
```

### Database Schema (MySQL DDL)

```sql
CREATE TABLE orders (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id         VARCHAR(30)  NOT NULL,
  member_id        BIGINT       NOT NULL,
  status           VARCHAR(20)  NOT NULL,
  total_amount     BIGINT       NOT NULL,
  order_name       VARCHAR(255) NOT NULL,
  idempotency_key  VARCHAR(64)  NULL,
  request_hash     CHAR(64)     NOT NULL,
  expires_at       DATETIME(6)  NOT NULL,
  created_at       DATETIME(6)  NOT NULL,
  updated_at       DATETIME(6)  NOT NULL,
  CONSTRAINT uk_orders_order_id           UNIQUE (order_id),
  CONSTRAINT uk_orders_member_idempotency UNIQUE (member_id, idempotency_key),
  INDEX idx_orders_member_created (member_id, created_at, id),
  INDEX idx_orders_status_expires (status, expires_at)
);

CREATE TABLE order_items (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_pk      BIGINT       NOT NULL,
  line_no       INT          NOT NULL,
  product_id    BIGINT       NOT NULL,
  product_name  VARCHAR(255) NOT NULL,
  unit_price    BIGINT       NOT NULL,
  quantity      INT          NOT NULL,
  line_amount   BIGINT       NOT NULL,
  CONSTRAINT fk_order_items_order   FOREIGN KEY (order_pk) REFERENCES orders (id),
  CONSTRAINT uk_order_items_product UNIQUE (order_pk, product_id)
);

-- payments 테이블은 변경 없음 (README.md 참고)
```
