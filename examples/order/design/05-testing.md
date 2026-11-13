# Technical Design Document — 테스트 전략

> [design.md](../design.md)로 돌아가기

## Testing Strategy

### 테스트 전략 개요

기준은 그 판단을 하는 계층의 테스트가 맡습니다. 도메인은 유닛, Application Service는 통합, Controller는 E2E로 테스트합니다. 모든 테스트는 BDD 시나리오(given / when / then)이고, 이름은 `R{N}-{M} <상황>이면 <결과>다`, 이름과 시나리오는 도메인 용어로 정책을 씁니다.

이 기능은 기존 결제 구조를 따라 상태 전이를 Repository 조건부 UPDATE로 하므로([Aggregates](03-data-models.md)), 상태에 따른 판단 대부분을 통합 테스트가 맡습니다. 유닛 테스트는 금액 계산 · 주문 초안 · 주문 내용 지문처럼 저장소 없이 판단하는 Value Object와 Factory가 맡습니다.

#### 1. 테스트 계층

| 계층 | 대상 | 실제로 도는 것 | 바꾸는 것 | 테스트 묶음 |
|---|---|---|---|---|
| 유닛 | `OrderLines`, `OrderDraft`, `OrderFingerprint` | 도메인 객체만 | 없음 (시각은 인자) | `OrderLinesTest`, `OrderDraftTest`, `OrderFingerprintTest` |
| 통합 | Order Place · Idempotency · Query · Cancel Service, Payment Confirm Service, Order Payment Synchronizer, Order Expirer | Service ~ H2 (MySQL 모드) | `FakePgClient`, `FakeProductCatalog`, 고정 `Clock` | `OrderPlaceIntegrationTest`, `OrderIdempotencyIntegrationTest`, `OrderQueryIntegrationTest`, `OrderCancelIntegrationTest`, `PaymentConfirmIntegrationTest`, `OrderPaymentResultIntegrationTest`, `OrderExpirationIntegrationTest`, `OrderPaymentConsistencyIntegrationTest` |
| E2E | Order Controller, 결제 API | HTTP 요청 ~ H2 | `FakePgClient`, `FakeProductCatalog`, 고정 `Clock` | `OrderE2ETest`, `OrderPaymentE2ETest` |

**도구:** JUnit 5 + AssertJ, 통합은 `@SpringBootTest`, E2E는 `@SpringBootTest` + `MockMvc`. 결과가 같은 경계값 · 조건은 `@ParameterizedTest`로 묶습니다.

#### 2. 기준 ↔ 테스트 계층

| 기준 | 판단 위치 | 테스트 계층 | 테스트 묶음 |
|---|---|---|---|
| 1.1, 1.14, 1.15 | Order Controller `place`, `PlaceOrderRequest` | E2E | `OrderE2ETest` |
| 1.2 ~ 1.4 | `PlaceOrderRequest` 어노테이션 | E2E | `OrderE2ETest` |
| 1.5, 1.6 | Order Place Service `place`, `HttpProductCatalog` | 통합 | `OrderPlaceIntegrationTest` |
| 1.7 ~ 1.10 | `OrderLines.of` | 유닛 | `OrderLinesTest` |
| 1.11, 1.12 | `OrderDraft.create` | 유닛 | `OrderDraftTest` |
| 1.13, 1.16, 1.17 | Order Place Service `place`, Order Writer `create` | 통합 | `OrderPlaceIntegrationTest` |
| 2.1 | Order Controller `Idempotency-Key` 어노테이션 | E2E | `OrderE2ETest` |
| 2.2 ~ 2.5 | Order Idempotency Service `findExisting` | 통합 | `OrderIdempotencyIntegrationTest` |
| 2.6 | `OrderFingerprint.of` | 유닛 | `OrderFingerprintTest` |
| 2.7, 2.8 | 유니크 제약 `uk_orders_member_idempotency`, `resolveConcurrent` | 통합 | `OrderIdempotencyIntegrationTest` |
| 3.1 | Order Controller `getOrder` | E2E | `OrderE2ETest` |
| 3.2 ~ 3.5 | Order Query Service `getOrder` | 통합 | `OrderQueryIntegrationTest` |
| 4.1, 4.2 | Order Controller `getOrders` | E2E | `OrderE2ETest` |
| 4.3 ~ 4.5 | Order Query Service `getOrders` | 통합 | `OrderQueryIntegrationTest` |
| 5.1, 5.8 | Order Controller `cancel` | E2E | `OrderE2ETest` |
| 5.2 ~ 5.7, 5.9 | Order Cancel Service `cancel` | 통합 | `OrderCancelIntegrationTest` |
| 6.1, 6.2, 6.26 | 결제 API (기존) | E2E | `OrderPaymentE2ETest` |
| 6.3 ~ 6.14 | Payment Confirm Service `begin` | 통합 | `PaymentConfirmIntegrationTest` |
| 6.15 ~ 6.25 | Payment Confirm Service (기존 승인 흐름), `markDone`, `markFailed` | 통합 | `PaymentConfirmIntegrationTest` |
| 7.1 ~ 7.7 | Order Payment Synchronizer | 통합 | `OrderPaymentResultIntegrationTest` |
| 8.1 ~ 8.7 | Order Expiration Scheduler, Order Expirer | 통합 | `OrderExpirationIntegrationTest` |
| 9.1 ~ 9.5 | Order Payment Synchronizer, 조건부 UPDATE | 통합 | `OrderPaymentConsistencyIntegrationTest` |

