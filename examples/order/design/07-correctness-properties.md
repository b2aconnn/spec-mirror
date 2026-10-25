# Technical Design Document — 정확성 속성

> [design.md](../design.md)로 돌아가기

## Property-Based Testing Analysis

### PBT Applicability Assessment

주문 금액 계산, 주문 내용 동일성 판단, 상태 전이 규칙은 입력 조합이 많고 "언제나 성립해야 하는" 규칙이 분명하므로 Property 기반 검증이 적합합니다. 다만 이 프로젝트는 인수 테스트를 기본으로 하므로, Property는 JUnit 5 `@ParameterizedTest`와 무작위 입력 반복으로 검증하고 Property 라이브러리(jqwik 등)는 선택 사항으로 둡니다.

### Acceptance Criteria Testing Prework

1.2 주문 상품은 1개 이상 20개 이하로 담을 수 있다
  Thoughts: 0개, 21개 이상의 임의 개수에 대해 거절되고, 1~20개는 통과하는 경계 규칙입니다.
  Classification: PROPERTY
  Test Strategy: 0~25개 임의 개수로 요청해 1~20만 접수되는지 검증

1.3 상품별 수량은 1개 이상 99개 이하로 담을 수 있다
  Thoughts: 임의 수량에 대해 범위 밖이면 항상 거절됩니다.
  Classification: PROPERTY
  Test Strategy: -1~150 임의 수량으로 1~99만 접수되는지 검증

1.4 같은 상품은 한 번만 담을 수 있다
  Thoughts: 임의 항목 목록에 중복을 넣으면 위치와 관계없이 거절되어야 합니다.
  Classification: PROPERTY
  Test Strategy: 임의 목록의 임의 위치에 중복 상품을 넣어 거절 확인

1.6 상품 정보를 확인할 수 없으면 주문을 받지 않는다
  Thoughts: 카탈로그 장애 한 가지 경우입니다.
  Classification: EXAMPLE
  Test Strategy: FakeProductCatalog를 장애 상태로 두고 503 확인

1.9 주문 금액은 상품 카탈로그의 판매가로 계산한다
  Thoughts: 임의 상품·수량 조합에 대해 주문 금액 = Σ 판매가 × 수량이 항상 성립해야 합니다.
  Classification: PROPERTY
  Test Strategy: 임의 조합으로 주문해 주문 금액과 결제 금액 검증

1.10 1회 주문 금액은 10,000,000원을 넘을 수 없다
  Thoughts: 경계값 확인이 핵심입니다.
  Classification: EXAMPLE
  Test Strategy: 10,000,000원 접수, 10,000,001원 거절

1.12 주문명은 첫 상품명으로 정한다
  Thoughts: 임의 개수의 항목에 대해 "첫 상품명 외 (N-1)건" 형식이 성립합니다.
  Classification: PROPERTY
  Test Strategy: 1~20개 항목으로 주문명 형식 검증

1.13 주문, 주문 항목, 결제가 함께 만들어진다
  Thoughts: 저장 중 실패를 주입했을 때 아무것도 남지 않아야 합니다.
  Classification: EXAMPLE
  Test Strategy: 결제 저장 실패 주입 후 주문·항목·결제 모두 0건 확인

1.17 접수된 주문의 금액은 바뀌지 않는다
  Thoughts: 접수 후 임의로 판매가를 바꿔도 주문 금액·단가가 그대로여야 합니다.
  Classification: PROPERTY
  Test Strategy: 접수 후 카탈로그 가격 변경 → 조회 결과가 접수 시점 값인지 검증

2.4 24시간 안에 같은 주문 내용으로 다시 요청하면 기존 주문을 돌려준다
  Thoughts: 2.6과 함께, 항목 순서를 바꾼 모든 경우에 기존 주문이 돌아와야 합니다.
  Classification: PROPERTY (2.6과 통합)
  Test Strategy: 임의 항목 목록의 순열로 재요청 → 항상 200 + 같은 주문번호

2.5 24시간 안에 같은 키로 다른 주문 내용을 요청하면 주문을 받지 않는다
  Thoughts: 상품이나 수량이 하나라도 다르면 거절되어야 합니다.
  Classification: PROPERTY
  Test Strategy: 원래 주문에서 임의 항목의 수량·상품을 바꿔 422 확인

2.7 키는 회원별로 구분한다
  Thoughts: 서로 다른 두 회원의 같은 키는 항상 별개 주문입니다.
  Classification: PROPERTY
  Test Strategy: 임의 회원 쌍 × 같은 키 → 서로 다른 주문 2건

