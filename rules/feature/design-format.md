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

## 설계 방식

플러그인은 아키텍처를 정하지 않습니다. 계층 · 모듈 구조, DDD를 쓸지, 이름 스타일, 검증 · 예외 처리 방식, 테스트 종류는 **프로젝트 convention**을 따릅니다([convention 규칙](../convention.md)). convention이 없으면 design을 쓰기 전에 먼저 만듭니다.

design은 그 구조 안에서 **requirements의 기준을 코드 어디서 지키는지** 정합니다. 플러그인이 정하는 것은 명세와 코드를 잇는 다음 규칙뿐입니다.

1. **기준 하나는 코드 한 곳에서 판단합니다.** 한 기준을 두 곳에 나눠 구현하지 않습니다.
2. **확인 순서는 requirements 처리 흐름 순서와 같습니다.** 여러 메서드 · 컴포넌트에 걸치면 호출 순서대로 읽었을 때 기준 번호가 이어지게 나눕니다.
3. **여러 위반이 겹치면 requirements 순서상 앞선 하나만 응답합니다.** 검증 도구가 위반을 모두 모으면 기준 순서대로 하나를 고르는 방법을 02에 씁니다.
4. **에러 코드 · 메시지는 requirements와 글자까지 같습니다.**
5. **requirements에 없는 동작(새 거절, 새 상태, 새 응답)을 design에서 만들지 않습니다.**

## 이름 짓기

코드의 도메인 이름은 **requirements의 말**에서 옵니다. design 03의 `### 도메인 용어 ↔ 코드` 표가 그 대응표이고, implement는 이 표대로 이름을 짓습니다. design 본문(컴포넌트 설명, 구현 책임, 표)도 기술 용어보다 **비즈니스 용어**로 씁니다. 예: "레코드를 갱신" 대신 "주문을 취소 상태로 바꿈".

1. **도메인 개념은 Glossary 영문 표기를 씁니다.** 클래스, 필드, 변수, 매개변수 모두 같습니다. 예: 주문 (Order) → `Order`, `orderId`. 결제 기한 (Expires At) → `expiresAt`.
   - 같은 개념은 어디서나 같은 이름입니다. 동의어를 섞지 않습니다(예: `order`와 `purchase`).
   - **기존 코드에 같은 개념의 이름이 있으면 그 이름을 씁니다.** 예: 기존 `User`가 있으면 새 코드에서 `Member`를 만들지 않습니다. requirements Glossary가 이미 기존 이름을 따르므로, 둘이 다르면 requirements 보완 필요로 보고합니다.
   - Glossary에 없는 도메인 개념에 이름이 필요하면 코드에서 지어내지 않습니다. "requirements 보완 필요"로 보고하고 Glossary에 먼저 넣습니다.
2. **상태 값은 Glossary의 `ENUM` 값 그대로**입니다. 예: 결제 대기 (`PENDING_PAYMENT`) → `OrderStatus.PENDING_PAYMENT`
3. **03 표에 이름을 모두 적습니다.** Glossary 용어마다 코드 이름을 적고, 상태 묶음은 enum 이름을 적습니다. 새 이름이 생기면 표를 먼저 고칩니다.

접미사(`…Service`, `…Request` 등), 메서드 이름 스타일, 피할 이름 같은 그 밖의 이름 규칙은 convention을 따릅니다.

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

### 따른 convention   ← 필수

| 항목 | 따른 규칙 | 근거 문서 |
|---|---|---|
| <구조 · 이름 · 예외 · 검증 · 테스트 등> | <따른 규칙> | <convention 문서 경로> |

<이 기능에서 정한 설계 결정 한두 줄>

### 연동 관계   ← 다른 기능 · 외부 시스템과 주고받는 것이 있을 때

| 상대 | 관계 | 연동 방식 |
|---|---|---|
| <기능 · 외부 시스템> | <읽음 / 바꿈 / 반응함> | <convention의 방식> |

### 시스템 아키텍처
<기존 구조에 무엇이 추가되는지 한 문장>
(ASCII 다이어그램: convention의 계층 · 모듈 구조대로)

### 구조 설명

#### 1. <계층 · 모듈> (<한글 이름>)
- <책임>