#### 3. 에러 ↔ E2E 시나리오

유닛 · 통합은 거절을 예외(종류 · 에러 코드 · 메시지)로 확인하고, 응답 코드는 아래 E2E 시나리오가 확인합니다.

| 에러 코드 | 응답 | E2E 시나리오 |
|---|---|---|
| `INVALID_ORDER_ITEM_COUNT` | `400` | `R1-2b 주문 상품이 없거나 20개를 넘으면 주문할 수 없다` |
| `INVALID_ORDER_QUANTITY` | `400` | `R1-3b 상품별 수량이 1개보다 적거나 99개를 넘으면 주문할 수 없다` |
| `DUPLICATED_ORDER_ITEM` | `400` | `R1-4 같은 상품을 두 번 담으면 주문할 수 없다` |
| `PRODUCT_CATALOG_UNAVAILABLE` | `503` | `R1-6 상품 정보를 확인할 수 없으면 잠시 후 다시 주문하라고 안내받는다` |
| `PRODUCT_NOT_FOUND` | `400` | `R1-7 없는 상품을 주문하면 주문할 수 없다고 안내받는다` |
| `PRODUCT_NOT_ON_SALE` | `409` | `R1-8 판매 중이 아닌 상품을 주문하면 주문할 수 없다고 안내받는다` |
| `ORDER_AMOUNT_LIMIT_EXCEEDED` | `400` | `R1-10 주문 금액이 10,000,000원을 넘으면 주문할 수 없다고 안내받는다` |
| `INVALID_IDEMPOTENCY_KEY` | `400` | `R2-1 중복 주문 방지 키가 없거나 형식이 틀리면 주문할 수 없다` |
| `IDEMPOTENCY_KEY_REUSED` | `422` | `R2-5 24시간 안에 같은 키로 다른 주문을 하면 주문할 수 없다고 안내받는다` |
| `ORDER_NOT_FOUND` | `404` | `R3-2 다른 회원의 주문을 보려고 하면 주문을 찾을 수 없다고 안내받는다` |
| `INVALID_PAGE_REQUEST` | `400` | `R4-2 페이지 번호가 0보다 작거나 페이지 크기가 1보다 작으면 주문 내역을 볼 수 없다` |
| `ORDER_NOT_CANCELABLE` | `409` | `R5-4 결제가 끝난 주문을 취소하면 취소할 수 없다고 안내받는다` |
| `INVALID_REQUEST` | `400` | `R6-2 결제 정보가 빠졌거나 형식이 틀리면 결제할 수 없다` |
| `PAYMENT_NOT_FOUND` | `404` | `R6-3 없는 결제를 승인하려고 하면 결제 정보를 찾을 수 없다고 안내받는다` |
| `FORBIDDEN_PAYMENT` | `403` | `R6-4 다른 회원의 결제를 승인하려고 하면 본인의 결제가 아니라고 안내받는다` |
| `AMOUNT_MISMATCH` | `400` | `R6-5 주문 금액과 다른 금액으로 결제하면 결제할 수 없다고 안내받는다` |
| `PAYMENT_KEY_MISMATCH` | `409` | `R6-7 이미 승인된 주문을 다른 결제 키로 결제하면 결제할 수 없다고 안내받는다` |
| `PAYMENT_IN_PROGRESS` | `409` | `R6-8 결제가 진행 중인 주문을 다시 결제하면 처리 중이라고 안내받는다` |
| `ORDER_NOT_PAYABLE` | `409` | `R6-9 취소된 주문을 결제하면 새로 주문하라고 안내받는다` |
| `ALREADY_FAILED` | `409` | `R6-10 결제에 실패한 주문을 다시 결제하면 결제할 수 없다고 안내받는다` |
| `PAYMENT_EXPIRED` | `400` | `R6-11b 결제 기한이 되면 결제할 수 없다고 안내받는다` |
| `DUPLICATED_PAYMENT_KEY` | `409` | `R6-14 다른 주문에 쓰인 결제 키로 결제하면 결제할 수 없다고 안내받는다` |
| `PG_RESPONSE_MISMATCH` | `502` | `R6-18 결제사가 주문과 다른 내용으로 승인하면 결제를 취소했다고 안내받는다` |
| `PG_REJECTED` | `400` | `R6-19 결제사가 승인을 거절하면 거절 사유를 안내받는다` |
| `PG_UNAVAILABLE` | `503` | `R6-20 결제사와 연결되지 않으면 잠시 후 다시 결제하라고 안내받는다` |
| `PAYMENT_RESULT_UNKNOWN` | `202` | `R6-22 결제사 결과를 다시 조회해도 알 수 없으면 결제 결과를 확인 중이라고 안내받는다` |

