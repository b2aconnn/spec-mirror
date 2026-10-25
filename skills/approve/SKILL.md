---
name: approve
description: spec-mirror 단계 승인. 사용자가 리뷰를 마친 단계(기능 requirements · design · tasks, 버그 bugfix · design · tasks)를 승인 상태로 기록합니다. 형식 오류가 없고 앞 단계가 승인되어 있어야 합니다.
argument-hint: <이름> [단계]
disable-model-invocation: true
allowed-tools: Bash(node *spec-mirror.mjs* approve*), Bash(node *spec-mirror.mjs* status*), Bash(node *spec-mirror.mjs* next*)
---

# spec-mirror: approve

이 명령은 **사용자가 직접 실행**합니다. 승인은 사람이 하는 일입니다.

## 경로

이 스킬을 불러올 때 표시되는 **Base directory**를 `<BASE>`라고 합니다.

- 검사기: `node "<BASE>/../../scripts/spec-mirror.mjs"` (아래에서 `SM`)

## 절차

1. 인자에서 이름과 단계를 읽습니다.
   - 이름이 없으면 `SM status`를 보여 주고 무엇을 승인할지 묻습니다.
   - 단계가 없으면 `SM next <이름> --json`의 `action`이 `approve`일 때 그 `stage`를 승인합니다. 아니면 상태를 보여 주고 묻습니다.
2. `SM approve <이름> <단계>`를 실행합니다.
3. 결과를 보고합니다.
   - 성공하면 다음 할 일을 안내합니다. 기능 명세는 `/spec-mirror:spec <이름>`, 버그 명세는 `/spec-mirror:bugfix <이름>`으로 다음 단계를 진행하고, tasks까지 승인되었으면 `/spec-mirror:implement <이름>`입니다.
   - 실패하면 이유를 그대로 전하고 해결 방법을 안내합니다. 이유는 형식 오류, 앞 단계 미승인, 문서 없음 중 하나입니다.
