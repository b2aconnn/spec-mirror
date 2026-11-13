# Technical Design Document — 에러 처리

> [design.md](../design.md)로 돌아가기

## Error Handling

### 에러 처리 전략

#### 1. 예외 처리 방식

**Controller Layer:**
- `WishlistExceptionHandler`가 `WishlistException`을 기존 `ErrorResponse`로 변환
- 요청 형식 오류(헤더 누락, 상품 ID가 숫자가 아님)는 기존 핸들러가 `400 INVALID_REQUEST`로 처리

**Service Layer:**
- 규칙 위반은 `WishlistException`에 에러 코드를 담아 던짐
- 상품 카탈로그의 `ProductCatalogUnavailableException`을 `PRODUCT_CATALOG_UNAVAILABLE`로 바꿈
- 동시 담기로 생긴 유니크 제약 위반은 에러가 아니라 기존 찜 응답으로 바꿈 (1.9)

#### 2. 에러 코드

```kotlin
enum class WishlistErrorCode(val status: HttpStatus, val defaultMessage: String) {
    WISHLIST_FULL(HttpStatus.CONFLICT, "찜 목록은 100개까지 담을 수 있습니다."),
    PRODUCT_CATALOG_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "상품 정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요."),
    PRODUCT_NOT_FOUND(HttpStatus.NOT_FOUND, "상품을 찾을 수 없습니다."),
}

class WishlistException(val errorCode: WishlistErrorCode) : RuntimeException(errorCode.defaultMessage)
```

`PRODUCT_CATALOG_UNAVAILABLE`의 메시지는 주문 기능(`OrderErrorCode`)과 같습니다. `PRODUCT_NOT_FOUND`는 주문과 상태 · 메시지가 다르므로 찜 전용 코드로 둡니다.

#### 3. 예외 핸들러

```kotlin
@RestControllerAdvice(assignableTypes = [WishlistController::class])
class WishlistExceptionHandler {
    @ExceptionHandler(WishlistException::class)
    fun handle(e: WishlistException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(e.errorCode.status).body(ErrorResponse(e.errorCode.name, e.message!!))
}
```

#### 4. 로깅 전략

| 상황 | 레벨 | 형식 |
|---|---|---|
| 상품 카탈로그 장애 | WARN | `[찜] 상품 카탈로그 조회 실패 memberId={회원}` (어댑터의 기존 로그와 별도) |
