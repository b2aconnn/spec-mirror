# Technical Design Document — 테스트 전략

> [design.md](../design.md)로 돌아가기

## Testing Strategy

### 테스트 전략 개요

요구사항 하나당 인수 테스트 클래스 하나를 만들고, 기준 하나당 테스트를 하나 이상 작성합니다. 모든 테스트는 HTTP 상태, 에러 코드, **메시지까지** 검증합니다.

#### 1. 인수 테스트 (Acceptance Tests)

**대상:**
- 요구사항의 모든 기준 (Controller → Service → Repository 전체 흐름)

**도구:**
- `@SpringBootTest` + `MockMvc`
- H2 (MySQL 모드)
- `FakePgClient` (기존), `FakeProductCatalog` (신규), 고정 `Clock`

**테스트 클래스:**

| 요구사항 | 테스트 클래스 |
|---|---|
| 1. 주문 접수 | `OrderPlaceAcceptanceTest` |
| 2. 중복 주문 방지 | `OrderIdempotencyAcceptanceTest` |
| 3. 주문 조회 | `OrderQueryAcceptanceTest` |
| 4. 주문 내역 조회 | `OrderHistoryAcceptanceTest` |
| 5. 결제 전 주문 취소 | `OrderCancelAcceptanceTest` |
| 6. 주문 결제 승인 | `OrderPaymentConfirmAcceptanceTest` |
| 7. 결제 결과의 주문 반영 | `OrderPaymentResultAcceptanceTest` |
| 8. 결제 기한 만료 | `OrderExpirationAcceptanceTest` |
| 9. 주문·결제 상태 일관성 | `OrderPaymentConsistencyAcceptanceTest` |

**예시:**

```kotlin
@Test
fun `R1-2 주문 상품은 1개 이상 20개 이하로 담을 수 있다`() {
    placeOrder(items = products201to221.take(21)).andExpect {
        status { isBadRequest() }
        jsonPath("$.code") { value("INVALID_ORDER_ITEM_COUNT") }
        jsonPath("$.message") { value("주문 상품은 1개 이상 20개 이하로 담아주세요.") }
    }
    placeOrder(items = products201to221.take(20)).andExpect { status { isCreated() } }
}
```

#### 2. 동시성 테스트 (Concurrency Tests)

**대상:**
- 같은 키로 동시 주문 → 주문 1건
- 같은 결제에 동시 승인 → PG 승인 1번
- 승인 · 취소 · 만료 동시 실행 → 하나만 반영

**도구:**
- `ExecutorService` + `CountDownLatch`
- `FakePgClient.latencyMillis`로 PG 응답 지연

#### 3. 기존 테스트 이관

- `AC-CNF-*`, `AC-APV-*` → `OrderPaymentConfirmAcceptanceTest`의 `R6-N` 테스트로 이름 변경, 셋업을 주문 접수 기반으로 변경
- `AC-PRE-*` (결제 준비) → 삭제, `R6-26 결제 준비 기능은 없다`로 대체
- `TossPaymentsClientTest`, `PaymentDomainTest`, `PaymentConfigTest`, `PaymentReconcilerTest` → 기존 이름 유지

#### 4. 테스트 기준 데이터

**고정 시각:** `2026-01-15T01:00:00Z` → 결제 기한 `2026-01-15T01:30:00Z`

**회원:** `1` (본인), `2` (다른 회원)

**상품 (FakeProductCatalog):**

| 상품 ID | 상품명 | 판매가 | 판매 여부 | 용도 |
|---|---|---|---|---|
| 101 | 아메리카노 | 4,500 | 판매 중 | 기본 주문 |
| 102 | 카페라떼 | 5,000 | 판매 중 | 기본 주문 |
| 103 | 시즌 한정 케이크 | 7,000 | 판매 중지 | 판매 중이 아닌 상품 |
| 104 | 프리미엄 원두 세트 | 5,000,000 | 판매 중 | 금액 한도 (2개 = 10,000,000원) |
| 105 | 스티커 | 1 | 판매 중 | 금액 한도 (104×2 + 105×1 = 10,000,001원) |
| 201 ~ 221 | 상품 01 ~ 21 | 1,000 | 판매 중 | 상품 개수 (20개 / 21개) |
| 999 | — | — | 없음 | 존재하지 않는 상품 |

**기본 주문:** `Idempotency-Key: idem-0001`, 아메리카노 2 + 카페라떼 1 → 14,000원, "아메리카노 외 1건"

**기본 결제 승인:** `paymentKey = "pk_1"`, `amount = 14000`

#### 5. 주요 테스트 시나리오

**주문 접수:**
- 정상 접수 (주문·주문 항목·결제 함께 생성)
- 상품 개수 / 수량 / 중복 상품 경계값
- 상품 카탈로그 장애, 없는 상품, 판매 중지 상품
- 주문 금액 한도 경계값
- 요청 금액 무시, PG 호출 없음

**중복 주문 방지:**
- 키 없음 / 형식 오류
- 같은 내용 재요청 → 기존 주문, 다른 내용 → 거절
- 24시간 경과 후 키 재사용
- 다른 회원 같은 키, 동시 요청

**결제 승인:**
- 기존 시나리오 전체 (승인 / 거절 / 미도달 / 결과 불명 / 응답 불일치)
- 취소·만료된 주문 결제 거절
- 결제 결과에 따른 주문 상태 변경

**주문 취소 / 기한 만료:**
- 정상 취소·만료, 이미 취소된 주문 재취소
- 결제 진행 중인 주문 취소·만료 불가
- 승인과 동시에 취소·만료
