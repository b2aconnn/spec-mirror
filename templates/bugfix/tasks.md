# Implementation Plan: <버그 이름>

## Overview

<무엇을 고치는지 한두 문장>

고치기 전에 버그를 재현하는 탐색 테스트(실패해야 함)와 지금 동작을 기록하는 보존 테스트(통과해야 함)를 먼저 작성하고, 고친 뒤 두 테스트가 모두 통과하는지 확인합니다. 마지막으로 기능 명세를 고친 동작에 맞춥니다.

## Tasks

- [ ] 1. 버그 조건 탐색 테스트 작성
  - **Property 1: Bug Condition - <design 의 Property 이름 그대로>**
  - **고치기 전 코드에서 실패해야 합니다.** 실패가 버그를 증명합니다. 통과하면 원인 분석이 틀린 것이므로 멈추고 다시 분석합니다
  - 테스트를 고쳐서 통과시키지 않습니다
  - <테스트 이름과 위치>
  - _Requirements: 1.1, 2.1_

- [ ] 2. 보존 테스트 작성 (고치기 전)
  - **Property 2: Preservation - <design 의 Property 이름 그대로>**
  - **고치기 전 코드에서 통과해야 합니다.** 지금 동작을 기록하는 테스트입니다
  - _Requirements: 3.1_

- [ ] 3. 버그 수정: <무엇을 고치는지>
  - [ ] 3.1 <고치는 일>
    - <할 일>
    - _Requirements: 2.1_

  - [ ] 3.2 탐색 테스트 통과 확인
    - **Property 1: Bug Condition - <design 의 Property 이름 그대로>**
    - 1번의 테스트를 다시 실행합니다. 테스트는 고치지 않습니다
    - _Requirements: 2.1_

  - [ ] 3.3 보존 테스트 통과 확인
    - **Property 2: Preservation - <design 의 Property 이름 그대로>**
    - 2번의 테스트를 다시 실행합니다
    - _Requirements: 3.1_

- [ ] 4. 명세 반영
  - <기능> requirements.md <N.M> 을 고친 동작에 맞춤 → 사용자 재승인 (바뀌는 것이 없으면 "변경 없음"을 확인)
  - _Requirements: 2.1_

- [ ] 5. Checkpoint - 전체 테스트와 명세 동기화
  - 전체 테스트 통과 확인
  - `/spec-mirror:sync <기능>`, `/spec-mirror:sync {{NAME}}`

## Notes

- **탐색 테스트 먼저**: 1번은 고치기 전에 실패해야 하고, 2번은 고치기 전에 통과해야 합니다
- **테스트 이름**: 기능 명세 기준 번호(`R{N}-{M}`)를 씁니다. 기능 명세가 없으면 `B{N}-{M}` 을 쓰고 테스트 파일에 버그 이름(`{{NAME}}`)을 남깁니다

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["4"] },
    { "id": 4, "tasks": ["5"] }
  ]
}
```
