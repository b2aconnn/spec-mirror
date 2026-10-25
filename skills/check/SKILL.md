---
name: check
description: spec-mirror 형식 검사. 기능 명세(requirements · design · tasks)와 버그 명세(bugfix · design · tasks)가 정해진 형식을 지키는지 검사만 하고 결과를 설명합니다. 섹션 순서, 번호, 항목 이름, 금지 표현, 기술 용어, 참조, Property, Dependency Graph, 기준 포함 여부를 봅니다. 파일은 고치지 않습니다.
argument-hint: "[이름...]"
allowed-tools: Bash(node *spec-mirror.mjs* check*)
---

# spec-mirror: check

## 경로

이 스킬을 불러올 때 표시되는 **Base directory**를 `<BASE>`라고 합니다.

- 검사기: `node "<BASE>/../../scripts/spec-mirror.mjs"` (아래에서 `SM`)

## 절차

1. `SM check <이름...>`을 실행합니다. 이름을 주지 않으면 모든 명세와 명세 지도(`<specRoot>/README.md`, 있으면)를 검사합니다.
2. 결과를 보고합니다.
   - 명세별 종류(기능 / 버그)와 오류·경고 수
   - 오류는 모두, 경고는 규칙 ID별로 묶어서 보여 줍니다.
   - 규칙 ID의 뜻은 규칙 파일 끝의 "검사 규칙" 표에서 찾아 한 줄로 설명합니다.

     | 접두사 | 규칙 파일 |
     |---|---|
     | `REQ` | `<BASE>/../../rules/feature/requirements-format.md` |
     | `DES` | `<BASE>/../../rules/feature/design-format.md` |
     | `TSK` | `<BASE>/../../rules/feature/tasks-format.md` |
     | `BUG` | `<BASE>/../../rules/bugfix/bugfix-format.md` |
     | `BDS` | `<BASE>/../../rules/bugfix/design-format.md` |
     | `BTK` | `<BASE>/../../rules/bugfix/tasks-format.md` |
     | `MAP` | `<BASE>/../../rules/spec-map.md` |

3. 고치는 방법을 제안하되 **파일은 고치지 않습니다.** 고치려면 `/spec-mirror:spec <이름>` 또는 `/spec-mirror:bugfix <이름>`을 안내합니다.
