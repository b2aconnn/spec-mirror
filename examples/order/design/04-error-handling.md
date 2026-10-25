# Technical Design Document — 에러 처리

> [design.md](../design.md)로 돌아가기

## Error Handling

### 에러 처리 전략

#### 1. 계층별 예외 처리

**Controller Layer:**
- `OrderExceptionHandler`(신규)와 `PaymentExceptionHandler`(기존)가 예외를 `ErrorResponse`로 변환
- 요청 형식 오류(헤더 누락, JSON 파싱 불가)는 기존 핸들러가 `400 INVALID_REQUEST`로 처리

**Service Layer:**
- 비즈니스 규칙 위반은 `OrderException` / `PaymentException`에 에러 코드를 담아 던짐
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

**주의:** 기존 `PaymentExceptionHandler`는 `DataIntegrityViolationException`을 모두 `DUPLICATED_PAYMENT_KEY`로 바꿉니다. 주문 접수의 중복 키 유니크 위반은 `OrderPlaceService`에서 잡아서 처리하므로 이 핸들러까지 올라가지 않아야 합니다.

#### 4. 로깅 전략

| 상황 | 레벨 | 형식 |
|---|---|---|
| 주문 상태 변경 | INFO | `[주문] orderId={주문번호} memberId={회원} {이전 상태}→{다음 상태} reason={사유}` |
| 결제는 바뀌었는데 주문이 결제 대기가 아님 | ERROR | `[정합성 경보] 주문 상태 불일치 orderId={주문번호} payment={결제 상태} order={주문 상태}` |
| 실패 처리된 결제가 PG에서는 승인됨 | ERROR | `[정합성 경보] PG=DONE 인데 DB=FAILED orderId={주문번호}` (기존) |
| 만료 처리 실패 | ERROR | `[만료] 실패 orderId={주문번호}` |
| PG 응답 불일치 / 보상 취소 실패 / 결과 불명 / 예상 못한 예외 | — | 기존 그대로 |
