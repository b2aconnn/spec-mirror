# Technical Design Document — 데이터 모델 · API

> [design.md](../design.md)로 돌아가기

## Data Models

### Aggregates

해당 없음 — 설계 규모 작음: 찜은 상태가 없고, 지킬 규칙은 "같은 상품 한 번"(Requirements 1.9)뿐이며 유니크 제약 하나로 지킵니다. `Wish`는 단순 엔티티로 둡니다.

### Value Objects

해당 없음 — 규칙이나 계산이 있는 값이 없습니다. 찜 100개 한도는 개수 비교 한 줄이라 서비스에 둡니다.

### Domain Entities

#### Wish Entity

```kotlin
@Entity
@Table(
    name = "wishes",
    uniqueConstraints = [UniqueConstraint(name = "uk_wishes_member_product", columnNames = ["member_id", "product_id"])],
    indexes = [Index(name = "idx_wishes_member_created", columnList = "member_id, created_at, id")],
)
class Wish(
    @Column(name = "member_id", nullable = false)
    val memberId: Long,

    @Column(name = "product_id", nullable = false)
    val productId: Long,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,              // 담은 일시
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
```

### DTOs (Data Transfer Objects)

#### Wish Response DTO

```kotlin
data class WishResponse(val productId: Long, val wishedAt: Instant)
```

#### Wish View DTO

```kotlin
data class WishView(
    val productId: Long,
    val productName: String?,            // 판매 종료면 null
    val price: Long?,                    // 판매 종료면 null
    val saleStatus: SaleStatus,
    val wishedAt: Instant,
) {
    companion object {
        fun of(wish: Wish, product: CatalogProduct?) = WishView(
            productId = wish.productId,
            productName = product?.name,
            price = product?.price,
            saleStatus = SaleStatus.of(product),
            wishedAt = wish.createdAt,
        )
    }
}
```

### Enums

```kotlin
enum class SaleStatus {
    ON_SALE, NOT_ON_SALE, DISCONTINUED;

    companion object {
        fun of(product: CatalogProduct?) = when {
            product == null -> DISCONTINUED
            product.onSale -> ON_SALE
            else -> NOT_ON_SALE
        }
    }
}
```

### 도메인 용어 ↔ 코드

| 도메인 용어 | 코드 |
|---|---|
| 회원 | `memberId` (`X-Member-Id` 헤더) |
| 상품 | `productId`, `CatalogProduct` |
| 상품 카탈로그 | `ProductCatalog` (주문 기능의 포트) |
| 찜 목록 | `WishlistService.list` 결과 (`List<WishView>`) |
| 찜 | `Wish` |
| 판매 상태 | `SaleStatus` |

### API Endpoints

#### 1. 찜하기

```http
PUT /api/wishlist/items/101
X-Member-Id: 1

HTTP/1.1 201 Created
{ "productId": 101, "wishedAt": "2026-01-15T01:00:00Z" }
```

이미 찜한 상품이면 `200 OK`와 기존 찜을 돌려줍니다.

#### 2. 찜 해제

```http
DELETE /api/wishlist/items/101
X-Member-Id: 1

HTTP/1.1 204 No Content
```

#### 3. 찜 목록 조회

```http
GET /api/wishlist
X-Member-Id: 2

HTTP/1.1 200 OK
{
  "items": [
    { "productId": 103, "productName": "시즌 한정 케이크", "price": 7000, "saleStatus": "NOT_ON_SALE", "wishedAt": "2026-01-15T00:59:00Z" },
    { "productId": 999, "productName": null, "price": null, "saleStatus": "DISCONTINUED", "wishedAt": "2026-01-15T00:58:00Z" },
    { "productId": 101, "productName": "아메리카노", "price": 4500, "saleStatus": "ON_SALE", "wishedAt": "2026-01-15T00:57:00Z" }
  ]
}
```

### Database Schema (MySQL DDL)

```sql
CREATE TABLE wishes (
    id          BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    member_id   BIGINT      NOT NULL,
    product_id  BIGINT      NOT NULL,
    created_at  DATETIME(6) NOT NULL,
    CONSTRAINT uk_wishes_member_product UNIQUE (member_id, product_id),
    INDEX idx_wishes_member_created (member_id, created_at, id)
);
```
