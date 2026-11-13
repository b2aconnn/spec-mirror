# Technical Design Document — 에러 처리

> [design.md](../design.md)로 돌아가기

## Error Handling

### 에러 처리 전략

#### 1. 예외 처리 방식

**Controller Layer (요청 검증):**
- 요청만 보고 알 수 있는 기준은 Bean Validation 어노테이션으로 확인
  - 주문 항목 개수 `@NotEmpty` · `@Size(max = 20)` (1.2), 수량 `@Min(1)` · `@Max(99)` (1.3), 중복 상품 `@UniqueProductIds` (1.4)
  - 중복 주문 방지 키 `@NotNull` · `@Pattern` (2.1), 페이지 번호 · 크기 `@Min` (4.2)
- 어노테이션 위반은 `OrderRequestValidationHandler`가 에러 코드로 바꿔 응답. 여러 위반이 겹치면 기준 순서(1.2 → 1.3 → 1.4 → 2.1)상 앞선 하나만 응답
- `OrderExceptionHandler`(신규)와 `PaymentExceptionHandler`(기존)가 비즈니스 예외를 `ErrorResponse`로 변환
- 요청 형식 오류(회원 헤더 누락, JSON 파싱 불가)는 기존 핸들러가 `400 INVALID_REQUEST`로 처리

**Service · Domain Layer (비즈니스 검증):**
- 상품 존재 · 판매 여부 · 금액 한도(`OrderLines`), 중복 주문(`OrderIdempotencyService`), 주문 상태(`OrderStatus`) 같은 규칙 위반은 `OrderException` / `PaymentException`에 에러 코드를 담아 던짐
- 동시성 충돌(조건부 UPDATE 0행)은 정해진 에러 코드로 변환하거나 건너뜀

**Adapter Layer:**
- 상품 카탈로그 장애 → `ProductCatalogUnavailableException`
- PG 실패 → 기존 3분류 (`PgRejectedException` / `PgNotReachedException` / `PgUnknownResultException`)

#### 2. 에러 코드

```kotlin
enum class OrderErrorCode(val status: HttpStatus, val defaultMessage: String) {
    // 주문 접수
    INVALID_ORDER_ITEM_COUNT(HttpStatus.BAD_REQUEST, "주문 상품은 1개 이상 20개 이하로 담아주세요."),
    INVALID_ORDER_QUANTITY(HttpStatus.BAD_REQUEST, "상품별 수량은 1개 이상 99개 이하로 선택해주세요."),
    DUPLICATED_ORDER_ITEM(HttpStatus.BAD_REQUEST, "같은 상품이 중복으로 담겨 있습니다."),
    PRODUCT_CATALOG_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "상품 정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요."),
    PRODUCT_NOT_FOUND(HttpStatus.BAD_REQUEST, "존재하지 않는 상품이 포함되어 있습니다."),          // + " (상품 ID)"
    PRODUCT_NOT_ON_SALE(HttpStatus.CONFLICT, "판매 중이 아닌 상품이 포함되어 있습니다."),         // + " (상품명)"
    ORDER_AMOUNT_LIMIT_EXCEEDED(HttpStatus.BAD_REQUEST, "1회 주문 금액은 10,000,000원을 넘을 수 없습니다."),

    // 중복 주문 방지
    INVALID_IDEMPOTENCY_KEY(HttpStatus.BAD_REQUEST, "중복 주문 방지 키가 올바르지 않습니다."),
    IDEMPOTENCY_KEY_REUSED(HttpStatus.UNPROCESSABLE_ENTITY, "이미 다른 주문에 사용된 중복 주문 방지 키입니다."),

    // 조회 / 취소
    ORDER_NOT_FOUND(HttpStatus.NOT_FOUND, "주문을 찾을 수 없습니다."),
    INVALID_PAGE_REQUEST(HttpStatus.BAD_REQUEST, "페이지 요청이 올바르지 않습니다."),
    ORDER_NOT_CANCELABLE(HttpStatus.CONFLICT, "취소할 수 없는 주문입니다."),                     // + " (현재 상태: 주문 상태)"
}

class OrderException(
    val errorCode: OrderErrorCode,
    detail: String? = null,
) : RuntimeException(detail?.let { "${errorCode.defaultMessage} ($it)" } ?: errorCode.defaultMessage)
```

