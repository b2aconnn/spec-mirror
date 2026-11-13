# Implementation Plan: <기능 이름>

## Overview

<무엇을 구현하는지 2~3문장>

<구현 순서와 진행 방식: 공통 기반 → 도메인 → 기능별, 테스트 먼저(Red) → 구현(Green)>

## Tasks

- [ ] 1. <공통 기반>
  - <할 일>
  - _Requirements: 1.2_

- [ ] 2. <기능 묶음>
  - [ ] 2.1 테스트 작성: <테스트 묶음 이름들>
    - <테스트 종류>: <검증할 시나리오>
    - _Requirements: 1.1 ~ 1.4_

  - [ ] 2.2 <구현 태스크>
    - <할 일>
    - _Requirements: 1.1, 1.3_

  - [ ]* 2.3 Property 테스트: <이름>
    - **Property 1: <design 의 Property 이름 그대로>**
    - **Validates: Requirements 1.2**

- [ ] 3. 최종 Checkpoint - 명세 동기화
  - 모든 기준에 대응하는 테스트(`R{N}-{M}`)와 코드 주석 확인
  - 모든 테스트 통과 확인

## Notes

- **테스트 우선**: 각 기능은 테스트를 먼저 작성해 실패를 확인한 뒤 구현합니다
- **테스트 종류**: convention을 따릅니다 (design 05 `기준 ↔ 테스트`)
- **Property 테스트**: `*` 표시된 태스크는 선택적입니다
- **테스트 형식**: BDD 시나리오(given / when / then)이고, 이름은 `` `R{N}-{M} <상황>이면 <결과>다` `` 입니다. 도메인 용어로 정책을 씁니다

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["3"] }
  ]
}
```
