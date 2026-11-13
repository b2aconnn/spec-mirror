# spec-mirror

**명세대로 코드를 짜고, 코드대로 명세가 남게 하는 Claude Code 플러그인입니다.**

기능을 만들거나 버그를 고칠 때 Claude가 바로 코드를 쓰지 않습니다. 먼저 명세를 쓰고, 단계마다 사람의 승인을 받은 뒤 구현합니다. AWS Kiro의 스펙 방식(Feature Spec · Bugfix Spec)을 Claude Code에서 쓸 수 있게 만들었습니다.

- **새 기능**: 요구사항 → 설계 → 태스크 → 구현
- **버그 수정**: 버그 분석 → 원인과 고칠 범위 → 태스크 → 구현
- **기존 코드**: 지금 동작을 그대로 명세로 옮기기

> [English](README.en.md)

## 설치

Claude Code와 Node.js 18 이상이 필요합니다.

```text
/plugin marketplace add b2aconnn/spec-mirror
/plugin install spec-mirror@spec-mirror
```

설치한 뒤 Claude Code를 다시 시작합니다.

## 시작하기

쓰려는 프로젝트에서 한 번 실행합니다.

```text
/spec-mirror:init
```

`.spec-mirror/config.json`과 명세 폴더 `docs/spec/`이 생깁니다. 팀 규칙(convention) 문서가 없으면 프로젝트에 맞는 아키텍처를 추천하고, 고르면 `docs/convention/`에 만들어 줍니다([팀 convention 따르기](#팀-convention-따르기)).

## 사용법

### 새 기능 만들기

```text
/spec-mirror:spec order 회원이 상품을 골라 주문하고 결제하는 기능
```

1. Claude가 **요구사항**(`requirements.md`)을 쓰고 멈춥니다.
2. 읽어 보고 고칠 점을 말하거나, 괜찮으면 **"승인"** 이라고 답합니다.
3. 승인하면 **설계**(`design.md`), 다시 승인하면 **태스크**(`tasks.md`)로 넘어갑니다.
4. 태스크까지 승인하면 **바로 모든 태스크를 구현**합니다 (테스트 먼저, 그다음 코드).
   - 일부만 하려면 번호를 함께 말합니다: "승인, 1~3번만"
   - 나중에 이어서: "4번 진행해", "4~6번 구현해줘", "1,3번 태스크 시작해줘"

```text
/spec-mirror:sync order             명세 · 테스트 · 코드가 맞는지 마지막 확인
```

<details>
<summary><b>예시: requirements.md</b> — 비즈니스 규칙을 기술 용어 없이</summary>

```markdown
## 기능별 요구사항

| 🟢 기능 흐름 (요청 · 동작 · 응답) | 🟠 검증 | 🟣 외부 요청 |
|---|---|---|

### 요구사항 1: 주문 접수

**사용자 이야기:** 회원은 상품과 수량을 골라 주문하고 싶다. 시스템이 정한 금액으로 결제하기 위해서다.

#### 인수 조건

##### 처리 흐름

1. 🟢 **회원은 상품과 수량을 골라 주문할 수 있다.**
   - 요청 정보: 주문 항목 목록(상품, 수량), 중복 주문 방지 키

2. 🟠 **주문 상품은 1개 이상 20개 이하로 담을 수 있다.** 비어 있거나 20개를 넘으면 주문을 받지 않는다.
   - 경계: 20개 가능, 21개 불가
   - 에러: `400` `INVALID_ORDER_ITEM_COUNT`
   - 메시지: "주문 상품은 1개 이상 20개 이하로 담아주세요."

9. 🟢 **주문 금액은 상품 카탈로그의 판매가로 계산한다.**
   - 항목 금액 = 판매가 × 수량

14. 🟢 **주문이 접수되면 접수된 주문 정보를 응답한다.**
    - 응답: `201` — 주문번호, 주문 상태(결제 대기), 주문 금액, 주문명, 주문 항목, 결제 기한, 결제 상태(승인 대기)

##### 항상 지켜야 할 규칙

15. **주문 금액은 언제나 시스템이 계산한다.** 요청에 금액이 들어 있어도 쓰지 않는다.
```

- 처리 흐름의 기준마다 색이 붙습니다. 🟢 기능 흐름(요청 · 동작 · 응답) · 🟠 검증 · 🟣 외부 요청이고, 뜻은 `## 기능별 요구사항` 바로 아래 범례 한 줄에 있습니다. 🟢만 따라 읽으면 기능 흐름이, 🟠만 따라 읽으면 검증 목록이 보입니다. 분류 근거는 Cockburn의 유스케이스 단계 종류입니다.
- 한국 사람이 읽기 편한 한국어 틀(요구사항 · 개요 · 용어 · 사용자 이야기 · 인수 조건)로 씁니다. 영어 틀(Requirements Document · User Story …)로 쓴 기존 문서도 그대로 검사를 통과합니다.
- **처리 흐름**은 코드가 실행되는 순서 그대로입니다. 위에서 아래로 읽으면 코드를 위에서 아래로 읽는 것과 같습니다.
- 기준 하나가 테스트 시나리오(`R1-2b 주문 상품이 없거나 20개를 넘으면 주문할 수 없다`)와 코드 분기 하나(`// R1-2`)가 됩니다.

전체 예시: [examples/order/requirements.md](examples/order/requirements.md)

</details>

<details>
<summary><b>예시: design</b> — 요구사항을 코드 구조에 연결</summary>

목차 `design.md`와 본문 8개 파일로 나뉩니다. 아키텍처(3 layer, DDD, Feature-based …)는 spec-mirror가 정하지 않고 프로젝트 convention을 따릅니다. design은 그 구조 안에서 요구사항의 기준마다 코드 어디서 판단하고 어떤 테스트가 확인하는지 정합니다.

| 파일 | 내용 |
|---|---|
| `design.md` | 개요, 설계 목표, 문서 목차 |
| `design/01-architecture.md` | 따른 convention, 연동 관계, 구조, 트랜잭션 경계 |
| `design/02-components.md` | 컴포넌트와 인터페이스 (처리 순서가 요구사항과 같게) |
| `design/03-data-models.md` | 도메인 모델, API, 테이블, 도메인 용어 ↔ 코드 표 |
| `design/04-error-handling.md` | 에러 코드와 메시지, 로그 |
| `design/05-testing.md` | 테스트 종류(convention), 기준 ↔ 테스트, 에러 ↔ 응답 테스트, 테스트 기준 데이터 |
| `design/06-security-performance.md` | 보안, 성능 |
| `design/07-correctness-properties.md` | 항상 성립해야 하는 성질 (Property) |
| `design/08-deployment-configuration.md` | 배포, 설정 |

전체 예시: [examples/order/design.md](examples/order/design.md) (Aggregate 2개, 컴포넌트 11개) · [examples/wishlist/design.md](examples/wishlist/design.md) (서비스 하나 + Repository). 둘 다 [예제 convention](examples/convention/)을 따릅니다.

</details>

<details>
<summary><b>예시: tasks.md</b> — 테스트 먼저, 그다음 구현</summary>

```markdown
- [ ] 6. 주문 접수 구현
  - [ ] 6.1 테스트 작성: OrderLinesTest, OrderDraftTest, OrderPlaceIntegrationTest, OrderE2ETest
    - 유닛: 없는 상품, 판매 중지 상품, 금액 계산, 금액 한도, 주문번호, 주문명
    - 통합: 상품 카탈로그 장애, 주문 · 항목 · 결제 함께 생성
    - E2E: 정상 접수, 상품 개수 · 수량 · 중복 상품, 에러 응답
    - _Requirements: 1.1 ~ 1.17_

  - [ ] 6.2 요청 검증 구현 (PlaceOrderRequest, OrderController)
    - 상품 개수 → 수량 → 중복 상품 순서로 확인
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ]* 6.5 Property 테스트: 주문 상품 개수 / 수량 / 중복 상품
    - **Property 1: 주문 상품 개수 제한**
    - **Validates: Requirements 1.2, 1.3, 1.4**
```

- 모든 요구사항 기준이 어떤 태스크에 들어 있어야 합니다.
- `*`가 붙은 태스크는 선택입니다. 끝에 있는 Task Dependency Graph에 병렬로 할 수 있는 태스크가 나옵니다.

전체 예시: [examples/order/tasks.md](examples/order/tasks.md)

</details>

### 버그 고치기

```text
/spec-mirror:bugfix pay-mismatch 결제 금액이 다를 때 400 이 나오는데 502 여야 함
```

버그 설명에 **재현 방법, 지금 결과, 기대 결과, 바뀌면 안 되는 것**을 적으면 좋습니다.

1. **버그 분석**(`bugfix.md`): 지금 동작, 기대 동작, **그대로 유지할 동작**을 정리합니다.
2. **설계**(`design.md`): 코드를 읽고 원인을 찾아 고칠 범위를 정합니다.
3. **태스크**(`tasks.md`): 순서가 정해져 있습니다.
   1. 버그를 재현하는 테스트를 쓰고, **고치기 전에 실패**하는지 확인합니다.
   2. 유지할 동작의 테스트를 쓰고, **고치기 전에 통과**하는지 확인합니다.
   3. 고친 뒤 두 테스트가 모두 통과하는지 확인합니다.
   4. 기능 명세를 고친 동작에 맞춥니다.

단계마다 "승인"해야 다음으로 넘어가는 것은 새 기능과 같습니다.

<details>
<summary><b>예시: bugfix.md</b> — 지금 동작 / 기대 동작 / 유지할 동작</summary>

```markdown
### Current Behavior (Defect)

1.1 **결과를 알 수 없어 PG에 한 번 조회했을 때 승인 내용이 주문과 다르면, PG가 거절한 것처럼 응답한다.**
   - 재현: 주문 금액 14,000원 결제 승인 요청 → PG 승인 결과 불명 → PG 조회 결과 승인 완료, 15,000원
   - 에러: `400` `PG_REJECTED`

### Expected Behavior (Correct)

2.1 **… 승인 응답에서 불일치가 난 때와 같이 PG 승인을 취소하고 결제 실패로 응답한다.**
   - 에러: `502` `PG_RESPONSE_MISMATCH`
   - 메시지: "결제사 응답이 주문 정보와 일치하지 않아 결제를 취소했습니다."
   - 명세: order 6.21

### Unchanged Behavior (Regression Prevention)

3.1 **승인 응답에서 대조 결과가 다르면 지금처럼 PG 승인을 취소하고 결제 실패로 응답한다.**
   - 명세: order 6.18
```

- `2.N`은 `1.N`을 고친 모습입니다. `3.M`은 비슷하지만 버그가 아닌 경우로, 고친 뒤에도 그대로여야 합니다.
- `명세: order 6.21`은 이 동작을 정하는 기능 명세 기준입니다. 버그를 고치면 이 기준도 함께 고칩니다.

전체 예시: [examples/confirm-recheck-mismatch/](examples/confirm-recheck-mismatch/)

</details>

### 기존 코드를 명세로 옮기기

```text
/spec-mirror:adopt                  프로젝트 전체: 기능 목록(명세 지도)부터
/spec-mirror:adopt payment          기능 하나
```

- 지금 코드의 동작을 **바꾸지 않고** 명세로 옮깁니다.
- 프로젝트 전체면 기능 목록(`docs/spec/README.md`)을 먼저 만들고, 승인하면 기능을 하나씩 진행합니다.
- 옮기다가 버그로 보이는 동작을 찾으면 고치지 않고 알려 줍니다. 고치는 것은 나중에 `/spec-mirror:bugfix`로 따로 합니다.

## 팀 convention 따르기

spec-mirror는 **명세를 쓰고, 명세와 테스트 · 코드를 잇는 일**만 합니다. 아키텍처, 이름 규칙, 검증 · 예외 처리, 테스트 종류, 코드 스타일은 프로젝트마다 다르므로 팀 규칙(convention) 문서를 따릅니다.

```
docs/
├── spec/            명세
└── convention/      팀 개발 규칙
    ├── architecture.md    구조 · 의존 방향 · 규칙을 두는 곳
    ├── coding.md          이름 · 검증 · 예외 · 로깅 · 코드 스타일
    └── testing.md         테스트 종류 · 도구
```

**convention 문서는 두 가지 방법으로 둘 수 있습니다.** 둘 다 있으면 모두 읽습니다.

| 방법 | 예 | 찾는 곳 |
|---|---|---|
| ① 폴더에 모으기 | `docs/convention/architecture.md` | `docs/convention/` 안의 모든 파일 (하위 폴더까지, 파일 이름 자유) |
| ② 이름으로 두기 | `convention.md`, `project-convention.md`, `backend-convention.md` | 프로젝트 어디서든 `convention.md` 또는 `○○-convention.md` 이름인 파일 |

- 대소문자는 가리지 않습니다(`CONVENTION.md`도 됩니다).
- `node_modules`, `build` 같은 폴더와 `.`으로 시작하는 폴더는 찾지 않습니다.
- 위치나 이름이 다르면 설정에서 바꿉니다. 아래 [설정](#설정)을 보세요.

**convention이 있으면** 고치지 않고 그대로 따릅니다. 예외는 용어 하나입니다.

- convention의 용어(용어집 · 용어 표)가 요구사항의 용어보다 우선합니다.
- 요구사항에서 convention에 없는 용어를 새로 정의했거나 다르게 썼으면, design을 시작하기 전에 표로 보여 주고 용어마다 **추가 · 변경 · 그대로**를 묻습니다. 고른 것만 convention에 반영한 뒤 design을 씁니다.

**convention이 없으면** Claude가 만듭니다. `init`이나 첫 design · 구현 때 프로젝트 종류와 규모를 보고 아키텍처를 추천하고, 고르면 초안을 보여 준 뒤 `docs/convention/`에 저장합니다.

| 종류 | 작은 프로젝트 | 보통 | 큰 프로젝트 |
|---|---|---|---|
| 백엔드 | 3 layer | 3 layer + 도메인 모델 | DDD + 헥사고날 |
| 프론트엔드 | 페이지 기준 폴더 | Feature-based | Feature-Sliced Design |

- 기존 코드가 있으면 지금 구조를 첫 번째 선택지로 둡니다.
- 기존 코드를 명세로 옮길 때(adopt)는 추천하지 않고 지금 코드의 구조를 그대로 적습니다.

**단계마다 읽는 범위가 다릅니다.**

| 단계 | 읽는 것 | 예 |
|---|---|---|
| 설계 (design) | 설계에 관한 규칙만 | 구조, 이름 규칙, 예외 · 에러 응답, 검증 방식, 트랜잭션, 테스트 종류 |
| 구현 (implement · sync) | 전부 | 위에 더해 코드 스타일, 로깅, 테스트 작성법, 커밋 규칙 |

설계 문서에는 어떤 규칙을 따랐는지가 남습니다(design 01의 `따른 convention` 표).

**convention과 spec-mirror 규칙이 부딪치면** 명세와 코드를 잇는 세 가지만 spec-mirror를 따르고, 나머지는 모두 convention을 따릅니다.

- 테스트 이름 `R6-17 결제사가 주문과 같은 내용으로 승인하면 결제가 완료된다`와 given / when / then 본문
- 코드 분기 주석 `// R6-17`
- 에러 메시지를 요구사항과 글자까지 같게 쓰기

**이런 때는 멈추고 묻습니다.**

- 구현하다가 승인된 설계가 convention과 다른 것을 발견했을 때 → 설계를 고칠지 사용자가 정합니다.
- 기존 코드가 convention과 다를 때 → 이번에 고치는 코드만 convention을 따르고, 나머지는 고치지 않고 알려 줍니다.

예시: [examples/convention/](examples/convention/) (Spring 백엔드, 3 layer + DDD)

## 이렇게 동작합니다

- **단계마다 사람이 승인합니다.** Claude가 스스로 다음 단계로 넘어가지 않습니다. 승인 전에는 다음 단계 문서를 쓸 수 없게 막혀 있습니다.
- **형식을 자동으로 검사합니다.** 명세 문서를 저장할 때마다 검사하고, 틀린 곳은 Claude가 그 자리에서 고칩니다.
- **리뷰어가 따로 봅니다.** 단계마다 별도의 리뷰 에이전트가 문서를 다시 읽고 빠진 것을 찾습니다. 승인을 요청할 때 무엇을 지적받았고 어떻게 처리했는지 함께 보여 줍니다.
- **이미 쓰는 용어를 그대로 씁니다.** 요구사항을 쓰기 전에 **convention 문서의 용어를 가장 먼저**, 그다음 다른 명세의 용어와 코드의 엔티티 · enum 이름을 찾아 같은 개념이면 그 이름을 씁니다. 코드에 `User`가 있으면 새 문서에서도 회원(Member)이 아니라 사용자(User)입니다. 용어와 문장은 개발자 말이 아니라 현업에서 쓰는 비즈니스 말로 씁니다. convention에 없는 용어를 새로 정의했으면, design을 시작하기 전에 convention에 추가하거나 바꿀지 물어봅니다.
- **코드 이름은 도메인 용어를 따릅니다.** 요구사항 용어의 영문 이름이 클래스 · 변수 이름이 됩니다. design의 "도메인 용어 ↔ 코드" 표에 빠진 용어가 있거나 용어의 상태 값이 코드에 없으면 검사기가 알려 줍니다. 그 밖의 이름 스타일은 convention을 따릅니다.
- **아키텍처는 팀 convention을 따릅니다.** 3 layer든 DDD든 팀 convention 문서대로 설계하고 구현합니다. 없으면 규모에 맞는 구조를 추천해 만듭니다. [팀 convention 따르기](#팀-convention-따르기)
- **명세와 코드를 번호로 잇습니다.** 요구사항의 기준 하나가 테스트 시나리오(`R1-2 …`)와 코드 분기 하나(`// R1-2`)로 이어집니다. `/spec-mirror:sync`가 빠진 것을 찾아 줍니다.
- **테스트는 BDD 시나리오로 씁니다.** 이름은 `R6-17 결제사가 주문과 같은 내용으로 승인하면 결제가 완료된다`처럼 "<상황>이면 <결과>다" 문장이고, 본문은 given / when / then입니다. 개발자가 아니어도 읽을 수 있게 도메인 용어로 정책을 쓰고, 응답 코드 · 상태 값 같은 현상 확인은 테스트 지원 코드 안에 둡니다. 결과가 같은 경계값은 한 시나리오의 예시로 묶습니다.
- **빠진 테스트가 없게 합니다.** 기준마다 어떤 테스트가 확인하는지 design 05의 표에 남기고, 에러마다 회원이 실제로 받는 응답을 확인하는 테스트를 하나 이상 둡니다. 유닛 · 통합 · E2E 같은 테스트 종류는 convention을 따릅니다.
- **승인 뒤에 문서를 고치면** 다시 승인받아야 다음 단계로 갈 수 있습니다.

## 명령

| 명령 | 하는 일 |
|---|---|
| `/spec-mirror:init` | 프로젝트 설정 |
| `/spec-mirror:spec <이름> [설명]` | 새 기능 명세 (이어서 부르면 다음 단계) |
| `/spec-mirror:bugfix <이름> [설명]` | 버그 명세 (이어서 부르면 다음 단계) |
| `/spec-mirror:adopt [기능]` | 기존 코드를 명세로 |
| `/spec-mirror:implement <이름> [all\|next\|번호\|1~3]` | 태스크 구현 (tasks 승인 시 자동으로 시작) |
| `/spec-mirror:sync <이름>` | 명세 · 테스트 · 코드 대조 후 수정 |
| `/spec-mirror:status` | 명세별 진행 상황과 다음 할 일 |
| `/spec-mirror:check` | 형식 검사만 |
| `/spec-mirror:approve <이름>` | 지금 단계 승인 (대화에서 "승인"이라고 답해도 됩니다) |

## 만들어지는 문서

```
docs/spec/
├── README.md               명세 지도: 기능 목록과 순서 (adopt)
├── order/                  기능 명세
│   ├── requirements.md     요구사항: 비즈니스 규칙 (기술 용어 없이)
│   ├── design.md           설계 목차
│   ├── design/01~08        아키텍처 · 컴포넌트 · 데이터 · 에러 · 테스트 · 보안 · 정확성 · 배포
│   └── tasks.md            구현 계획
└── pay-mismatch/           버그 명세
    ├── bugfix.md           지금 동작 / 기대 동작 / 유지할 동작
    ├── design.md           원인과 고칠 범위
    └── tasks.md            재현 테스트 → 유지 테스트 → 수정 → 명세 반영
```

예시는 [`examples/`](examples/)에서 볼 수 있습니다. 각 문서의 자세한 규칙은 [`rules/`](rules/)에 있습니다.

| 궁금한 것 | 문서 |
|---|---|
| 요구사항 쓰는 법 | [rules/feature/requirements-format.md](rules/feature/requirements-format.md) |
| 설계 · 태스크 쓰는 법 | [rules/feature/](rules/feature/) |
| design 파일 구성 · 이름 짓기 | [rules/feature/design-format.md](rules/feature/design-format.md) |
| convention 만들기 · 아키텍처 추천 · 우선순위 | [rules/convention.md](rules/convention.md) |
| 버그 명세 쓰는 법 | [rules/bugfix/](rules/bugfix/) |
| 기존 코드 옮기기 · 명세 지도 | [rules/adopt.md](rules/adopt.md), [rules/spec-map.md](rules/spec-map.md) |
| 테스트 이름 · 코드 주석 규칙 | [rules/traceability.md](rules/traceability.md) |
| 단계 · 승인 · 리뷰 | [rules/workflow.md](rules/workflow.md) |

## 설정

`.spec-mirror/config.json`입니다. 기본값으로 바로 쓸 수 있습니다.

| 키 | 기본값 | 설명 |
|---|---|---|
| `specRoot` | `docs/spec` | 명세 폴더 |
| `techContext` | `CLAUDE.md`, `README.md` | Claude가 프로젝트의 기술 스택을 먼저 확인하는 문서 |
| `conventionDir` | `docs/convention` | 팀 규칙(convention) 폴더. 안의 모든 파일을 읽고, convention이 없으면 여기에 만듭니다 |
| `conventionFiles` | `convention.md`, `*-convention.md` | 프로젝트 어디서든 찾을 convention 파일 이름. `*`는 아무 글자 |
| `testPathPatterns` | 일반적인 테스트 경로 | 테스트 파일을 구분하는 규칙 |
| `extraItemLabels` | 없음 | 요구사항 항목 이름으로 더 허용할 말 |
| `stageGate` | `true` | 승인 전 다음 단계 작성 막기 |

특정 언어나 프레임워크를 가정하지 않습니다. 기술 스택은 convention 문서, 위 문서, 빌드 파일, 기존 코드 순서로 찾고, 그래도 모르면 물어봅니다.

**convention 위치를 바꾸는 예**

```jsonc
{
  // 팀 규칙이 wiki/rules 폴더에 있을 때
  "conventionDir": "wiki/rules",

  // 파일 이름이 ○○-guide.md 일 때 (기본 이름도 계속 찾으려면 함께 적습니다)
  "conventionFiles": ["convention.md", "*-convention.md", "*-guide.md"]
}
```

- 폴더만 쓰려면 `"conventionFiles": []`, 이름으로만 찾으려면 `"conventionDir": ""`로 둡니다.
- 지금 어떤 문서를 읽는지는 Claude에게 "convention 뭐 읽고 있어?"라고 물으면 알려 줍니다. (검사기 명령: `node <플러그인>/scripts/spec-mirror.mjs convention`)

## CI에서 형식 검사

검사기는 의존성 없는 Node 스크립트입니다. 형식 오류가 있으면 종료 코드 1을 돌려줍니다.

```yaml
- uses: actions/checkout@v4
  with: { repository: b2aconnn/spec-mirror, path: .spec-mirror-plugin }
- run: node .spec-mirror-plugin/scripts/spec-mirror.mjs check
```

## 문제 해결

| 증상 | 해결 |
|---|---|
| `/spec-mirror:` 명령이 안 보임 | Claude Code 재시작, 또는 `/reload-plugins` |
| "앞 단계 승인 뒤에 씁니다"라며 막힘 | `/spec-mirror:status`로 상태를 보고 앞 단계를 승인 |
| "승인 후 변경됨" | 승인한 문서가 바뀐 것입니다. 바뀐 내용을 보고 다시 승인 |
| 버그 재현 테스트가 고치기 전에 통과 | 원인 분석이 틀렸다는 뜻입니다. Claude가 멈추고 설계부터 다시 봅니다 |
| 승인할 때 권한 확인이 뜸 | 정상입니다. 승인은 한 번 더 확인하도록 되어 있습니다 |

## 개발

```bash
npm test                    # 검사기 테스트
claude plugin validate .    # 플러그인 구조 검증
claude --plugin-dir .       # 고친 플러그인으로 실행
```

변경 이력은 [CHANGELOG.md](CHANGELOG.md)에 있습니다.

## 라이선스

Copyright (c) 2026 b2aconnn. All rights reserved.

공개 배포 전까지는 저작권자의 허락 없이 복제 · 수정 · 배포할 수 없습니다. 공개할 때 오픈소스 라이선스로 바꿀 예정입니다. [LICENSE](LICENSE)를 확인하세요.