### 처리 흐름별 트랜잭션 경계   ← 상태를 바꾸는 흐름이 있을 때
(흐름별로 TX / 외부 호출 단계를 코드 블록으로)
```

- `### 따른 convention`에는 design이 따른 convention의 **설계 규칙**을 한 행씩 적습니다. 코드 스타일 · 포맷 · 커밋 규칙은 적지 않습니다.
- 다이어그램의 박스 이름은 02의 컴포넌트 이름과 같게 씁니다.
- 외부 시스템 호출과 상태 변경의 순서·경계를 여기서 정합니다. 이 경계가 requirements의 "항상 지켜야 할 규칙"을 어떻게 보장하는지 한 줄씩 덧붙입니다.

## 02 Components and Interfaces

~~~markdown
## Components and Interfaces

### 1. <Component Name>

<한두 문장: 무엇을 담당하는지, 트랜잭션·의존성의 특이점>

**구현 책임:**
- <책임>
~~~

- 번호는 1부터 연속입니다.
- 컴포넌트 순서는 **요청이 흐르는 순서**입니다: 진입점 → 조율 → 검증 → 외부 연동 → 저장 → 조회 → 부가 흐름(취소, 배치).
- 코드 블록은 프로젝트의 실제 언어·프레임워크 관례를 따릅니다.
- 컴포넌트를 어떻게 나눌지(계층, 모듈, 역할)는 convention을 따릅니다.
- 메서드 안의 확인 순서는 requirements 처리 흐름 순서와 같아야 합니다. 문서 주석의 단계(`1. 2. 3.`)도 처리 흐름 순서대로 쓰고, 단계마다 기준 번호를 덧붙이면 읽기 쉽습니다 (예: `1. 주문 항목 검증 (1.2 → 1.3 → 1.4)`).
- 처리 흐름이 여러 메서드·컴포넌트에 걸치면, 호출 순서대로 읽었을 때 기준 번호가 이어지게 나눕니다. 한 기준을 두 곳에 나눠 구현하지 않습니다.
- 기존 컴포넌트를 바꾸는 경우 이름 뒤에 `(변경)`을 붙이고, **바뀌는 부분만** 코드로 보여 주되 "기존 그대로"를 주석으로 표시합니다.

## 03 Data Models

