# Implementation Plan: 즉시 조회 대조 불일치 응답

## Overview

결제 승인 결과가 불명이어서 즉시 조회했을 때 PG 승인 내용이 주문과 다르면, `400 PG_REJECTED` 대신 승인 응답 경로와 같은 `502 PG_RESPONSE_MISMATCH`로 응답하도록 고칩니다.

고치기 전에 버그를 재현하는 탐색 테스트(실패해야 함)와 지금 동작을 기록하는 보존 테스트(통과해야 함)를 먼저 작성합니다. 그다음 코드를 고치고 두 테스트가 모두 통과하는지 확인한 뒤, order 명세를 고친 동작에 맞춥니다.

## Tasks

- [ ] 1. 버그 조건 탐색 테스트 작성
  - **Property 1: Bug Condition - 즉시 조회의 대조 불일치는 502로 응답**
  - **고치기 전 코드에서 실패해야 합니다.** 실패가 버그를 증명합니다. 통과하면 원인 분석이 틀린 것이므로 멈추고 다시 분석합니다
  - 테스트를 고쳐서 통과시키지 않습니다. 이 테스트는 기대 동작을 담고 있고, 고친 뒤에 통과해야 합니다
  - `OrderPaymentConfirmAcceptanceTest`에 `R6-21c 즉시 조회에서 대조 결과가 다르면 승인을 취소하고 502로 응답한다` 추가
  - `ConfirmRecheckMismatchPropertyTest`에 Property 1 추가: 금액 · 주문번호 · 결제 키 불일치를 무작위로 만든다
  - 실패할 때 나온 반례를 "결과:"로 남깁니다 (예상: `400 PG_REJECTED`, 메시지 "amount(15000 != 14000)")
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [ ] 2. 보존 테스트 작성 (고치기 전)
  - **Property 2: Preservation - 버그 조건 밖의 승인 결과는 그대로**
  - **Property 3: Preservation - 대사 배치는 그대로**
  - **고치기 전 코드에서 통과해야 합니다.** 지금 동작을 기록하는 테스트입니다
  - 기존 `R6-18`, `R6-21a`, `R6-21b`, `R6-22`, `R7-2` 테스트가 통과하는지 확인
  - `ConfirmRecheckMismatchPropertyTest`에 Property 2 · 3 추가: 버그 조건을 뺀 PG 승인 · 조회 결과 조합
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. 버그 수정: 즉시 조회의 대조 불일치 응답
  - [ ] 3.1 즉시 조회 결과가 대조 불일치면 `PG_RESPONSE_MISMATCH`로 응답
    - `PaymentConfirmService.confirm`의 결과 불명 분기에 대조 불일치 갈래 추가 (design "Fix Implementation")
    - 갈래 순서: 성공 → 대조 불일치 → PG 실패 확정 → 미확정
    - 새 갈래 위에 `// R6-21` 주석
    - `PaymentReconciler`, `PaymentApprovalHandler`는 고치지 않습니다
    - _Requirements: 2.1, 2.2_

  - [ ] 3.2 탐색 테스트 통과 확인
    - **Property 1: Bug Condition - 즉시 조회의 대조 불일치는 502로 응답**
    - 1번의 테스트를 다시 실행합니다. 테스트는 고치지 않습니다
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 보존 테스트 통과 확인
    - **Property 2: Preservation - 버그 조건 밖의 승인 결과는 그대로**
    - **Property 3: Preservation - 대사 배치는 그대로**
    - 2번의 테스트를 다시 실행합니다
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. 명세 반영
  - order requirements.md 6.21: "결제 실패로 확정되면 (대조 불일치 포함)"에서 "(대조 불일치 포함)"을 빼고, "조회해서 승인 내용이 주문과 다르면 → 18과 같다" 갈래를 추가 → 사용자 재승인
  - order requirements.md Open Questions 9 삭제
  - order design 02 "Payment Confirm Service (변경)"에 결과 불명 분기의 갈래 순서 추가 → 사용자 재승인
  - _Requirements: 2.1, 2.2_

- [ ] 5. Checkpoint - 전체 테스트와 명세 동기화
  - 전체 테스트 통과 확인
  - `/spec-mirror:sync order`로 `R6-21` 테스트와 코드 주석 확인
  - `/spec-mirror:sync confirm-recheck-mismatch`로 기대 · 유지 항목의 테스트 확인

## Notes

- **탐색 테스트 먼저**: 1번은 고치기 전에 실패해야 하고, 2번은 고치기 전에 통과해야 합니다. 이 두 가지를 확인한 뒤에만 3번을 시작합니다
- **테스트 이름**: order 명세 기준 번호(`R6-21c`)를 씁니다. 버그만을 위한 Property 테스트 파일에는 버그 이름 `confirm-recheck-mismatch`를 주석으로 남깁니다
- **테스트 환경**: H2(MySQL 모드) + `FakePgClient` + 고정 `Clock`
- **범위 밖**: 대사 코드 변경, 보상 취소 실패 시 수동 처리

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
