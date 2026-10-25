---
name: adopt
description: spec-mirror 기존 코드에서 명세 만들기. 이미 동작하는 코드를 동작을 바꾸지 않고 기능 명세(requirements → design → tasks)로 옮깁니다. 기능을 주면 그 기능을, 주지 않으면 프로젝트 전체의 명세 지도(docs/spec/README.md)부터 만들고 기능 하나씩 진행합니다. 코드의 분기를 빠짐없이 기준으로 옮기고, tasks 는 테스트 이름 정리 · 빠진 테스트 추가 · 분기 주석 같은 도입 작업입니다. "기존 코드 분석해서 명세 만들어줘", "이 프로젝트 문서화해줘", "레거시를 명세로 옮겨줘"에 사용합니다.
argument-hint: "[기능] [requirements|design|tasks] [코드 경로나 설명]"
allowed-tools: Bash(node *spec-mirror.mjs* next*), Bash(node *spec-mirror.mjs* gate*), Bash(node *spec-mirror.mjs* status*), Bash(node *spec-mirror.mjs* check*), Bash(node *spec-mirror.mjs* scaffold*), Bash(node *spec-mirror.mjs* init*), Bash(node *spec-mirror.mjs* list*), Bash(node *spec-mirror.mjs* map*)
---

# spec-mirror: adopt (기존 코드에서 명세 만들기)

이미 동작하는 코드를 **동작을 바꾸지 않고** 기능 명세로 옮깁니다. 결과물은 일반 기능 명세와 같은 형식이고, 끝난 뒤에는 일반 기능 명세처럼 관리합니다.

## 경로

이 스킬을 불러올 때 표시되는 **Base directory**를 `<BASE>`라고 합니다.

- 검사기: `node "<BASE>/../../scripts/spec-mirror.mjs"` (아래에서 `SM`)
- 단계별 안내: `<BASE>/stages/map.md`, `<BASE>/stages/requirements.md`, `<BASE>/stages/design.md`, `<BASE>/stages/tasks.md`
- 규칙: `<BASE>/../../rules/adopt.md`, `<BASE>/../../rules/spec-map.md`, `<BASE>/../../rules/feature/`, `<BASE>/../../rules/workflow.md`
- 일반 기능 명세 단계 안내: `<BASE>/../spec/stages/` (adopt 단계 안내가 이 파일을 함께 읽게 합니다)
- 정답 예제: `<BASE>/../../examples/` (`README.md`가 명세 지도 예제)

## 절차

1. **규칙을 읽습니다.** `rules/adopt.md`를 처음부터 끝까지 읽습니다. adopt는 이 문서의 원칙을 모든 단계에 적용합니다: **코드 그대로, 분기 빠짐없이, 코드 순서대로, 코드는 바꾸지 않음.**

2. **설정을 확인합니다.** `.spec-mirror/config.json`이 없으면 `SM init`을 실행하고 알립니다.

3. **범위를 정합니다.**
   - 인자에 기능 이름이 없거나 "전체"이면 **명세 지도** 단계입니다. `<BASE>/stages/map.md`를 따릅니다.
   - 기능 이름이 있으면 그 기능을 진행합니다. 명세 지도가 있으면 `SM map`으로 그 기능이 지도에 있는지, 순서상 앞 기능이 끝났는지 확인하고 알립니다(막지는 않습니다).

4. **지금 할 일을 정합니다.** `SM next <기능> --json`을 실행합니다.

   | 결과 | 할 일 |
   |---|---|
   | `action: start` | 새 명세입니다. `SM scaffold <기능> requirements --adopt`로 만들고 requirements 단계로 갑니다 |
   | `type: feature`, `mode: new` | 이미 일반 기능 명세입니다. adopt가 아니라 `/spec-mirror:spec <기능>`을 안내하고 멈춥니다 |
   | `type: bugfix` | 버그 명세 폴더입니다. 다른 이름을 정하게 합니다 |
   | `action: write` | `stage` 단계를 쓰거나 고칩니다 |
   | `action: approve` | 아래 5번 |
   | `action: implement` | 도입 작업(tasks)을 `/spec-mirror:implement <기능>`으로 진행하도록 안내합니다 |
   | `action: sync` | `/spec-mirror:sync <기능>`을 안내합니다. 끝나면 명세 지도의 다음 기능을 안내합니다 |

5. **승인 대기 상태일 때**
   - 이번 메시지에서 사용자가 **분명하게 승인했으면** `SM approve <기능> <단계>`를 실행합니다. 이 명령은 권한 확인을 거칩니다. 성공하면 4번으로 돌아가 다음 단계를 진행합니다.
   - 승인하지 않았으면 문서를 요약해 보여 주고 승인을 요청합니다. 애매한 반응은 승인이 아닙니다.

6. **단계를 씁니다.** 해당 단계 안내 파일을 **처음부터 끝까지 읽고** 그대로 따릅니다.
   - requirements → `<BASE>/stages/requirements.md`
   - design → `<BASE>/stages/design.md`
   - tasks → `<BASE>/stages/tasks.md`

7. **멈추고 리뷰를 요청합니다.** 단계 안내의 "보고" 형식으로 보고하고, 마지막 줄에 다음을 씁니다.

   > 이대로 승인하면 "승인"이라고 답해 주세요. 고칠 점이 있으면 알려 주세요.

   **스스로 승인하지 않습니다. 사용자 답 없이 다음 단계나 다음 기능으로 넘어가지 않습니다.**

## 지키는 것

- **코드를 고치지 않습니다.** 이상한 동작, 버그로 보이는 동작도 명세에는 실제 동작대로 쓰고 Open Questions에 올립니다. 고치는 것은 adopt가 끝난 뒤 `/spec-mirror:bugfix`나 `/spec-mirror:spec`으로 따로 합니다.
- **한 번에 기능 하나만** 씁니다. 프로젝트 전체여도 지도를 승인받은 뒤 기능 하나씩 진행합니다.
- 형식은 기억으로 쓰지 않습니다. 매번 규칙 파일과 정답 예제를 읽습니다.
- 승인 기록(`.spec-mirror.json`)은 직접 고치지 않습니다.