2.8 같은 키로 동시에 여러 번 요청해도 주문은 하나만 접수된다
  Thoughts: 동시 요청 수와 관계없이 주문은 1건이어야 합니다.
  Classification: PROPERTY
  Test Strategy: N개 동시 요청 → 201 1개 + 200 N-1개, 주문 1건

3.2 다른 회원의 주문은 볼 수 없다
  Thoughts: 4.5, 5.2와 같은 규칙입니다.
  Classification: PROPERTY (4.5, 5.2와 통합)
  Test Strategy: 임의 회원·주문 배치에서 남의 주문 조회·취소·내역 불가 확인

4.3 한 페이지는 기본 20건, 최대 50건이다
  Thoughts: 경계값 확인입니다.
  Classification: EXAMPLE
  Test Strategy: size 생략 → 20건, size=51 → 50건

5.7 취소와 결제 승인이 겹치면 먼저 확정된 쪽만 반영한다
  Thoughts: 6.13, 8.4와 함께 승인·취소·만료 경합 규칙입니다.
  Classification: PROPERTY (6.13, 8.4, 9.3과 통합)
  Test Strategy: 승인·취소·만료 동시 실행 반복 → 하나만 반영

5.9 주문을 취소하는 동안 PG에는 어떤 요청도 보내지 않는다
  Thoughts: 1.16과 같은 규칙입니다.
  Classification: PROPERTY (1.16과 통합)
  Test Strategy: 접수·취소 모든 시나리오에서 PG 호출 0번

6.9 취소되었거나 기한이 만료된 주문은 결제할 수 없다
  Thoughts: 두 가지 실패 사유에 대한 확인입니다.
  Classification: EXAMPLE
  Test Strategy: 취소 주문·만료 주문 각각 승인 요청 → 409 ORDER_NOT_PAYABLE

6.24 결과를 알 수 없는 결제는 절대 실패로 단정하지 않는다
  Thoughts: 결과 불명이 되는 모든 원인(타임아웃, 5XX, 예상 못한 오류)에서 성립해야 합니다.
  Classification: PROPERTY
  Test Strategy: 결과 불명 원인별로 PG 조회 전까지 UNKNOWN + 주문 PENDING_PAYMENT 확인

6.25 같은 결제에 대한 PG 승인 요청은 한 번만 나간다
  Thoughts: 동시 요청 수와 관계없이 PG 승인 호출은 1번이어야 합니다.
  Classification: PROPERTY
  Test Strategy: N개 동시 승인 요청 → PG 승인 호출 1번

7.7 결제 결과는 어느 경로로 확정되든 같은 방식으로 주문에 반영한다
  Thoughts: 승인 응답·즉시 조회·대사 세 경로 모두 같은 결과여야 합니다.
  Classification: PROPERTY
  Test Strategy: 같은 PG 결과 × 3개 경로 → 같은 주문 상태

8.2 만료 대상은 결제가 시작되지 않은 채 결제 기한이 지난 주문이다
  Thoughts: 결제 상태와 시각 조합에 대해 대상 여부가 정해집니다.
  Classification: PROPERTY
  Test Strategy: 결제 상태 5종 × 기한 전/정각/후 조합으로 대상 여부 검증

8.7 여러 서버에서 만료 처리가 동시에 돌아도 주문은 한 번만 만료된다
  Thoughts: 만료 배치를 동시에 실행해도 주문 상태 변경은 1번이어야 합니다.
  Classification: PROPERTY
  Test Strategy: 만료 배치 동시 2회 실행 → 주문당 상태 변경 로그 1번

9.1 주문 상태와 결제 상태는 항상 짝을 이룬다
  Thoughts: 모든 시나리오가 끝난 시점에 성립해야 합니다.
  Classification: PROPERTY
  Test Strategy: 모든 인수 테스트 종료 시 짝 표 검증

**Property Reflection:**

1. **1.16과 5.9**는 "PG를 부르지 않는다"는 같은 규칙 → 하나로 통합
2. **2.4와 2.6**은 주문 내용 동일성이라는 같은 규칙 → 하나로 통합
3. **3.2, 4.5, 5.2**는 "본인 것만" 규칙 → 하나로 통합
4. **5.7, 6.13, 8.4, 9.3**은 승인·취소·만료 경합 규칙 → 하나로 통합
5. **1.9와 1.17**은 각각 계산 규칙 / 불변 규칙으로 별도 유지

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 주문 상품 개수 제한

*For any* 주문 요청에서 상품 종류가 0개이거나 20개를 넘으면, 시스템은 주문을 받지 않는다

**Validates: Requirements 1.2**

### Property 2: 상품별 수량 제한

*For any* 주문 항목의 수량이 1~99 범위를 벗어나면, 시스템은 주문을 받지 않는다

**Validates: Requirements 1.3**