#### 4. 테스트 지원 코드

시나리오는 아래 도우미만 부르고, 응답 코드 · 에러 코드 · 메시지 · 상태 값 · 호출 횟수 · 로그 확인은 도우미 안에서 합니다.

| 이름 | 하는 일 |
|---|---|
| `기본_주문이_접수되어_있다(회원)` | 기본 주문(아메리카노 2 + 카페라떼 1, 14,000원)을 저장소에 만듦 (통합) |
| `회원(n).주문한다(…)` · `결제한다(…)` · `주문을_본다(…)` · `취소한다(…)` | 실제 API 호출 (E2E) |
| `결제사.주문과_같은_내용으로_승인한다(주문)` · `주문과_다르게_승인한다(주문, 내용)` · `거절한다(…)` · `연결되지_않는다()` · `응답하지_않는다()` | `FakePgClient` 응답을 정함 |
| `결제사.결제는_한_번만_이루어진다()` · `결제는_이루어지지_않는다()` · `승인이_취소된다(주문)` | `FakePgClient` 호출 횟수 확인 |
| `상품_카탈로그.확인할_수_없다()` · `판매가를_바꾼다(…)` | `FakeProductCatalog` 응답을 정함 |
| `시간이_지난다(…)` · `결제_기한_기준으로_이동한다(주문, 시점)` | 고정 `Clock` 이동 |
| `거절된다(사유) { … }` | 유닛 · 통합: 예외 종류 · 에러 코드 · 메시지 확인 |
| `결과.안내받는다(안내)` | E2E: 응답 코드 · 에러 코드 · 메시지 확인 |
| `주문.결제_완료가_된다()` · `결제_실패가_된다(사유)` · `결제_대기_그대로다()` · `취소된다()` · `만료된다()` | 저장된 주문 · 결제 상태 확인 |
| `운영_기록.정합성_경보가_남는다(주문)` · `결제사_응답_불일치가_남는다(주문, 내용)` | 로그 확인 |
| `주문_거절_사유` · `결제_거절_사유` · `주문_안내` · `결제_안내` | [에러 코드](04-error-handling.md)와 1:1인 에러 코드 · 메시지(E2E는 응답 코드 포함) 목록 |

#### 5. 동시성 테스트

**대상:**
- 같은 키로 동시 주문 → 주문 1건 (2.8)
- 같은 결제에 동시 승인 → 결제는 한 번만 (6.25)
- 승인 · 취소 · 만료 동시 실행 → 하나만 반영 (9.3)

**도구:**
- `ExecutorService` + `CountDownLatch`, 도우미 `동시에(n) { … }`
- `FakePgClient.latencyMillis`로 결제사 응답 지연

#### 6. 기존 테스트 이관

- `AC-CNF-*`, `AC-APV-*` → 6.3 ~ 6.25는 `PaymentConfirmIntegrationTest`, 6.1 · 6.2는 `OrderPaymentE2ETest`로 옮기고 BDD 형식(`R6-N <상황>이면 <결과>다`, given / when / then)으로 바꿉니다. 셋업은 주문 접수 기반으로 바꿉니다.
- `AC-PRE-*` (결제 준비) → 삭제, `R6-26 회원이 금액을 정해 결제를 준비할 수는 없다`로 대체
- `TossPaymentsClientTest`, `PaymentDomainTest`, `PaymentConfigTest`, `PaymentReconcilerTest` → 기존 이름 유지

#### 7. 테스트 기준 데이터

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
| 201 ~ 221 | 상품 01 ~ 21 | 1,000 | 판매 중 | 상품 개수 (0개 / 1개 / 20개 / 21개) |
| 999 | — | — | 없음 | 존재하지 않는 상품 |

**기본 주문:** `Idempotency-Key: idem-0001`, 아메리카노 2 + 카페라떼 1 → 14,000원, "아메리카노 외 1건"

