# bugfix design.md 작성 규칙

버그 명세의 design은 **원인을 코드에서 찾고, 고치는 범위를 정하고, 무엇으로 확인할지** 정하는 문서입니다. 기능 명세의 design과 달리 **design.md 한 파일**입니다.

- 위치: `<specRoot>/<버그 이름>/design.md` (`design/` 폴더를 만들지 않습니다)
- `Requirements N.M`은 bugfix.md의 항목 N.M입니다. 기대 동작은 `2.M`, 유지할 동작은 `3.M`입니다.
- 정답 예제: `examples/confirm-recheck-mismatch/design.md`

## 섹션 (순서 고정)

| `##` 섹션 | 필수 `###` (순서 고정) | 쓰는 것 |
|---|---|---|
| Overview | — | 버그 한 문장, 고치는 방향, 바꾸지 않는 것. 끝에 bugfix.md 링크와 `Requirements N.M` 안내 |
| Glossary | — | Bug Condition (C), Property (P), Preservation 정의 + 관련 코드 위치 |
| Bug Details | Bug Condition → Examples | 버그 조건 설명과 `isBugCondition` 의사 코드, 구체적인 입력 예 |
| Expected Behavior | Preservation Requirements | 유지할 동작 목록과 범위 |
| Hypothesized Root Cause | — | 원인 목록 (확인됨 / 가설) |
| Correctness Properties | — | Bug Condition Property, Preservation Property |
| Fix Implementation | Changes Required | 고칠 파일·함수·변경 내용, 바꾸지 않는 것 |
| Testing Strategy | Validation Approach → Exploratory Bug Condition Checking → Fix Checking → Preservation Checking | 고치기 전 반례 찾기, 고친 뒤 확인, 보존 확인 |

`###` 하위 섹션은 위 필수 목록 외에 더 둘 수 있습니다(예: Testing Strategy의 `### 테스트 이름`).

## 형식

~~~markdown
# Bugfix Design Document

## Overview

<버그 요약 한 문장, 고치는 방향 한두 문장, 바꾸지 않는 것 한 문장>

버그 분석은 [bugfix.md](bugfix.md)에 있으며, 이 문서의 `Requirements N.M`은 그 문서의 항목 N.M을 가리킵니다.

## Glossary

- **Bug Condition (C)**: <버그가 나타나는 입력과 상태>
- **Property (P)**: <C에서 고친 코드가 만족해야 하는 동작>
- **Preservation**: <C가 아닌 입력에서 바뀌면 안 되는 동작>
- **`<코드 위치>`**: <이 버그와 관련된 역할>

## Bug Details

### Bug Condition

<버그가 나타나는 조건>

**Formal Specification:**

```
FUNCTION isBugCondition(input)
  INPUT: input = <입력>
  OUTPUT: boolean

  RETURN <조건>
END FUNCTION
```

### Examples

- <입력> → 기대: <올바른 결과> / 실제: <지금 결과>
- (C 아님) <입력> → <지금 결과 그대로>

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- <유지할 동작> (Requirements 3.1)

**Scope:**
`isBugCondition`이 거짓인 모든 입력은 고치기 전과 같은 결과를 보여야 합니다.

## Hypothesized Root Cause

1. **<원인>** (확인됨 | 가설)
   - <근거: 코드 위치와 동작>

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Bug Condition - <이름>

*For any* `isBugCondition(input)`이 참인 입력에 대해, 고친 코드는 <기대 동작>

**Validates: Requirements 2.1**

### Property 2: Preservation - <이름>

*For any* `isBugCondition(input)`이 거짓인 입력에 대해, 고친 코드의 결과는 고치기 전과 같다

**Validates: Requirements 3.1**

## Fix Implementation

### Changes Required

**File:** `<경로>`

**Function:** `<함수>`

**Specific Changes:**

1. **<변경>**: <설명>

## Testing Strategy

### Validation Approach
### Exploratory Bug Condition Checking
### Fix Checking
### Preservation Checking
~~~

## 섹션별 규칙

### Bug Details

- `### Bug Condition`에는 **`FUNCTION isBugCondition(input)` 의사 코드 블록**이 있어야 합니다. 이 함수가 참인 입력이 bugfix.md의 현재 동작(1.M)이고, 거짓인 입력이 유지할 동작(3.M)의 범위입니다.
- 조건은 코드에서 관찰할 수 있는 값으로 씁니다(호출 결과, 상태, 필드 값). "이상한 값이면" 같은 말은 쓰지 않습니다.
- `### Examples`에는 버그 조건 예와, 버그 조건이 **아닌** 가장 가까운 예를 함께 씁니다. 형식: `<입력> → 기대: … / 실제: …`, `(C 아님) <입력> → <결과 그대로>`

