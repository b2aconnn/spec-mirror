# design 작성 규칙

design은 requirements의 도메인 용어·기준을 **코드에 연결**하고, requirements에 쓰지 않은 구현 규칙을 담습니다. 구현 규칙에는 기술 선택, 트랜잭션 경계, 저장 구조, API 본문, 테스트 기준 데이터가 들어갑니다.

- 위치: `<specRoot>/<기능>/design.md`(목차) + `<specRoot>/<기능>/design/01~08`(본문)
- 기준 번호는 `Requirements N.M` 형식으로 참조합니다. requirements의 Requirement N, 기준 M입니다.
- 기술 스택은 플러그인이 정하지 않습니다. [기술 정보 찾기](#기술-정보-찾기) 순서대로 프로젝트에서 찾습니다.

## 파일 구성

design은 **목차 파일 1개 + 본문 파일 8개**이며, 파일 이름과 섹션은 고정입니다.

| 파일 | 첫 줄 | `##` 섹션 (순서 고정) |
|---|---|---|
| `design.md` | `# Technical Design Document` | `## Overview` → `## 문서 구성` |
| `design/01-architecture.md` | `# Technical Design Document — 아키텍처` | `## Architecture` |
| `design/02-components.md` | `# Technical Design Document — 컴포넌트와 인터페이스` | `## Components and Interfaces` |
| `design/03-data-models.md` | `# Technical Design Document — 데이터 모델 · API` | `## Data Models` |
| `design/04-error-handling.md` | `# Technical Design Document — 에러 처리` | `## Error Handling` |
| `design/05-testing.md` | `# Technical Design Document — 테스트 전략` | `## Testing Strategy` |
| `design/06-security-performance.md` | `# Technical Design Document — 보안 · 성능` | `## Security` → `## Performance Optimization` |
| `design/07-correctness-properties.md` | `# Technical Design Document — 정확성 속성` | `## Property-Based Testing Analysis` → `## Correctness Properties` |
| `design/08-deployment-configuration.md` | `# Technical Design Document — 배포 · 설정` | `## Deployment` → `## Configuration` |

- 본문 파일은 모두 첫 줄 제목 다음에 빈 줄, 그리고 `> [design.md](../design.md)로 돌아가기` 줄을 둡니다.
- 해당 사항이 없는 섹션(예: 저장소가 없는 기능의 Database Schema, 배포 변경이 없는 기능)도 **제목은 지우지 않고** "해당 없음 — <이유>"라고 씁니다.

## 설계 규모와 DDD

design은 DDD(Domain-Driven Design)로 설계합니다. 다만 DDD는 **도메인이 복잡한 만큼만** 씁니다. 작은 기능에 Aggregate, 포트, 이벤트를 다 갖추면 코드는 늘어나는데 지키는 규칙은 늘지 않습니다. 그래서 design을 쓰기 전에 **설계 규모**를 먼저 정하고, 규모에 맞는 도구만 씁니다.

### 원칙

1. **규모는 requirements가 정합니다.** 기능 이름이나 예상 코드 양이 아니라 requirements의 상태, 항상 지켜야 할 규칙, 외부 시스템, 다른 도메인과의 관계로 판단합니다.
2. **애매하면 낮은 쪽을 고릅니다.** 올려 잡을 때는 어떤 기준(`Requirements N.M`)이 그 구조를 필요로 하는지 씁니다.
3. **규모보다 높은 칸의 신호는 그 부분만 보강합니다.** 예: 작은 기능에 "동시에 담아도 하나만" 규칙이 있으면 규모는 작음으로 두고, 그 규칙만 유니크 제약으로 지킵니다. 외부 연동이 하나 있으면 그 연동에만 인터페이스와 어댑터를 둡니다.
4. **기존 프로젝트 구조가 먼저입니다.** 패키지 구조, 레이어 이름, 상태 변경 방식(예: 조건부 UPDATE)이 이미 있으면 따릅니다. 기능 하나를 위해 프로젝트 구조를 바꾸지 않습니다. DDD 개념(Aggregate 경계, Value Object, 불변식의 위치)은 그 구조 안에서 적용합니다.
5. **규모는 기능마다 다릅니다.** 같은 시스템 안에서도 주문은 큼, 공지사항은 작음일 수 있습니다.

### 규모 판단

requirements를 읽고 신호마다 해당하는 칸을 고릅니다. **가장 많이 해당하는 칸**이 규모입니다. 단, 큼 칸에 둘 이상 해당하면 큼입니다. 수가 같으면 낮은 쪽입니다.

| 신호 | 작음 | 보통 | 큼 |
|---|---|---|---|
| 상태 | 없거나 단순한 값 변경 | 한 대상에 여러 상태와 전이 | 여러 대상의 상태가 서로 맞물림 |
| 항상 지켜야 할 규칙 | 규칙마다 한 곳(제약 · 조건 하나)에서 지킴 | 한 대상의 여러 값 · 상태를 함께 지켜야 함 | 여러 대상에 걸쳐 지킴 |
| 외부 시스템 | 없거나 조회만 | 요청 1~2종 | 결과가 불확실한 요청(결과 불명, 대사) |
| 다른 도메인 | 관계 없음 | 다른 도메인 정보를 읽음 | 다른 도메인의 상태를 바꾸거나 그 변화에 반응 |
| 응답 뒤 처리 | 없음 | 없음 | 배치, 이벤트, 따라 바뀌는 것 |
| 동시에 겹치는 요청 | 상관없음 | 같은 대상 갱신을 막는 정도 | "겹쳐도 하나만 반영" 같은 규칙이 있음 |

### 규모별로 쓰는 것

| 항목 | 작음 | 보통 | 큼 |
|---|---|---|---|
| 도메인 규칙의 위치 | 서비스 메서드 하나에 흐름대로 (Transaction Script). 엔티티에는 간단한 메서드만 | **Aggregate Root 메서드**가 불변식과 상태 전이를 지킵니다. Application Service는 순서만 조율합니다 | 보통과 같고, 여러 Aggregate의 협력 방식을 정합니다 (아래) |
| Aggregate | 정의하지 않음 | 1~2개 | 필요한 만큼. Aggregate 사이는 ID로 참조 |
| Value Object | 규칙이 있는 값만 (예: 금액 한도). 없으면 기본 타입 | 규칙이나 계산이 있는 값 | 보통과 같음 |
| Domain Service | 쓰지 않음 | 여러 Aggregate나 외부 정보를 함께 써야 하는 계산이 있을 때만 | 보통과 같음 |
| Repository | 프로젝트 관례대로 | Aggregate마다 하나 | 보통과 같음 |
| 외부 시스템 | 기존 클라이언트를 직접 호출. 테스트에서 대체해야 하면 인터페이스 | 인터페이스(포트) + 어댑터 | 포트 + 어댑터. 외부 모델을 도메인 모델로 옮기는 번역 계층(Anti-Corruption Layer) |
| 다른 도메인 | 직접 조회 | 조회용 인터페이스 | `### 도메인 경계`에 관계와 연동 방식을 정하고 따릅니다 |
| Domain Event | 쓰지 않음 | 쓰지 않음 | 응답 뒤에 따라 바뀌는 것이 있을 때 |
| 컴포넌트 수 (02) | 1~3개 | 3~7개 | 제한 없음. 단, 분리 조건을 지킴 |

**여러 Aggregate가 함께 바뀔 때 (큼)**

- requirements가 "함께 바뀐다", "한쪽만 바뀐 상태가 보이지 않는다"를 요구하면, Application Service가 **한 트랜잭션에서** 두 Aggregate를 바꿉니다. 갱신 순서를 정하고, 그 근거 기준을 01 트랜잭션 경계에 씁니다.
- 응답 뒤에 따라 바뀌어도 되면 Domain Event로 나눕니다. 누락 · 중복 규칙은 [작업 흐름](../workflow.md#응답-뒤에-따라-일어나는-일)을 따릅니다.
- 한 트랜잭션에 Aggregate 하나가 DDD의 기본입니다. 이를 벗어나는 경우는 근거 기준과 함께 씁니다.

### 컴포넌트 나누기

컴포넌트는 **바뀌는 이유 하나에 하나**입니다. 기준이 많다고 나누지 않고, 계층이 있어야 할 것 같다고 나누지 않습니다.

다음 중 하나에 해당할 때만 따로 둡니다.

1. 트랜잭션 경계가 다르다 (예: 외부 호출을 트랜잭션 밖에 둬야 함)
2. 외부 시스템이나 다른 도메인과 연동한다
3. 둘 이상의 흐름이 같은 규칙을 함께 쓴다
4. Aggregate · Value Object로 불변식을 지킨다
5. 진입점이 따로 있다 (배치, 이벤트 처리)

다음은 만들지 않습니다.

- 한 흐름에서만 쓰는 검증 몇 줄을 위한 Validator 클래스. 요청 검증은 요청 DTO의 어노테이션으로, 비즈니스 검증은 Aggregate나 서비스 메서드 안에 둡니다([검증 위치](#검증-위치)).
- 구현이 하나뿐이고 테스트에서 대체하지 않는 내부 클래스의 인터페이스
- 호출을 그대로 넘기기만 하는 계층 (Facade, Manager, Helper)
- 조회만 하는 흐름을 위해 Aggregate를 거치는 경로. 조회는 조회용 쿼리로 바로 읽어도 됩니다
- 규모 표에서 "쓰지 않음"인 도구

## 이름 짓기

코드의 이름은 **requirements의 말**에서 옵니다. 코드를 읽는 사람이 requirements의 Glossary와 기준 문장을 떠올릴 수 있어야 합니다. design 03의 `### 도메인 용어 ↔ 코드` 표가 그 대응표이고, implement는 이 표대로 이름을 짓습니다. design 본문(컴포넌트 설명, 구현 책임, 표)도 기술 용어보다 **비즈니스 용어**로 씁니다. 예: "레코드를 갱신" 대신 "주문을 취소 상태로 바꿈".

1. **도메인 개념은 Glossary 영문 표기를 씁니다.** 클래스, 필드, 변수, 매개변수 모두 같습니다. 예: 주문 (Order) → `Order`, `orderId`. 결제 기한 (Expires At) → `expiresAt`.
   - 같은 개념은 어디서나 같은 이름입니다. 동의어를 섞지 않습니다(예: `order`와 `purchase`).
   - **기존 코드에 같은 개념의 이름이 있으면 그 이름을 씁니다.** 예: 기존 `User`가 있으면 새 코드에서 `Member`를 만들지 않습니다. requirements Glossary가 이미 기존 이름을 따르므로, 둘이 다르면 requirements 보완 필요로 보고합니다.
   - Glossary에 없는 도메인 개념에 이름이 필요하면 코드에서 지어내지 않습니다. "requirements 보완 필요"로 보고하고 Glossary에 먼저 넣습니다.
2. **상태 값은 Glossary의 `ENUM` 값 그대로**입니다. 예: 결제 대기 (`PENDING_PAYMENT`) → `OrderStatus.PENDING_PAYMENT`
3. **상태를 바꾸는 메서드는 도메인 행위 이름**입니다. 기준 문장의 동사나 도착 상태에서 가져옵니다. 예: `cancel()`, `expire()`, `markPaid()`
   - `setStatus(to)`, `changeStatus(to)`, `update(...)`처럼 어떤 전이인지 숨기는 메서드를 바깥에 두지 않습니다.
   - 조건부 갱신처럼 저장 계층에서 하나로 묶어야 하면 그 메서드는 저장 계층이나 `private`에만 두고, 바깥에는 행위 이름으로 감쌉니다.
4. **유스케이스 메서드는 첫 기준의 행위 이름**입니다. "회원은 ~할 수 있다"의 동사를 씁니다. 예: 주문 접수 → `place`, 찜하기 → `add`, 주문 취소 → `cancel`
5. **기술 역할 접미사는 관례 이름을 씁니다.** 앞부분은 도메인 용어입니다. 프로젝트에 정해진 관례가 있으면 그것을 따릅니다.
   - 계층 · 역할: `…Controller`, `…Service`, `…Repository`, `…Adapter`, `…Scheduler`, `…Exception`, `…ErrorCode`
   - 데이터 전달: `…Request` · `…Response`(Controller의 요청 · 응답), `…Command` · `…Result`(Application Service의 입력 · 출력), `…Query`(조회 조건)
   - 예: `OrderRepository`, `PlaceOrderRequest` → `PlaceOrderCommand` → `PlaceOrderResult` → `OrderResponse`
   - 접미사 앞에 기술 말을 넣지 않습니다. ❌ `OrderRecordDto`, `OrderEntityRequest` → ✅ `OrderResponse`
6. **뜻이 흐린 이름은 쓰지 않습니다.**
   - 클래스: `…Manager`, `…Helper`, `…Util`, `…Processor`, `…Info`, `…Data`
   - 메서드: `process…`, `handle…`, `do…`, `execute`, `run` (프레임워크가 정한 이름은 예외)
   - 변수: `data`, `info`, `temp`, `result`, `obj`처럼 무엇인지 말하지 않는 이름
7. **03 표에 이름을 모두 적습니다.** Glossary 용어마다 코드 이름을 적고, 상태 묶음은 enum 이름을, 상태 전이는 행위 메서드를 적습니다. 새 이름이 생기면 표를 먼저 고칩니다.

## 검증 위치

검증은 **무엇을 보고 판단하는지**에 따라 두 곳으로 나눕니다. requirements의 [확인 순서 표](requirements-format.md#처리-흐름의-순서-정하기)에서 "요청 형식"까지는 요청 검증, 그 뒤는 비즈니스 검증입니다.

| 구분 | 무엇을 보는가 | 위치 | 방법 |
|---|---|---|---|
| 요청 검증 | 요청만 보고 알 수 있는 것: 필수 값, 길이, 개수, 숫자 범위, 형식(패턴 · 이메일 · 날짜) | Controller 계층 (요청 DTO, 요청 파라미터 · 헤더) | Bean Validation 어노테이션 |
| 비즈니스 검증 | 저장된 것 · 상태 · 외부 정보 · 여러 값의 관계가 필요한 것: 존재 여부, 본인 것인지, 상태, 한도, 기한, 중복 요청 | Application Service · Aggregate · Value Object · Domain Service | 코드 (에러 코드를 담은 예외) |

**요청 검증 (Controller)**

- Spring 기준으로 **현업에서 많이 쓰는 표준 어노테이션을 먼저** 씁니다.
  - 값 있음: `@NotNull`, `@NotBlank`(문자열), `@NotEmpty`(목록)
  - 길이 · 개수: `@Size(min, max)`
  - 숫자: `@Min`, `@Max`, `@Positive`, `@PositiveOrZero`, `@DecimalMin`, `@DecimalMax`
  - 형식: `@Pattern`, `@Email`
  - 날짜: `@Past`, `@PastOrPresent`, `@Future`, `@FutureOrPresent`
  - 적용: 요청 본문은 `@Valid @RequestBody`, 목록 안의 객체는 `@Valid`, 파라미터 · 헤더는 Controller에 `@Validated`
- 표준 어노테이션으로 나타낼 수 없을 때만 커스텀 제약(`@Constraint` + `ConstraintValidator`)을 만듭니다. 예: 목록 안 상품 ID가 겹치지 않음. 커스텀 제약도 요청만 보고 판단하는 것이어야 합니다. 저장소 조회가 필요하면 비즈니스 검증입니다.
- 어노테이션의 `message`에는 requirements의 **에러 코드**를 적고, 예외 핸들러(`@RestControllerAdvice`)가 `MethodArgumentNotValidException` · `HandlerMethodValidationException`(파라미터 · 헤더)을 그 에러 코드의 상태 · 메시지로 바꿉니다. 메시지는 requirements와 글자까지 같습니다.
- **여러 위반이 겹치면 requirements 순서상 앞선 하나만 응답합니다.** Bean Validation은 위반을 모두 모으므로, 핸들러가 기준 순서대로 정한 에러 코드 목록에서 가장 앞선 것을 고릅니다(또는 `@GroupSequence`로 순서를 정합니다). 이 순서를 02의 Controller 컴포넌트에 씁니다.
- 프로젝트가 Spring이 아니면 그 프레임워크에서 같은 역할을 하는 표준 방식을 씁니다. 기존 코드가 다른 방식으로 요청을 검증하고 있으면 그 방식을 따르고, 01에 근거를 씁니다.

**비즈니스 검증 (Application Service · Domain)**

- 규모가 작음이면 서비스 메서드 안에 흐름 순서대로 둡니다.
- 규모가 보통 이상이면 불변식과 상태 전이 조건은 Aggregate · Value Object가 지키고, 조회가 필요한 확인(존재, 본인 것, 중복 요청)은 Application Service가 불러오면서 합니다. 여러 Aggregate나 외부 정보를 함께 봐야 하는 확인만 Domain Service에 둡니다.
- Controller에서 저장소를 조회하거나 상태를 확인하지 않습니다. 반대로 요청 형식 확인을 서비스로 미루지 않습니다.

## design.md (목차)

```markdown
# Technical Design Document

## Overview

본 문서는 <시스템> 에 **<기능>** 을 추가하기 위한 기술 설계를 정의합니다. <2~4문장 요약>

요구사항은 [requirements.md](requirements.md)에 있으며, 이 문서의 `Requirements N.M`은 그 문서의 Requirement N, 기준 M을 가리킵니다.

### 설계 목표

1. **<목표>**: <설명>
2. ...

## 문서 구성

| 문서 | 내용 |
|---|---|
| [아키텍처](design/01-architecture.md) | Architecture |
| [컴포넌트와 인터페이스](design/02-components.md) | Components and Interfaces |
| [데이터 모델 · API](design/03-data-models.md) | Data Models |
| [에러 처리](design/04-error-handling.md) | Error Handling |
| [테스트 전략](design/05-testing.md) | Testing Strategy |
| [보안 · 성능](design/06-security-performance.md) | Security, Performance Optimization |
| [정확성 속성](design/07-correctness-properties.md) | Property-Based Testing Analysis, Correctness Properties |
| [배포 · 설정](design/08-deployment-configuration.md) | Deployment, Configuration |
```

설계 목표는 3~6개로 둡니다. 각 목표는 "무엇을 지키는가"를 굵게 쓰고, 콜론 뒤에 한 줄로 설명합니다.

## 01 Architecture

```markdown
## Architecture

### 설계 규모

**규모: 작음 | 보통 | 큼**   ← 셋 중 하나

| 신호 | 이 기능 | 칸 |
|---|---|---|
| 상태 | <상태와 전이 요약 (Requirements N.M)> | <작음/보통/큼> |
| 항상 지켜야 할 규칙 | ... | ... |
| 외부 시스템 | ... | ... |
| 다른 도메인 | ... | ... |
| 응답 뒤 처리 | ... | ... |
| 동시에 겹치는 요청 | ... | ... |

<쓰는 것과 쓰지 않는 것 한두 줄. 국소 보강, 기존 구조를 따르는 부분>

### 도메인 경계
<이 기능이 속한 도메인과, 다른 도메인과의 관계>

| 상대 도메인 | 관계 | 연동 방식 |
|---|---|---|
| <도메인> | <이 기능이 읽음 / 바꿈 / 반응함> | <직접 조회 / 포트 + 어댑터 / 번역 계층 / 이벤트> |

### 시스템 아키텍처
<기존 구조에 무엇이 추가되는지 한 문장>
(ASCII 레이어 다이어그램: Presentation / Service / Adapter / Persistence / Database 등 프로젝트의 실제 레이어)

### 아키텍처 레이어 설명

#### 1. <Layer> (<한글 이름>)
- <책임>

### 처리 흐름별 트랜잭션 경계   ← 상태를 바꾸는 흐름이 있을 때
(흐름별로 TX / 외부 호출 단계를 코드 블록으로)
```

- `### 설계 규모`와 `### 도메인 경계`는 필수입니다. 판단 방법은 [설계 규모와 DDD](#설계-규모와-ddd)를 따릅니다.
- `**규모: …**` 줄에는 `작음`, `보통`, `큼` 중 하나를 씁니다.
- 다른 도메인과 주고받는 것이 없으면 `### 도메인 경계`에 "해당 없음 — <이유>"라고 씁니다.
- 다이어그램의 박스 이름은 02의 컴포넌트 이름과 같게 씁니다.
- 외부 시스템 호출과 상태 변경의 순서·경계를 여기서 정합니다. 이 경계가 requirements의 "항상 지켜야 할 규칙"을 어떻게 보장하는지 한 줄씩 덧붙입니다.

## 02 Components and Interfaces

~~~markdown
## Components and Interfaces

### 1. <Component Name>

<한두 문장: 무엇을 담당하는지, 트랜잭션·의존성의 특이점>

**역할:** <Application Service | Aggregate | Value Object | Domain Service | Repository | Adapter | 진입점 …> — <분리 조건 번호와 이유>

```<프로젝트 언어>
<인터페이스 또는 핵심 메서드. 처리 순서는 문서 주석에 1. 2. 3. 으로>
```

**구현 책임:**
- <책임>
~~~

- 번호는 1부터 연속입니다.
- `**역할:**` 줄에는 DDD 구성 요소 이름과, 따로 둔 이유([컴포넌트 나누기](#컴포넌트-나누기)의 분리 조건)를 씁니다. 규모가 작음이면 "서비스 — 흐름 전체"처럼 짧게 씁니다.
- 컴포넌트 수는 규모 표의 기준을 따릅니다. 넘으면 늘어난 컴포넌트마다 분리 조건이 분명해야 합니다.
- 규모가 보통 이상이면 상태 전이와 불변식은 Aggregate 메서드에 둡니다. Application Service는 불러오기 → Aggregate 메서드 호출 → 저장 · 외부 호출의 순서만 갖습니다.
- 컴포넌트 순서는 **요청이 흐르는 순서**입니다: 진입점 → 조율 → 검증 → 외부 연동 → 저장 → 조회 → 부가 흐름(취소, 배치).
- 코드 블록은 프로젝트의 실제 언어·프레임워크 관례를 따릅니다.
- 메서드 안의 확인 순서는 requirements 처리 흐름 순서와 같아야 합니다. 문서 주석의 단계(`1. 2. 3.`)도 처리 흐름 순서대로 쓰고, 단계마다 기준 번호를 덧붙이면 읽기 쉽습니다 (예: `1. 주문 항목 검증 (1.2 → 1.3 → 1.4)`).
- 처리 흐름이 여러 메서드·컴포넌트에 걸치면, 호출 순서대로 읽었을 때 기준 번호가 이어지게 나눕니다. 한 기준을 두 곳에 나눠 구현하지 않습니다.
- 기존 컴포넌트를 바꾸는 경우 이름 뒤에 `(변경)`을 붙이고, **바뀌는 부분만** 코드로 보여 주되 "기존 그대로"를 주석으로 표시합니다.

## 03 Data Models

```markdown
## Data Models

### Aggregates                ← 필수
| Aggregate | Root | 함께 묶이는 것 | 지키는 규칙 |
|---|---|---|---|
| <이름> | `<Root 엔티티>` | <엔티티 · Value Object> | Requirements N.M, ... |

### Value Objects            ← 규칙이나 계산이 있는 값이 있을 때
### Domain Entities
#### <Entity> Entity
### Repositories            ← 저장소가 있을 때
### DTOs (Data Transfer Objects)
#### <Name> DTO
### Enums
(상태 전이 그림, 상태 짝 표)
### 도메인 용어 ↔ 코드        ← 필수
| 도메인 용어 | 코드 |
### API Endpoints           ← 외부에 공개하는 인터페이스가 있을 때
#### 1. <유스케이스>
(요청/응답 예시. 응답에는 상태 코드와 본문)
### Database Schema (<DB>)   ← 저장 구조가 있을 때
```

- **`### Aggregates`는 필수**입니다.
  - 규모가 작음이면 "해당 없음 — 설계 규모 작음: <이유>"라고 씁니다.
  - 보통 이상이면 표를 씁니다. `지키는 규칙`에는 그 Aggregate가 지키는 "항상 지켜야 할 규칙"과 상태 전이 기준을 `Requirements N.M`으로 적습니다.
  - Aggregate는 한 트랜잭션에서 함께 일관돼야 하는 것만 묶습니다. 다른 Aggregate는 객체가 아니라 ID로 참조합니다.
- **`### 도메인 용어 ↔ 코드`는 필수**입니다. requirements Glossary의 모든 용어가 이 표의 첫 열에 있어야 합니다. 코드 이름은 [이름 짓기](#이름-짓기)를 따릅니다.
- API 예시의 값은 05의 테스트 기준 데이터와 같은 값을 씁니다.

## 04 Error Handling

```markdown
## Error Handling

### 에러 처리 전략
#### 1. 계층별 예외 처리
#### 2. 에러 코드
#### 3. 예외 핸들러
#### 4. 로깅 전략
```

- `#### 1. 계층별 예외 처리`에는 Controller 계층의 요청 검증(어떤 기준을 어떤 어노테이션으로, 여러 위반일 때 고르는 순서)과 Service · Domain 계층의 비즈니스 검증을 나눠 씁니다([검증 위치](#검증-위치)).
- 에러 코드 정의의 메시지는 requirements `메시지:`와 **글자까지 같아야** 합니다. 자리표시자(`{상품 ID}`)를 어떻게 채우는지 함께 씁니다.
- 로깅 전략 표에는 requirements `로그:` 항목을 모두 옮깁니다.

## 05 Testing Strategy

```markdown
## Testing Strategy

### 테스트 전략 개요
#### 1. 테스트 계층            (유닛 / 통합 / E2E: 대상 · 도구 · 테스트 묶음)
#### 2. 기준 ↔ 테스트 계층      ← 필수
#### 3. 에러 ↔ E2E 시나리오
#### 4. 테스트 지원 코드         (도메인 용어로 된 given / then 도우미, 안내 · 거절 사유 목록)
#### 5. <동시성 등 추가 테스트>
#### N. 테스트 기준 데이터       ← 필수
#### N. 주요 테스트 시나리오      (Given / When / Then)
```

- 테스트 규칙은 [추적 규칙](../traceability.md#테스트)을 따릅니다. 도메인은 유닛, Application Service는 통합, Controller · API는 E2E입니다.
- **테스트 계층**: 계층마다 대상, 도구(실제로 도는 것과 바꾸는 것), 테스트 묶음 이름을 씁니다. 프로젝트 구조가 다르면 계층 이름을 프로젝트에 맞게 정합니다.
- **기준 ↔ 테스트 계층은 필수**입니다. 모든 기준이 한 행에 들어갑니다. 판단 위치는 02의 컴포넌트 · 메서드와 같아야 합니다.

  | 기준 | 판단 위치 | 테스트 계층 | 테스트 묶음 |
  |---|---|---|---|
  | 6.5 ~ 6.12 | `Payment.startApproval()` | 유닛 | `PaymentTest` |
  | 6.15 ~ 6.23 | `PaymentConfirmService` | 통합 | `PaymentConfirmServiceIntegrationTest` |
  | 6.1, 6.2, 6.26 | `PaymentController` | E2E | `OrderPaymentE2ETest` |

- **에러 ↔ E2E 시나리오**: 04의 에러 코드마다 응답 코드를 확인하는 E2E 시나리오를 하나 이상 적습니다.

  | 에러 코드 | 응답 | E2E 시나리오 |
  |---|---|---|
  | `AMOUNT_MISMATCH` | `400` | `R6-5 회원이 주문 금액과 다른 금액으로 결제하면 결제할 수 없다고 안내받는다` |

- **테스트 지원 코드**: 시나리오에서 부르는 도움 함수 · 객체를 도메인 용어 이름으로 적고, 무엇을 확인하는지 씁니다. 회원이 받는 안내 · 거절 사유 목록은 04의 에러 코드 · 메시지와 1:1입니다.
- **테스트 기준 데이터는 필수**입니다. 고정 시각, 사용자, 기준 데이터 표, 기본 시나리오 값을 씁니다. 경계값 기준(예: 20개/21개)마다 그 값을 만드는 데이터가 있어야 합니다.
- 외부 시스템은 가짜 구현(fake)으로, 시간은 고정 시계로 테스트한다고 명시합니다.
- **주요 테스트 시나리오**는 Given / When / Then으로 씁니다. 결과가 같은 경계값 · 조건은 `시나리오 개요` + `예` 표로 묶습니다.

## 06 Security / Performance Optimization

- Security: requirements의 "본인 것만", "위변조 방지" 같은 규칙을 어떻게 보장하는지 씁니다.
- Performance Optimization: 인덱스, 외부 호출 격리, 배치 크기처럼 요구사항 수치를 지키는 방법을 씁니다.

## 07 Property-Based Testing Analysis / Correctness Properties

```markdown
## Property-Based Testing Analysis

### PBT Applicability Assessment
<이 기능에 Property 검증이 맞는지, 어떤 도구로 할지 한 문단>

### Acceptance Criteria Testing Prework

1.2 <기준의 굵은 규칙 문장 그대로>
  Thoughts: <왜 Property / Example 인지>
  Classification: PROPERTY
  Test Strategy: <어떻게 검증할지>

**Property Reflection:**

1. **1.16과 5.9**는 같은 규칙 → 하나로 통합

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: <이름>

*For any* <입력 조건>, <성립해야 하는 결과>

**Validates: Requirements 1.2**
```

- Prework 항목은 `N.M <기준 문장>` 한 줄 + 두 칸 들여쓴 `Thoughts:` / `Classification:` / `Test Strategy:` 세 줄입니다.
- 제목은 requirements 기준의 굵은 문장과 같게 씁니다(끝 마침표 제외). 줄여 쓸 때는 기준 문장에 있는 단어만 씁니다. 예: "주문이 접수되면 주문, 주문 항목, 결제가 함께 만들어진다" → "주문, 주문 항목, 결제가 함께 만들어진다"
- Classification은 `PROPERTY` / `EXAMPLE` / `EDGE_CASE` 중 하나입니다. 다른 기준과 합칠 때는 같은 줄에 `(N.M과 통합)`을 덧붙입니다.
- `PROPERTY`로 분류한 기준은 반드시 어떤 Property의 `Validates`에 들어갑니다.
- Property 번호는 1부터 연속이고, 각각 `*For any*` 문장과 `**Validates: Requirements …**` 줄이 있습니다. 범위는 `6.1 ~ 6.25`, 여럿은 `1.9, 1.13`으로 씁니다.

## 08 Deployment / Configuration

- Deployment: 마이그레이션, 배포 순서, 하위 호환, 멀티 인스턴스 고려
- Configuration: 추가·변경되는 설정과 테스트 설정, 의존성. 실제 설정 파일 형식으로 씁니다.

## 기술 정보 찾기

design을 쓰기 전에 다음 순서로 프로젝트의 기술 맥락을 확인합니다. 플러그인은 특정 언어·프레임워크를 가정하지 않습니다.

1. 설정 `techContext`에 적힌 문서 (기본 `CLAUDE.md`, `README.md`)
2. 빌드·의존성 파일 (`build.gradle*`, `pom.xml`, `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml` 등)
3. 같은 종류의 기존 코드 (컨트롤러·서비스·저장소·테스트 한두 개씩)
4. 이 세션에서 쓸 수 있는 기술 전용 스킬 (아키텍처, 프레임워크, 테스트 관련)
5. 그래도 정할 수 없으면 사용자에게 묻습니다. 추측으로 정하지 않습니다.

찾은 근거(어느 파일을 보고 정했는지)는 01 Architecture 첫 문단이나 08 Configuration에 남깁니다.

## 검사 규칙

| ID | 수준 | 내용 |
|---|---|---|
| DES000 | 오류 | 채우지 않은 템플릿 자리표시자(`<...>`) |
| DES001 | 오류 | design.md 첫 줄, `## Overview` → `## 문서 구성`, `### 설계 목표` |
| DES002 | 오류 | 문서 구성 표 8행이 정해진 파일과 순서대로, 각 파일 존재 |
| DES003 | 오류 | 본문 파일 첫 줄 제목, `> [design.md](../design.md)로 돌아가기` |
| DES004 | 오류 | 본문 파일의 `##` 섹션 구성과 순서 |
| DES005 | 오류 | 02 컴포넌트 번호 1부터 연속 |
| DES006 | 오류 | 필수 하위 섹션: 도메인 용어 ↔ 코드, 기준 ↔ 테스트 계층, 테스트 기준 데이터, PBT Applicability Assessment, Testing Prework, Property Reflection, Correctness Properties 머리말 |
| DES007 | 오류 | Prework 항목의 세 줄과 Classification 값 |
| DES008 | 경고 | Prework 제목이 기준 문장과 다름 (기준 문장에 없는 단어가 있음) |
| DES009 | 오류 | Property 번호 연속, `*For any*`, `**Validates: …**` |
| DES010 | 오류 | Prework·Validates 가 없는 기준을 참조 |
| DES011 | 경고 | PROPERTY 로 분류했는데 어떤 Property 도 검증하지 않음 |
| DES012 | 오류 | 01 `### 설계 규모`에 `**규모: 작음 \| 보통 \| 큼**` 줄이 없거나 값이 다름 |
| DES013 | 경고 | 02 컴포넌트 수가 규모 기준을 넘음 (작음 4개 이상, 보통 8개 이상) — 과하게 나눴는지 확인 |
| DES014 | 경고 | 규모와 Aggregates가 맞지 않음 (보통 · 큼인데 "해당 없음", 작음인데 Aggregate 표가 있음) |
| DES015 | 오류 | Aggregates 표의 `Requirements N.M`이 requirements에 없음 |
| DES016 | 경고 | Glossary 용어가 03 `### 도메인 용어 ↔ 코드` 표의 첫 열에 없음 |
| DES017 | 오류/경고 | 05 `기준 ↔ 테스트 계층` 표가 requirements에 없는 기준을 참조(오류) / 표에 없는 기준이 있음(경고) |

DES006의 필수 하위 섹션에는 01 `### 설계 규모` · `### 도메인 경계`, 03 `### Aggregates`도 들어갑니다.