기존 `PaymentErrorCode`에는 하나를 추가합니다.

```kotlin
ORDER_NOT_PAYABLE(HttpStatus.CONFLICT, "취소되었거나 결제 기한이 지난 주문입니다. 새로 주문해주세요."),
```

`ORDER_NOT_CANCELABLE`의 메시지 예: `취소할 수 없는 주문입니다. (현재 상태: 결제 완료)`

#### 3. 예외 핸들러

```kotlin
@RestControllerAdvice
class OrderExceptionHandler {

    @ExceptionHandler(OrderException::class)
    fun handle(e: OrderException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(e.errorCode.status)
            .body(ErrorResponse(e.errorCode.name, e.message ?: e.errorCode.defaultMessage))
}
```

요청 검증 위반은 따로 받습니다. 어노테이션의 `message`가 에러 코드이고, 여러 개면 기준 순서상 앞선 것 하나를 고릅니다.

```kotlin
@RestControllerAdvice(assignableTypes = [OrderController::class])
class OrderRequestValidationHandler {

    /** requirements 처리 흐름 순서. 여러 위반이 겹치면 이 목록에서 앞선 하나만 응답합니다. */
    private val checkOrder = listOf(
        OrderErrorCode.INVALID_ORDER_ITEM_COUNT,   // 1.2
        OrderErrorCode.INVALID_ORDER_QUANTITY,     // 1.3
        OrderErrorCode.DUPLICATED_ORDER_ITEM,      // 1.4
        OrderErrorCode.INVALID_IDEMPOTENCY_KEY,    // 2.1
        OrderErrorCode.INVALID_PAGE_REQUEST,       // 4.2
    )

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handle(e: MethodArgumentNotValidException) = respond(e.bindingResult.allErrors.mapNotNull { it.defaultMessage })

    @ExceptionHandler(HandlerMethodValidationException::class)
    fun handle(e: HandlerMethodValidationException) = respond(e.allErrors.mapNotNull { it.defaultMessage })

    private fun respond(codes: List<String>): ResponseEntity<ErrorResponse> {
        val errorCode = checkOrder.first { it.name in codes }
        return ResponseEntity.status(errorCode.status)
            .body(ErrorResponse(errorCode.name, errorCode.defaultMessage))
    }
}
```

**주의:** 기존 `PaymentExceptionHandler`는 `DataIntegrityViolationException`을 모두 `DUPLICATED_PAYMENT_KEY`로 바꿉니다. 주문 접수의 중복 키 유니크 위반은 `OrderPlaceService`에서 잡아서 처리하므로 이 핸들러까지 올라가지 않아야 합니다.

#### 4. 로깅 전략

| 상황 | 레벨 | 형식 |
|---|---|---|
| 주문 상태 변경 | INFO | `[주문] orderId={주문번호} memberId={회원} {이전 상태}→{다음 상태} reason={사유}` |
| 결제는 바뀌었는데 주문이 결제 대기가 아님 | ERROR | `[정합성 경보] 주문 상태 불일치 orderId={주문번호} payment={결제 상태} order={주문 상태}` |
| 실패 처리된 결제가 PG에서는 승인됨 | ERROR | `[정합성 경보] PG=DONE 인데 DB=FAILED orderId={주문번호}` (기존) |
| 만료 처리 실패 | ERROR | `[만료] 실패 orderId={주문번호}` |
| PG 응답 불일치 / 보상 취소 실패 / 결과 불명 / 예상 못한 예외 | — | 기존 그대로 |
