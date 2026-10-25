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

### 시스템 아키텍처
<기존 구조에 무엇이 추가되는지 한 문장>
(ASCII 레이어 다이어그램: Presentation / Service / Adapter / Persistence / Database 등 프로젝트의 실제 레이어)

### 아키텍처 레이어 설명

#### 1. <Layer> (<한글 이름>)
- <책임>

### 처리 흐름별 트랜잭션 경계   ← 상태를 바꾸는 흐름이 있을 때
(흐름별로 TX / 외부 호출 단계를 코드 블록으로)
```

- 다이어그램의 박스 이름은 02의 컴포넌트 이름과 같게 씁니다.
- 외부 시스템 호출과 상태 변경의 순서·경계를 여기서 정합니다. 이 경계가 requirements의 "항상 지켜야 할 규칙"을 어떻게 보장하는지 한 줄씩 덧붙입니다.

## 02 Components and Interfaces

~~~markdown
## Components and Interfaces

### 1. <Component Name>

<한두 문장: 무엇을 담당하는지, 트랜잭션·의존성의 특이점>

```<프로젝트 언어>
<인터페이스 또는 핵심 메서드. 처리 순서는 문서 주석에 1. 2. 3. 으로>
```

**구현 책임:**
- <책임>
~~~

- 번호는 1부터 연속입니다.
- 컴포넌트 순서는 **요청이 흐르는 순서**입니다: 진입점 → 조율 → 검증 → 외부 연동 → 저장 → 조회 → 부가 흐름(취소, 배치).
- 코드 블록은 프로젝트의 실제 언어·프레임워크 관례를 따릅니다.
- 메서드 안의 확인 순서는 requirements 처리 흐름 순서와 같아야 합니다. 문서 주석의 단계(`1. 2. 3.`)도 처리 흐름 순서대로 쓰고, 단계마다 기준 번호를 덧붙이면 읽기 쉽습니다 (예: `1. 주문 항목 검증 (1.2 → 1.3 → 1.4)`).
- 처리 흐름이 여러 메서드·컴포넌트에 걸치면, 호출 순서대로 읽었을 때 기준 번호가 이어지게 나눕니다. 한 기준을 두 곳에 나눠 구현하지 않습니다.
- 기존 컴포넌트를 바꾸는 경우 이름 뒤에 `(변경)`을 붙이고, **바뀌는 부분만** 코드로 보여 주되 "기존 그대로"를 주석으로 표시합니다.

## 03 Data Models

```markdown
## Data Models

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

- **`### 도메인 용어 ↔ 코드`는 필수**입니다. requirements Glossary의 모든 용어가 이 표에 있어야 합니다.
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

- 에러 코드 정의의 메시지는 requirements `메시지:`와 **글자까지 같아야** 합니다. 자리표시자(`{상품 ID}`)를 어떻게 채우는지 함께 씁니다.
- 로깅 전략 표에는 requirements `로그:` 항목을 모두 옮깁니다.

## 05 Testing Strategy

```markdown
## Testing Strategy

### 테스트 전략 개요
#### 1. 인수 테스트 (Acceptance Tests)
(대상 / 도구 / Requirement ↔ 테스트 묶음 표 / 예시)
#### 2. <동시성·통합 등 추가 테스트>
#### N. 테스트 기준 데이터      ← 필수
#### N. 주요 테스트 시나리오
```

- 인수 테스트 규칙은 [추적 규칙](../traceability.md)을 따릅니다.
- **테스트 기준 데이터는 필수**입니다. 고정 시각, 사용자, 기준 데이터 표, 기본 시나리오 값을 씁니다. 경계값 기준(예: 20개/21개)마다 그 값을 만드는 데이터가 있어야 합니다.
- 외부 시스템은 가짜 구현(fake)으로, 시간은 고정 시계로 테스트한다고 명시합니다.

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
| DES006 | 오류 | 필수 하위 섹션: 도메인 용어 ↔ 코드, 테스트 기준 데이터, PBT Applicability Assessment, Testing Prework, Property Reflection, Correctness Properties 머리말 |
| DES007 | 오류 | Prework 항목의 세 줄과 Classification 값 |
| DES008 | 경고 | Prework 제목이 기준 문장과 다름 (기준 문장에 없는 단어가 있음) |
| DES009 | 오류 | Property 번호 연속, `*For any*`, `**Validates: …**` |
| DES010 | 오류 | Prework·Validates 가 없는 기준을 참조 |
| DES011 | 경고 | PROPERTY 로 분류했는데 어떤 Property 도 검증하지 않음 |
