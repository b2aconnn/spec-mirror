# Bugfix Design Document

## Overview

<버그 요약 한 문장, 고치는 방향 한두 문장, 바꾸지 않는 것 한 문장>

버그 분석은 [bugfix.md](bugfix.md)에 있으며, 이 문서의 `Requirements N.M`은 그 문서의 항목 N.M을 가리킵니다.

## Glossary

- **Bug Condition (C)**: <버그가 나타나는 입력과 상태>
- **Property (P)**: <C에서 고친 코드가 만족해야 하는 동작>
- **Preservation**: <C가 아닌 입력에서 바뀌면 안 되는 동작> (bugfix.md 3.1 ~ 3.N)
- **`<코드 위치>`**: <이 버그와 관련된 역할>

## Bug Details

### Bug Condition

<버그가 나타나는 조건 설명>

**Formal Specification:**

~~~
FUNCTION isBugCondition(input)
  INPUT: input = <입력>
  OUTPUT: boolean

  RETURN <조건>
END FUNCTION
~~~

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

먼저 고치기 전 코드에서 버그를 재현하는 반례를 찾아 원인 분석을 확인하고, 고친 뒤 버그 조건에서는 기대 동작을, 그 밖에서는 기존 동작을 확인합니다.

### Exploratory Bug Condition Checking

**Goal:** 고치기 전 코드에서 반례를 찾아 원인 분석을 확인하거나 반박합니다.

**Test Cases:**
1. **<경우>**: <입력> (고치기 전 실패 예상)

**Expected Counterexamples:**
- <예상되는 잘못된 결과>

### Fix Checking

~~~
FOR ALL input WHERE isBugCondition(input) DO
  result := fixed(input)
  ASSERT expectedBehavior(result)
END FOR
~~~

### Preservation Checking

~~~
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT original(input) = fixed(input)
END FOR
~~~

**Test Cases:**
1. **<유지할 동작>**: <확인 방법>
