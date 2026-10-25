# tasks.md 작성 규칙

tasks.md는 design을 **구현 순서**로 옮긴 계획입니다. 각 태스크는 어떤 기준을 구현하는지 `_Requirements_`로, 어떤 Property를 검증하는지 `**Property N**`으로 연결됩니다.

- 위치: `<specRoot>/<기능>/tasks.md`

## 형식

~~~markdown
# Implementation Plan: <기능 이름>

## Overview

<무엇을 구현하는지 2~3문장>

<구현 순서와 진행 방식 한 문단: 예) 공통 기반 → 도메인 → 기능별, 인수 테스트 먼저(Red) → 구현(Green)>

## Tasks

- [ ] 1. <상위 태스크>
  - <할 일>
  - _Requirements: 1.2, 1.3_

- [ ] 2. <하위 태스크가 있는 상위 태스크>
  - [ ] 2.1 인수 테스트 작성: <테스트 묶음 이름>
    - <검증할 시나리오>
    - _Requirements: 2.1 ~ 2.8_

  - [ ] 2.2 <구현 태스크>
    - <할 일>
    - _Requirements: 2.2, 2.3_

  - [ ]* 2.3 Property 테스트: <이름>
    - **Property 5: <design 의 Property 이름 그대로>**
    - **Validates: Requirements 2.6**

- [ ] 3. Checkpoint - <확인할 범위>
  - <확인 항목>
  - 모든 테스트 통과 확인

## Notes

- **인수 테스트 우선**: ...
- **Property 테스트**: `*` 표시된 태스크는 선택적입니다 ...

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] }
  ]
}
```
~~~

## 태스크 규칙

1. **줄 형식**
   - 상위: `- [ ] N. 제목`
   - 하위: 두 칸 들여쓰기 `  - [ ] N.M 제목`
   - 선택 태스크는 `]` 바로 뒤에 `*`: `- [ ]* N.M`
   - 진행 중은 `[-]`, 완료는 `[x]`입니다.
   - 체크 표시와 `  - 결과: …` 줄은 진행 기록입니다. 바꿔도 tasks 승인이 풀리지 않습니다.
2. **번호**
   - 상위는 0 또는 1부터 연속입니다.
   - 0번은 "요구사항 보완 확정"처럼 구현 전 결정이 필요할 때만 씁니다.
   - 하위는 `N.1`부터 연속입니다.
3. **참조**
   - 구현·테스트 태스크에는 `  - _Requirements: N.M, N.M_`을 씁니다.
   - 범위는 `1.1 ~ 1.17`입니다.
   - 하위 태스크의 참조는 4칸 들여쓰기입니다.
4. **모든 기준이 어떤 태스크에 들어 있어야 합니다.** requirements의 모든 `N.M`이 적어도 한 태스크의 `_Requirements_` 또는 `**Validates**`에 나와야 합니다.
5. **순서**
   - 공통 기반 → 도메인 모델 → 기능별(요청을 받는 Requirement → 그 결과를 따라 반영하는 Requirement) 순서입니다.
   - 다른 Requirement의 결과를 검증에 쓰는 Requirement(예: "7.1에 따라 결제 완료")는 그 Requirement보다 뒤에 둡니다.
6. **기능 태스크 구성**: Requirement마다 `인수 테스트 작성` 태스크를 먼저 두고, 구현 태스크를 뒤에 둡니다 (Red → Green).
7. **Property 태스크**
   - design의 Property마다 하나씩, 그 Property가 검증하는 기능 태스크 묶음 안에 둡니다.
   - 선택(`*`)으로 표시합니다.
   - `**Property N: 이름**`의 이름은 design과 같게 씁니다.
8. **Checkpoint**
   - 기반, 주요 기능 묶음, 마지막에 둡니다.
   - 마지막 Checkpoint는 명세 동기화(`/spec-mirror:sync`)와 전체 테스트 통과입니다.
9. **기존 테스트 이관**: 기존 기능을 바꾸는 경우, 기존 테스트를 새 기준 번호로 옮기는 태스크를 둡니다.
10. 태스크 본문은 짧은 항목으로 씁니다. 설명이 길어지면 design에 쓰고 참조합니다.

## Task Dependency Graph 규칙

- `## Task Dependency Graph` 아래 ```json 코드 블록 하나입니다.
- `waves` 배열이고, 각 wave의 `id`는 0부터 연속입니다. 같은 wave의 태스크는 동시에 진행할 수 있습니다.
- **하위 태스크가 없는 모든 태스크**(하위 태스크, 또는 하위가 없는 상위 태스크)가 정확히 한 번씩 나옵니다. 하위 태스크가 있는 상위 태스크 번호는 넣지 않습니다.
- 앞 wave의 결과에 의존하는 태스크는 뒤 wave에 둡니다. 인수 테스트 작성은 그 구현보다 앞이나 같은 wave이고, Checkpoint는 확인 대상보다 뒤입니다.

## 검사 규칙

| ID | 수준 | 내용 |
|---|---|---|
| TSK000 | 오류 | 채우지 않은 템플릿 자리표시자(`<...>`) |
| TSK001 | 오류 | 첫 줄 `# Implementation Plan:`, 섹션 Overview → Tasks → Notes → Task Dependency Graph |
| TSK002 | 오류 | Tasks 안의 체크박스 줄 형식 |
| TSK003 | 오류 | 상위·하위 번호 연속 |
| TSK004 | 오류 | `_Requirements_` 형식과 참조 유효성 |
| TSK005 | 오류/경고 | `**Property N**` 이 design 에 없음(오류) / 이름이 다름(경고) |
| TSK006 | 오류 | `**Validates**` 참조 유효성 |
| TSK007 | 오류 | Dependency Graph JSON 형식, wave id 연속 |
| TSK008 | 오류 | Graph 의 태스크 누락·중복·없는 태스크·상위 태스크 |
| TSK009 | 오류 | 어떤 태스크에도 들어 있지 않은 기준 |
| TSK010 | 경고 | 상위는 완료인데 필수 하위가 미완료 |