### Hypothesized Root Cause

- 원인마다 `N. **<원인>** (확인됨 | 가설)` 한 줄과, 근거(코드 위치와 그 코드가 하는 일)를 아래 항목으로 씁니다.
- **코드를 읽어 확인한 것만 "확인됨"**입니다. 확인하지 못했으면 "가설"이라고 쓰고, 탐색 테스트(tasks 1번)로 확인합니다.
- 직접 원인과 원인이 드러나는 경로가 다르면 둘 다 씁니다. 고치지 않는 쪽은 그 이유를 씁니다.

### Correctness Properties

- 머리말(*A property is …*)은 기능 design과 같습니다.
- Property는 두 종류뿐입니다. 이름이 종류를 밝힙니다.
  - `### Property N: Bug Condition - <이름>`: 버그 조건에서 고친 코드가 기대 동작을 만족합니다. **기대 동작(2.M)만** 검증합니다.
  - `### Property N: Preservation - <이름>`: 버그 조건 밖에서 고친 코드가 고치기 전과 같습니다. **유지할 동작(3.M)만** 검증합니다.
- 모든 기대 동작(2.M)은 어떤 Bug Condition Property가, 모든 유지할 동작(3.M)은 어떤 Preservation Property가 검증해야 합니다.
- 번호는 1부터 연속이고, 각각 `*For any*` 문장과 `**Validates: Requirements …**` 줄이 있습니다.

### Fix Implementation

- 고칠 곳마다 `**File:**`, `**Function:**`, `**Specific Changes:**`(번호 목록)를 씁니다.
- 코드 조각은 프로젝트의 실제 언어로 씁니다. 분기에 다는 `R{N}-{M}` 주석도 보여 줍니다.
- **바꾸지 않는 것**과 그 이유(어떤 유지할 동작을 지키기 위해서인지)를 씁니다. 고치는 범위를 최소로 유지합니다.

### Testing Strategy

| 하위 섹션 | 쓰는 것 |
|---|---|
| Validation Approach | "고치기 전 반례 확인 → 고친 뒤 확인" 두 단계 |
| Exploratory Bug Condition Checking | **Goal**, **Test Plan**, **Test Cases**(고치기 전 실패 예상), **Expected Counterexamples** |
| Fix Checking | `FOR ALL input WHERE isBugCondition(input)` 의사 코드와 확인할 결과 |
| Preservation Checking | `FOR ALL input WHERE NOT isBugCondition(input)` 의사 코드, 고치기 전 코드에서 먼저 통과시키는 방법, Test Cases |

테스트 이름은 [추적 규칙](../traceability.md#버그-명세)을 따릅니다. 기능 명세 기준과 연결된 동작은 그 기준의 `R{N}-{M}` 이름을 씁니다.

## 기술 정보 찾기

기능 design과 같습니다. [기능 design 규칙](../feature/design-format.md#기술-정보-찾기)의 순서대로 프로젝트에서 찾고, 추측으로 정하지 않습니다. 원인 분석은 **반드시 코드를 읽고** 씁니다.

## 검사 규칙

| ID | 수준 | 내용 |
|---|---|---|
| BDS000 | 오류 | 채우지 않은 템플릿 자리표시자(`<...>`) |
| BDS001 | 오류 | 첫 줄 `# Bugfix Design Document`, `##` 섹션 구성과 순서, `design/` 폴더 금지 |
| BDS002 | 오류 | 필수 `###` 하위 섹션과 순서 |
| BDS003 | 오류 | Bug Condition의 `FUNCTION isBugCondition(` 의사 코드 블록 |
| BDS004 | 오류 | Correctness Properties 머리말 |
| BDS005 | 오류 | Property 번호 연속, `*For any*`, `**Validates: …**` |
| BDS006 | 오류 | Validates가 bugfix.md에 없는 항목을 참조 |
| BDS007 | 오류 | Property 이름이 `Bug Condition - …` 또는 `Preservation - …` 이 아님 |
| BDS008 | 오류 | Bug Condition이 2.M 밖을, Preservation이 3.M 밖을 검증 |
| BDS009 | 오류 | 검증하는 Property가 없는 2.M · 3.M, 종류별 Property가 하나도 없음 |
| BDS010 | 오류 | Hypothesized Root Cause에 `N. **원인**` 항목이 없음 |
