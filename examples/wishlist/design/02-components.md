# Technical Design Document — 컴포넌트와 인터페이스

> [design.md](../design.md)로 돌아가기

## Components and Interfaces

### 1. Wishlist Service

찜하기, 찜 해제, 찜 목록 조회의 흐름 전체를 담당합니다. 상품 카탈로그 호출을 트랜잭션 밖에 두기 위해 클래스에는 `@Transactional`을 붙이지 않고, 저장 · 삭제만 Repository의 트랜잭션을 씁니다.

**역할:** 서비스 — 흐름 전체 (Transaction Script). 규칙이 적어 검증 · 계산을 따로 빼지 않습니다

```kotlin
@Service
class WishlistService(
    private val wishRepository: WishRepository,
    private val productCatalog: ProductCatalog,     // 주문 기능의 포트 그대로
    private val clock: Clock,
) {
    companion object {
        private const val MAX_WISHES = 100
    }

    /**
     * 상품을 찜 목록에 담습니다.
     * 1. 이미 찜한 상품 → 기존 찜 반환 (1.2)
     * 2. 찜 100개 → WISHLIST_FULL (1.3)
     * 3. 상품 카탈로그 조회 (1.4) → 장애면 PRODUCT_CATALOG_UNAVAILABLE (1.5)
     * 4. 없는 상품 → PRODUCT_NOT_FOUND (1.6)
     * 5. 찜 저장 (1.7) → 응답 (1.8)
     */
    fun add(memberId: Long, productId: Long): AddWishResult {
        wishRepository.findByMemberIdAndProductId(memberId, productId)
            ?.let { return AddWishResult.existing(it) }

        if (wishRepository.countByMemberId(memberId) >= MAX_WISHES) {
            throw WishlistException(WishlistErrorCode.WISHLIST_FULL)
        }

        val products = findProducts(listOf(productId))
        if (productId !in products) {
            throw WishlistException(WishlistErrorCode.PRODUCT_NOT_FOUND)
        }

        return try {
            AddWishResult.created(wishRepository.save(Wish(memberId, productId, clock.instant())))
        } catch (e: DataIntegrityViolationException) {
            // 같은 상품을 동시에 담은 요청 중 늦은 쪽 (1.9)
            AddWishResult.existing(wishRepository.findByMemberIdAndProductId(memberId, productId)!!)
        }
    }

    /**
     * 상품을 찜 목록에서 뺍니다. 상품 카탈로그는 조회하지 않습니다 (2.5).
     * 1. 찜 삭제 — 없으면 0건이고 그대로 성공 (2.2, 2.3)
     * 2. 내용 없이 응답 (2.4)
     */
    fun remove(memberId: Long, productId: Long) {
        wishRepository.deleteByMemberIdAndProductId(memberId, productId)
    }

    /**
     * 찜 목록을 보여 줍니다.
     * 1. 회원의 찜을 최근 담은 순으로 읽음 (3.1, 3.6)
     * 2. 비어 있지 않으면 상품 카탈로그 조회 (3.2) → 장애면 PRODUCT_CATALOG_UNAVAILABLE (3.3)
     * 3. 카탈로그에 없는 상품은 판매 종료 (3.4)
     * 4. 응답 (3.5)
     */
    fun list(memberId: Long): List<WishView> {
        val wishes = wishRepository.findAllByMemberIdOrderByCreatedAtDescIdDesc(memberId)
        if (wishes.isEmpty()) return emptyList()

        val products = findProducts(wishes.map { it.productId })
        return wishes.map { WishView.of(it, products[it.productId]) }
    }

    private fun findProducts(ids: List<Long>): Map<Long, CatalogProduct> = try {
        productCatalog.findProducts(ids)
    } catch (e: ProductCatalogUnavailableException) {
        throw WishlistException(WishlistErrorCode.PRODUCT_CATALOG_UNAVAILABLE)
    }
}
```

**구현 책임:**
- 확인 순서는 요구사항 순서 그대로: 기존 찜 → 개수 → 상품 카탈로그 → 없는 상품
- 판매 중이 아닌 상품도 담음 (`onSale`을 보지 않음)
- 찜 해제는 상품 카탈로그를 호출하지 않음
- 판매 상태는 `WishView.of`에서 정함: 카탈로그에 없으면 판매 종료, 있으면 `onSale`에 따라 판매 중 / 판매 중지

### 2. Wish Repository

찜의 저장, 삭제, 회원별 조회입니다.

**역할:** Repository — 프로젝트 관례(Spring Data JPA)대로. 같은 상품 한 번(1.9)을 유니크 제약으로 지킵니다

```kotlin
interface WishRepository : JpaRepository<Wish, Long> {
    fun findByMemberIdAndProductId(memberId: Long, productId: Long): Wish?

    fun countByMemberId(memberId: Long): Long

    /** 최근 담은 순. 담은 일시가 같으면 나중에 저장된 것이 먼저 */
    fun findAllByMemberIdOrderByCreatedAtDescIdDesc(memberId: Long): List<Wish>

    @Transactional
    fun deleteByMemberIdAndProductId(memberId: Long, productId: Long): Long
}
```

**구현 책임:**
- 모든 조회 · 삭제 조건에 `memberId`를 넣어 본인 찜만 다룸 (3.6)
