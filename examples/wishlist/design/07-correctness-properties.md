# Technical Design Document — 정확성 속성

> [design.md](../design.md)로 돌아가기

## Property-Based Testing Analysis

### PBT Applicability Assessment

찜 목록은 담기 · 빼기 요청의 순서에 따라 결과가 정해지므로, 무작위 요청 순서로 성질을 확인하기에 알맞습니다. 다만 기능이 작아 Property는 꼭 필요한 두 가지만 둡니다. 도구는 주문 기능과 같은 Kotest Property Testing입니다.

### Acceptance Criteria Testing Prework

1.2 이미 찜한 상품은 다시 담지 않는다
  Thoughts: 같은 상품을 몇 번 담든 결과가 같아야 하므로 무작위 반복으로 확인할 수 있다
  Classification: PROPERTY
  Test Strategy: 상품 몇 개를 무작위 순서와 횟수로 담은 뒤 찜 목록을 확인

1.3 찜 목록에는 상품을 100개까지 담을 수 있다
  Thoughts: 경계(99 / 100)는 시나리오 테스트로 충분하지만, 무작위로 많이 담아도 100개를 넘지 않는지는 Property로 본다
  Classification: PROPERTY
  Test Strategy: 서로 다른 상품을 1 ~ 150개 무작위로 담고 개수를 확인

1.9 같은 상품은 찜 목록에 한 번만 담긴다
  Thoughts: 1.2와 같은 성질을 저장 결과 쪽에서 본 것이다
  Classification: PROPERTY (1.2와 통합)
  Test Strategy: 1.2와 같음

2.2 찜 목록에 없는 상품이면 아무것도 바꾸지 않는다
  Thoughts: 대표 사례 하나로 충분하다
  Classification: EXAMPLE
  Test Strategy: 담지 않은 상품을 빼고 204와 찜 목록이 그대로인지 확인

3.4 상품 카탈로그에 없는 상품은 판매 종료로 보여준다
  Thoughts: 카탈로그에 없는 경우 하나를 보면 된다
  Classification: EDGE_CASE
  Test Strategy: 999를 찜한 회원 4의 목록에서 판매 종료와 빈 상품명 · 판매가 확인

**Property Reflection:**

1. **1.2와 1.9**는 같은 성질(같은 상품은 한 번)을 요청 쪽과 저장 쪽에서 본 것 → Property 1로 통합
2. **1.3**은 개수 한도라 따로 둠 → Property 2

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 같은 상품은 한 번만 담긴다

*For any* 한 회원이 보낸 담기 요청 목록(같은 상품 반복 포함)에 대해, 찜 목록의 상품은 서로 다르고, 그 집합은 담기에 성공한 상품의 집합과 같다

**Validates: Requirements 1.2, 1.9**

### Property 2: 찜 목록은 100개까지

*For any* 서로 다른 상품을 담는 요청 목록에 대해, 찜 목록의 찜 수는 min(요청 수, 100)이고, 100개를 넘는 요청은 `WISHLIST_FULL`로 거절된다

**Validates: Requirements 1.3**
