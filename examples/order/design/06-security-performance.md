# Technical Design Document — 보안 · 성능

> [design.md](../design.md)로 돌아가기

## Security

### 보안 요구사항 구현

#### 1. 본인 주문만 접근

- 주문 조회·취소는 `orderId`와 `memberId`를 함께 조건으로 조회 (`findByOrderIdAndMemberId`)
- 다른 회원의 주문은 403이 아니라 404로 응답 — 다른 회원의 주문이 있는지조차 알려주지 않음
- 주문 내역은 `memberId` 조건으로만 조회

#### 2. 금액 위변조 방지

- 주문 금액은 상품 카탈로그 판매가로만 계산, 요청 금액은 받지 않음
- 결제 승인 시 요청 금액이 주문 금액과 다르면 PG 호출 전에 거절 (기존)
- PG 응답의 주문번호·금액·결제 키도 주문과 대조 (기존)

#### 3. 추측 불가능한 주문번호

- `ORD_` + ULID 26자 — 순차 번호가 아니므로 다른 주문번호를 추측하기 어려움

## Performance Optimization

### 성능 최적화 전략

#### 1. 외부 호출은 트랜잭션 밖

- 상품 카탈로그·PG 응답을 기다리는 동안 DB 커넥션을 잡지 않음
- `spring.jpa.open-in-view: false` 유지 (기존)

#### 2. 인덱스

| 인덱스 | 쓰는 곳 |
|---|---|
| `uk_orders_member_idempotency (member_id, idempotency_key)` | 중복 주문 방지 키 조회 |
| `idx_orders_member_created (member_id, created_at, id)` | 주문 내역 최근순 조회 |
| `idx_orders_status_expires (status, expires_at)` | 만료 대상 조회 |

#### 3. 주문 내역은 Slice

- 전체 건수 `COUNT` 쿼리 없이 다음 페이지 유무만 확인

#### 4. 만료 배치 크기 제한

- 한 번에 최대 100건, 주문별로 짧은 트랜잭션
