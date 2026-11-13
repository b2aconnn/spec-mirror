# Technical Design Document — 아키텍처

> [design.md](../design.md)로 돌아가기

## Architecture

### 따른 convention

| 항목 | 따른 규칙 | 근거 문서 |
|---|---|---|
| 구조 | `api` → `application` → `domain` ← `adapter` · `persistence`, 의존은 안쪽으로만 | `docs/convention/architecture.md` |
| 규칙의 위치 | 주문 · 결제는 상태 전이와 불변식이 있어 Aggregate Root 메서드가 지킴. Application Service는 순서만 조율 | `docs/convention/architecture.md` |
| 컴포넌트 나누기 | 분리 조건 1 ~ 5에 해당할 때만 따로 둠 (02의 `**역할:**`에 번호) | `docs/convention/architecture.md` |
| 외부 연동 · 트랜잭션 | 상품 카탈로그는 포트 + 어댑터로 번역. 외부 호출은 트랜잭션 밖, 상태 변경은 조건부 UPDATE | `docs/convention/architecture.md` |
| 이름 · 예외 | 행위 메서드(`cancel()`, `expire()`), `…Request` → `…Command` → `…Result` → `…Response`, `OrderException` + `OrderErrorCode` | `docs/convention/coding.md` |
| 요청 검증 | 요청 DTO · 파라미터 · 헤더의 Bean Validation 표준 어노테이션, `message`에 에러 코드, 여러 위반이면 기준 순서상 앞선 하나 | `docs/convention/validation.md` |
| 테스트 종류 | 도메인은 유닛, Application Service는 통합, Controller는 E2E | `docs/convention/testing.md` |

예시 문서: [convention](../../convention/)

- **쓰는 것**: Aggregate 2개(주문, 결제), 금액 계산의 Value Object, 상품 카탈로그 포트 + 어댑터(외부 응답을 `CatalogProduct`로 번역)
- **쓰지 않는 것**: Domain Event. 주문 상태는 결제 상태와 한 트랜잭션에서 함께 바뀌어야 하므로(9.2) 이벤트로 나누지 않고, Order Payment Synchronizer가 결제 트랜잭션 안에서 반영합니다.
- **기존 구조를 따르는 것**: 상태 변경은 기존 `Payment`와 같이 Repository 조건부 UPDATE로 합니다(9.3). 어떤 전이가 가능한지는 `OrderStatus`가 정합니다.

### 연동 관계

이 기능은 **주문**입니다. 결제(기존)와 같은 서비스 안에 있습니다.

| 상대 | 관계 | 연동 방식 |
|---|---|---|
| 결제 | 주문이 결제를 만들고, 결제 상태 변화에 주문이 반응함 | 같은 트랜잭션에서 Order Payment Synchronizer 호출 (9.2) |
| 상품 (외부 상품 카탈로그) | 주문이 읽음 | 포트 `ProductCatalog` + 어댑터 `HttpProductCatalog`. 외부 응답을 `CatalogProduct`로 번역 |
| PG | 결제가 요청함. 이 기능에서 바꾸지 않음 | 기존 `PgClient` 그대로 |

### 시스템 아키텍처

기존 레이어 구조(`api` / `application` / `domain` / `pg`)에 주문 컴포넌트와 상품 카탈로그 어댑터를 추가합니다.

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │    Order     │  │   Payment    │                         │
│  │  Controller  │  │  Controller  │  (결제 준비 API 제거)    │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ OrderPlace   │  │ OrderQuery   │  │ OrderCancel  │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Order     │  │    Order     │  │ OrderPayment │      │
│  │ Idempotency  │  │  Expiration  │  │ Synchronizer │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │PaymentConfirm│  │ PaymentState │  │   Payment    │      │
│  │   Service    │  │   Service    │  │  Reconciler  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────────┐
│                     Adapter Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Product    │  │   PgClient   │  │    Toss      │      │
│  │   Catalog    │  │  Interface   │  │  Payments    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────────┐
│                  Persistence Layer                           │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │    Order     │  │   Payment    │                         │
│  │  Repository  │  │  Repository  │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────────┐
│                      Database                                │
│               (MySQL, 테스트는 H2 MySQL 모드)                 │
└─────────────────────────────────────────────────────────────┘
```

### 구조 설명

#### 1. Presentation Layer (프레젠테이션 레이어)
- 주문 접수 / 조회 / 내역 / 취소, 결제 승인 API 노출
- 회원 식별 (`X-Member-Id` 헤더)
- 예외를 HTTP 상태 코드와 에러 응답으로 변환

#### 2. Service Layer (서비스 레이어)
- 요구사항의 처리 흐름을 순서대로 실행
- 트랜잭션 경계 결정: 외부 시스템 호출은 트랜잭션 밖, 상태 변경은 짧은 트랜잭션
- 주문 상태와 결제 상태를 함께 변경

#### 3. Adapter Layer (어댑터 레이어)
- 상품 카탈로그 조회
- PG 승인 / 조회 / 취소 (기존 `TossPaymentsClient`, 변경 없음)
- 외부 응답 실패를 정해진 예외로 분류

#### 4. Persistence Layer (영속성 레이어)
- 주문, 주문 항목, 결제 저장
- 상태 변경은 `WHERE status = :이전상태` 조건부 UPDATE로만 수행

### 처리 흐름별 트랜잭션 경계

```
[주문 접수]
  TX1   중복 주문 방지 키 확인 (24시간 지난 키는 떼어냄)
  ---   상품 카탈로그 조회 (트랜잭션 밖)
  TX2   주문 + 주문 항목 + 결제 저장

[결제 승인]
  TX1   검증 + 결제 READY → IN_PROGRESS
  ---   PG 승인 호출 (트랜잭션 밖)
  TX2   결제 결과 반영 + 주문 상태 반영 (같은 트랜잭션)

[주문 취소]
  TX    결제 READY → FAILED + 주문 PENDING_PAYMENT → CANCELED

[기한 만료]  1분마다, 주문별로
  TX    결제 READY → FAILED + 주문 PENDING_PAYMENT → EXPIRED
```

모든 트랜잭션은 **결제 → 주문 순서로** 갱신합니다. 같은 순서로 락을 잡기 때문에 승인·취소·만료가 겹쳐도 교착 상태가 생기지 않습니다.