```markdown
## Data Models

### Domain Models            ← convention의 구조대로 (Aggregate, Entity, 모델 등)
#### <Name>
### DTOs (Data Transfer Objects)   ← 있을 때
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

- 도메인 모델의 하위 섹션 이름과 나누는 방식은 convention을 따릅니다. 예: DDD면 `### Aggregates` · `### Value Objects` · `### Domain Entities`, 3 layer면 `### Domain Entities`
- **`### 도메인 용어 ↔ 코드`는 필수**입니다. requirements Glossary의 모든 용어가 이 표의 첫 열에 있어야 합니다. 코드 이름은 [이름 짓기](#이름-짓기)를 따릅니다.
- API 예시의 값은 05의 테스트 기준 데이터와 같은 값을 씁니다.

## 04 Error Handling

```markdown
## Error Handling

### 에러 처리 전략
#### 1. 예외 처리 방식
#### 2. 에러 코드
#### 3. 예외 핸들러
#### 4. 로깅 전략
```

- `#### 1. 예외 처리 방식`에는 convention의 예외 · 에러 응답 방식대로, 기준마다 어디서 거절하는지와 여러 위반이 겹칠 때 하나를 고르는 순서를 씁니다.
- 에러 코드 정의의 메시지는 requirements `메시지:`와 **글자까지 같아야** 합니다. 자리표시자(`{상품 ID}`)를 어떻게 채우는지 함께 씁니다.
- 로깅 전략 표에는 requirements `로그:` 항목을 모두 옮깁니다.

## 05 Testing Strategy

```markdown
## Testing Strategy

### 테스트 전략 개요
#### 1. 테스트 종류            (convention의 테스트 종류: 대상 · 도구 · 테스트 묶음)
#### 2. 기준 ↔ 테스트          ← 필수
#### 3. 에러 ↔ 응답 테스트
#### 4. 테스트 지원 코드         (도메인 용어로 된 given / then 도우미, 안내 · 거절 사유 목록)
#### 5. <동시성 등 추가 테스트>
#### N. 테스트 기준 데이터       ← 필수
#### N. 주요 테스트 시나리오      (Given / When / Then)
```

- 테스트 규칙은 [추적 규칙](../traceability.md#테스트)을 따릅니다.
- **테스트 종류**: 어떤 코드를 어떤 테스트(예: 유닛 · 통합 · E2E)로 확인할지는 convention을 따릅니다. 종류마다 대상, 도구(실제로 도는 것과 바꾸는 것), 테스트 묶음 이름을 씁니다.
- **기준 ↔ 테스트는 필수**입니다. 모든 기준이 한 행에 들어갑니다. 기준은 그 판단을 하는 코드를 확인하는 테스트가 맡고, 판단 위치는 02의 컴포넌트 · 메서드와 같아야 합니다.

  | 기준 | 판단 위치 | 테스트 종류 | 테스트 묶음 |
  |---|---|---|---|
  | 6.5 ~ 6.12 | `Payment.startApproval()` | 유닛 | `PaymentTest` |
  | 6.1, 6.2, 6.26 | `PaymentController` | E2E | `OrderPaymentE2ETest` |

- **에러 ↔ 응답 테스트**: 04의 에러 코드마다 회원이 실제로 받는 응답(응답 코드 · 에러 코드 · 메시지)을 확인하는 시나리오를 하나 이상 적습니다.

  | 에러 코드 | 응답 | 시나리오 |
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

design을 쓰기 전에 다음 순서로 프로젝트의 기술 맥락을 확인합니다. 플러그인은 특정 언어 · 프레임워크 · 아키텍처를 가정하지 않습니다.

1. **convention 문서 중 설계에 관한 것** (`docs/convention/` 폴더와 `convention.md` · `*-convention.md` 파일. 찾는 곳은 [convention 규칙](../convention.md#위치)). 가장 우선합니다. 없으면 [convention 규칙](../convention.md)의 "없을 때"를 따라 먼저 만듭니다.
2. 설정 `techContext`에 적힌 문서 (기본 `CLAUDE.md`, `README.md`)
3. 빌드·의존성 파일 (`build.gradle*`, `pom.xml`, `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml` 등)
4. 같은 종류의 기존 코드 (진입점 · 서비스 · 저장소 · 테스트 한두 개씩)
5. 그래도 정할 수 없으면 사용자에게 묻습니다. 추측으로 정하지 않습니다.

따른 convention은 01 `### 따른 convention` 표에, 그 밖의 근거(어느 파일을 보고 정했는지)는 01 첫 문단이나 08 Configuration에 남깁니다.

## 검사 규칙

| ID | 수준 | 내용 |
|---|---|---|
| DES000 | 오류 | 채우지 않은 템플릿 자리표시자(`<...>`) |
| DES001 | 오류 | design.md 첫 줄, `## Overview` → `## 문서 구성`, `### 설계 목표` |
| DES002 | 오류 | 문서 구성 표 8행이 정해진 파일과 순서대로, 각 파일 존재 |
| DES003 | 오류 | 본문 파일 첫 줄 제목, `> [design.md](../design.md)로 돌아가기` |
| DES004 | 오류 | 본문 파일의 `##` 섹션 구성과 순서 |
| DES005 | 오류 | 02 컴포넌트 번호 1부터 연속 |
| DES006 | 오류 | 필수 하위 섹션: 도메인 용어 ↔ 코드, 기준 ↔ 테스트, 테스트 기준 데이터, PBT Applicability Assessment, Testing Prework, Property Reflection, Correctness Properties 머리말 |
| DES007 | 오류 | Prework 항목의 세 줄과 Classification 값 |
| DES008 | 경고 | Prework 제목이 기준 문장과 다름 (기준 문장에 없는 단어가 있음) |
| DES009 | 오류 | Property 번호 연속, `*For any*`, `**Validates: …**` |
| DES010 | 오류 | Prework·Validates 가 없는 기준을 참조 |
| DES011 | 경고 | PROPERTY 로 분류했는데 어떤 Property 도 검증하지 않음 |
| DES016 | 경고 | Glossary 용어가 03 `### 도메인 용어 ↔ 코드` 표의 첫 열에 없음 |
| DES017 | 오류/경고 | 05 `기준 ↔ 테스트` 표가 requirements에 없는 기준을 참조(오류) / 표에 없는 기준이 있음(경고) |

