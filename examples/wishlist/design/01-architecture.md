# Technical Design Document — 아키텍처

> [design.md](../design.md)로 돌아가기

## Architecture

### 따른 convention

| 항목 | 따른 규칙 | 근거 문서 |
|---|---|---|
| 구조 | `api` → `application` → `domain`, 의존은 안쪽으로만 | `docs/convention/architecture.md` |
| 규칙의 위치 | 찜은 상태가 없고 규칙마다 한 곳에서 지키므로 서비스 하나에 흐름대로 (Transaction Script) | `docs/convention/architecture.md` |
| 이름 · 예외 | 유스케이스 메서드 `add` · `remove` · `list`, `WishlistException` + `WishlistErrorCode` | `docs/convention/coding.md` |
| 테스트 종류 | 도메인 객체가 없어 유닛 없음. 서비스는 통합, Controller는 E2E | `docs/convention/testing.md` |

예시 문서: [convention](../../convention/)

- **쓰는 것**: 서비스 하나에 흐름대로, JPA 엔티티 `Wish`와 Repository
- **쓰지 않는 것**: Aggregate, Value Object, Domain Service, Domain Event, 새 포트. 찜은 지킬 불변식이 "같은 상품 한 번"뿐이고, 이는 유니크 제약 하나로 충분합니다.
- **그 부분만 보강하는 것**: 상품 정보는 주문 기능이 만든 `ProductCatalog` 포트를 그대로 씁니다. 같은 상품을 동시에 담는 경우는 `(member_id, product_id)` 유니크 제약으로 막습니다.
- 근거로 삼은 그 밖의 파일: `CLAUDE.md`(Spring Boot + Kotlin, JPA), `order/design/02-components.md`(`ProductCatalog`)

### 연동 관계

이 기능은 **찜**입니다. 주문 · 결제와 주고받는 것은 없습니다.

| 상대 | 관계 | 연동 방식 |
|---|---|---|
| 상품 (외부 상품 카탈로그) | 찜이 읽음 | 주문 기능의 포트 `ProductCatalog` 그대로 (새 어댑터 없음) |

### 시스템 아키텍처

기존 레이어 구조(`api` / `application` / `domain`)에 찜 컨트롤러, 서비스, 엔티티를 추가합니다.

```
┌──────────────────────────────────────────────┐
│ Presentation    WishlistController           │
└──────────────────────────────────────────────┘
                     │
┌──────────────────────────────────────────────┐
│ Service         WishlistService              │──▶ ProductCatalog (기존 포트)
└──────────────────────────────────────────────┘
                     │
┌──────────────────────────────────────────────┐
│ Persistence     WishRepository               │
└──────────────────────────────────────────────┘
                     │
┌──────────────────────────────────────────────┐
│ Database        wishes (MySQL)               │
└──────────────────────────────────────────────┘
```

### 구조 설명

#### 1. Presentation Layer (프레젠테이션 레이어)
- 찜하기 / 찜 해제 / 찜 목록 조회 API 노출
- 회원 식별 (`X-Member-Id` 헤더, 주문과 같음)

#### 2. Service Layer (서비스 레이어)
- 요구사항의 처리 흐름을 순서대로 실행
- 상품 카탈로그 조회는 트랜잭션 밖

#### 3. Persistence Layer (영속성 레이어)
- 찜 저장 · 삭제 · 회원별 조회
- 같은 상품 중복은 유니크 제약으로 막음

### 처리 흐름별 트랜잭션 경계

```
[찜하기]
  ---   기존 찜 확인, 개수 확인 (읽기)
  ---   상품 카탈로그 조회 (트랜잭션 밖)
  TX    찜 저장 (유니크 제약 위반이면 기존 찜을 다시 읽어 응답)

[찜 해제]
  TX    찜 삭제 (없으면 0건)

[찜 목록 조회]
  ---   찜 목록 읽기 → 상품 카탈로그 조회 (트랜잭션 밖)
```