**기본 결제 승인:** `paymentKey = "pk_1"`, `amount = 14000`

#### 8. 주요 테스트 시나리오

```
시나리오 개요: R1-2a 주문 상품이 1개 이상 20개 이하면 주문할 수 있다      (E2E)
  Given 판매 중인 상품 <개수>개를 담았다
  When  회원이 주문한다
  Then  주문이 접수된다
  예: | 개수 | 1 | 20 |

시나리오 개요: R1-2b 주문 상품이 없거나 20개를 넘으면 주문할 수 없다      (E2E)
  Given 판매 중인 상품 <개수>개를 담았다
  When  회원이 주문한다
  Then  주문 상품은 1개 이상 20개 이하로 담으라고 안내받는다
  And   주문은 만들어지지 않는다
  예: | 개수 | 0 | 21 |

시나리오 개요: R1-10a 주문 금액이 10,000,000원 이하면 주문할 수 있다      (유닛)
  Given 판매가로 계산한 주문 금액이 <금액>이다
  When  주문 항목을 확정한다
  Then  주문 금액이 <금액>으로 정해진다
  예: | 금액 | 10,000,000원 |

시나리오 개요: R1-10b 주문 금액이 10,000,000원을 넘으면 주문할 수 없다      (유닛)
  Given 판매가로 계산한 주문 금액이 <금액>이다
  When  주문 항목을 확정하면
  Then  1회 주문 금액 한도를 넘었다는 이유로 거절된다
  예: | 금액 | 10,000,001원 |

시나리오: R2-4 24시간 안에 같은 주문을 다시 하면 처음 주문을 돌려받는다      (통합)
  Given 회원이 키 idem-0001로 주문했다
  And   23시간 59분이 지났다
  When  회원이 같은 키로 같은 주문을 한다
  Then  처음 주문을 돌려받는다
  And   새 주문은 만들어지지 않는다

시나리오: R5-5 결제가 진행 중인 주문은 취소할 수 없다      (통합)
  Given 회원이 주문했고, 그 주문의 결제가 승인 진행 중이다
  When  회원이 주문을 취소하면
  Then  이미 처리 중인 결제라는 이유로 거절된다
  And   주문은 결제 대기 그대로다
  And   결제사에는 아무것도 요청하지 않는다

시나리오: R6-17 결제사가 주문과 같은 내용으로 승인하면 결제가 완료된다      (통합)
  Given 회원이 14,000원어치를 주문했다
  And   결제사는 주문과 같은 내용으로 승인한다
  When  회원이 결제한다
  Then  결제가 완료된다
  And   주문은 결제 완료가 된다
  And   결제는 한 번만 이루어진다

시나리오 개요: R6-18 결제사가 주문과 다른 내용으로 승인하면 그 결제는 취소되고 실패한다      (통합)
  Given 회원이 주문했고, 결제사는 <내용>을 주문과 다르게 승인한다
  When  회원이 결제하면
  Then  결제사 응답이 주문과 다르다는 이유로 거절된다
  And   결제사 승인은 취소된다
  And   주문은 결제 실패가 된다
  And   운영자가 볼 수 있게 무엇이 달랐는지 남는다
  예: | 내용 | 금액 | 결제 키 | 주문번호 |

시나리오 개요: R6-11b 결제 기한이 되면 결제할 수 없다      (통합)
  Given 회원이 주문했다 (결제 기한은 주문 후 30분)
  And   결제 기한 <시점>이 되었다
  When  회원이 결제하면
  Then  결제 기한이 지났다는 이유로 거절된다
  And   주문은 결제 대기 그대로이고, 결제는 이루어지지 않는다
  예: | 시점 | 정각 | 1초 후 |

시나리오: R6-25 같은 주문을 동시에 여러 번 결제해도 결제는 한 번만 이루어진다      (통합)
  Given 회원이 주문했고, 결제사는 1초 뒤에 승인한다
  When  회원이 같은 주문을 동시에 10번 결제한다
  Then  결제는 한 번만 이루어진다
  And   한 번은 완료되고, 나머지는 이미 처리 중이라고 거절된다

시나리오: R6-5 주문 금액과 다른 금액으로 결제하면 결제할 수 없다고 안내받는다      (E2E)
  Given 회원이 14,000원어치를 주문했다
  When  회원이 13,000원으로 결제한다
  Then  결제 금액이 주문 금액과 다르다고 안내받는다

시나리오: R8-6 결제가 진행 중인 주문은 결제 기한이 지나도 만료되지 않는다      (통합)
  Given 회원이 주문했고, 결제가 승인 진행 중이다
  And   결제 기한이 지났다
  When  만료 처리가 돈다
  Then  주문은 결제 대기 그대로다
```
