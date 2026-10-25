---
name: status
description: spec-mirror 진행 상황. 명세별 종류(기능 / 버그), 단계별 승인 상태(작성 중 / 승인됨 / 승인 후 변경됨 / 앞 단계가 바뀜), 형식 오류 수, 태스크 진행률, 다음 할 일을 보여줍니다.
argument-hint: "[이름]"
allowed-tools: Bash(node *spec-mirror.mjs* status*), Bash(node *spec-mirror.mjs* map*)
---

# spec-mirror: status

## 경로

이 스킬을 불러올 때 표시되는 **Base directory**를 `<BASE>`라고 합니다.

- 검사기: `node "<BASE>/../../scripts/spec-mirror.mjs"` (아래에서 `SM`)

## 절차

1. `SM status [이름] --json`을 실행합니다.
2. 결과를 표로 보여 줍니다.

   | 명세 | 종류 | 1단계 | design | tasks | 구현(필수 / 선택) | 다음 할 일 |
   |---|---|---|---|---|---|---|

   - 1단계는 기능이면 requirements, 버그면 bugfix입니다.
   - 종류에 `mode`가 `adopt`면 "기능 (기존 코드)"로 씁니다. 다음 할 일 명령은 `/spec-mirror:adopt <이름>`입니다.
   - 명세 지도(`<specRoot>/README.md`)가 있으면 `SM map --json`도 실행해, 지도 순서대로 표를 정렬하고 아직 명세가 없는 기능을 "명세 없음"으로 함께 보여 줍니다.
   - 다음 할 일은 결과의 `next.message`를 쓰고, 명령을 붙입니다.

   | `next.action` | 명령 |
   |---|---|
   | `write` · `approve` | 기능 `/spec-mirror:spec <이름>`, 버그 `/spec-mirror:bugfix <이름>` |
   | `implement` | `/spec-mirror:implement <이름>` |
   | `sync` | `/spec-mirror:sync <이름>` |

3. "승인 후 변경됨"이나 "앞 단계가 바뀜"이 있으면, 무엇이 바뀌었는지 사용자에게 확인한 뒤 재승인해야 한다고 덧붙입니다.