### Property 3: 중복 상품 거절

*For any* 주문 요청에서 같은 상품이 두 항목 이상에 있으면, 위치와 관계없이 시스템은 주문을 받지 않는다

**Validates: Requirements 1.4**

### Property 4: 주문 금액은 서버 계산값

*For any* 판매 중 상품 조합에 대해, 주문 금액은 Σ(판매가 × 수량)이고 결제 금액은 주문 금액과 같다. 요청에 금액이 있어도 결과는 같다

**Validates: Requirements 1.9, 1.13, 1.15**

### Property 5: 주문명 형식

*For any* N개 항목의 주문에 대해, 주문명은 N=1이면 첫 상품명, N≥2이면 "첫 상품명 외 (N-1)건"이다

**Validates: Requirements 1.12**

### Property 6: 접수된 주문의 불변성

*For any* 접수된 주문에 대해, 이후 상품 판매가·상품명이 바뀌어도 주문 금액과 주문 항목의 단가·상품명은 접수 시점 값과 같다

**Validates: Requirements 1.17, 3.5**

### Property 7: 접수·취소는 PG를 호출하지 않음

*For any* 주문 접수 또는 결제 전 취소 요청에 대해(성공·거절 모두), PG 승인·조회·취소 호출은 0번이다

**Validates: Requirements 1.16, 5.9**

### Property 8: 주문 내용 동일성

*For any* 주문 항목 목록과 그 순서를 바꾼 목록에 대해, 같은 키로 재요청하면 항상 기존 주문을 돌려준다

**Validates: Requirements 2.4, 2.6**

### Property 9: 다른 내용의 키 재사용 거절

*For any* 24시간 안에 같은 키로 상품이나 수량이 다른 주문을 요청하면, 시스템은 주문을 받지 않는다

**Validates: Requirements 2.5**

### Property 10: 키는 회원별

*For any* 서로 다른 두 회원이 같은 키로 주문하면, 서로 다른 두 주문이 접수된다

**Validates: Requirements 2.7**

### Property 11: 동시 주문은 하나만 접수

*For any* 같은 회원·같은 키·같은 내용의 N개 동시 요청에 대해, 주문은 1건만 만들어지고 나머지는 같은 주문번호를 받는다

**Validates: Requirements 2.8**

### Property 12: 본인 주문만 접근

*For any* 회원 A의 주문에 대해, 회원 B의 조회·취소는 없는 주문과 같은 404이고, B의 주문 내역에 A의 주문은 없다

**Validates: Requirements 3.2, 4.5, 5.2**

### Property 13: PG 승인은 한 번만

*For any* 같은 결제에 대한 N개의 동시 승인 요청에 대해, PG 승인 호출은 정확히 1번이다

**Validates: Requirements 6.25**

### Property 14: 결과 불명은 실패로 단정하지 않음

*For any* 결과를 알 수 없는 승인 요청에 대해, PG 조회로 확정되기 전까지 결제는 결과 확인 중, 주문은 결제 대기다

**Validates: Requirements 6.24, 7.4**

### Property 15: 결과 반영은 경로와 무관

*For any* 같은 PG 최종 결과에 대해, 승인 응답·즉시 조회·대사 중 어느 경로로 확정되든 주문 상태는 같다

**Validates: Requirements 7.7**

### Property 16: 승인·취소·만료는 하나만 반영

*For any* 같은 주문에 대해 승인 시작·취소·만료가 동시에 일어나면, 정확히 하나만 반영되고 나머지는 아무것도 바꾸지 않는다

**Validates: Requirements 5.7, 6.13, 8.4, 9.3**

### Property 17: 만료 대상 선정

*For any* 주문에 대해, 주문이 결제 대기이고 결제가 승인 대기이며 결제 기한 ≤ 현재 시각일 때만 만료 대상이다. 결제가 진행 중이면 기한이 지나도 대상이 아니다

**Validates: Requirements 8.2, 8.6**

### Property 18: 만료는 한 번만

*For any* 만료 배치가 동시에 여러 번 실행되어도, 각 주문은 한 번만 만료된다

**Validates: Requirements 8.7**

### Property 19: 주문·결제 상태 짝

*For any* 시점에, 모든 주문의 주문 상태와 결제 상태는 "주문 상태와 결제 상태의 짝" 표의 조합 중 하나다

**Validates: Requirements 9.1, 9.2**

### Property 20: 종결 상태 불변

*For any* 종결 상태(결제 완료, 결제 실패, 주문 취소, 기한 만료)의 주문에 대해, 이후 어떤 승인·취소·만료·대사도 주문 상태를 바꾸지 않는다

**Validates: Requirements 7.5, 7.6**
