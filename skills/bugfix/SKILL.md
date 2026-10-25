---
name: bugfix
description: spec-mirror 버그 명세. 버그를 bugfix(현재 동작 / 기대 동작 / 유지할 동작) → design(원인 · 고치는 범위 · Property) → tasks(탐색 테스트 실패 확인 → 보존 테스트 → 수정 → 명세 반영) 세 단계로, 단계마다 사용자 승인을 받으며 진행합니다. 처음 부르면 bugfix.md 를 쓰고, 다시 부르면 지금 단계에 맞춰 이어서 합니다. 버그 리포트, 장애, "이거 왜 이렇게 동작해", "버그 고쳐줘", 회귀가 걱정되는 수정에 사용합니다.
argument-hint: <버그 이름> [bugfix|design|tasks] [버그 설명]
allowed-tools: Bash(node *spec-mirror.mjs* next*), Bash(node *spec-mirror.mjs* gate*), Bash(node *spec-mirror.mjs* status*), Bash(node *spec-mirror.mjs* check*), Bash(node *spec-mirror.mjs* scaffold*), Bash(node *spec-mirror.mjs* init*), Bash(node *spec-mirror.mjs* list*)
---

# spec-mirror: bugfix (버그 명세)

버그 명세는 `bugfix → design → tasks` 순서로 진행합니다. 경험 많은 개발자가 버그를 고치는 방식 그대로입니다: **원인을 찾고, 바뀌어야 할 것을 정하고, 바뀌면 안 되는 것을 명시적으로 지킵니다.** 한 번에 한 단계만 쓰고, 단계가 끝나면 멈춰서 사용자 승인을 받습니다.

## 경로

이 스킬을 불러올 때 표시되는 **Base directory**를 `<BASE>`라고 합니다.

- 검사기: `node "<BASE>/../../scripts/spec-mirror.mjs"` (아래에서 `SM`)
- 단계별 안내: `<BASE>/stages/bugfix.md`, `<BASE>/stages/design.md`, `<BASE>/stages/tasks.md`
- 규칙: `<BASE>/../../rules/` (`bugfix/`, `feature/`, `traceability.md`, `workflow.md`)
- 정답 예제: `<BASE>/../../examples/confirm-recheck-mismatch/` (이 버그가 고치는 기능 명세: `<BASE>/../../examples/order/`)

## 절차

1. **이름과 요청을 읽습니다.**
   - 첫 인자가 버그 이름입니다. 영문 소문자·숫자·하이픈으로, 증상을 짧게 담습니다 (예: `confirm-recheck-mismatch`).
   - 이름 없이 설명만 있으면 설명에서 이름을 정해 알리고 진행합니다.
   - 둘째 인자가 `bugfix` / `design` / `tasks`면 그 단계를 지정한 것입니다.
   - 나머지는 버그 설명입니다.
   - 오타나 한 줄짜리 명백한 실수면 버그 명세가 필요 없을 수 있습니다. `<BASE>/../../rules/bugfix/bugfix-format.md`의 "언제 쓰는가"를 보고, 해당하면 사용자에게 바로 고칠지 묻습니다.

2. **설정을 확인합니다.** 프로젝트에 `.spec-mirror/config.json`이 없으면 `SM init`을 실행하고 알립니다.

3. **지금 할 일을 정합니다.** `SM next <이름> --json`을 실행합니다.

   | `action` | 할 일 |
   |---|---|
   | `start` | 새 버그 명세입니다. bugfix 단계로 갑니다 |
   | `write` | `stage` 단계를 쓰거나 고칩니다 |
   | `approve` | `stage` 단계가 사용자 승인을 기다립니다. 아래 4번 |
   | `implement` | 세 단계가 모두 승인되었습니다. `/spec-mirror:implement <이름>`을 안내합니다 |
   | `sync` | 필수 태스크를 모두 마쳤습니다. `/spec-mirror:sync <이름>`을 안내합니다 |

   - 결과의 `type`이 `feature`면 기능 명세 폴더입니다. 다른 이름을 정하거나 `/spec-mirror:spec`을 안내합니다.
   - 사용자가 단계를 지정했으면 그 단계로 갑니다. 단, `SM gate <이름> <단계>`가 실패하면 앞 단계 승인부터 안내합니다.

4. **승인 대기 상태일 때**
   - 이번 메시지에서 사용자가 **분명하게 승인했으면** `SM approve <이름> <단계>`를 실행합니다. 성공하면 3번으로 돌아가 다음 단계를 진행합니다.
   - 승인하지 않았으면 그 단계 문서를 요약해 보여 주고 승인을 요청합니다. 고칠 점을 말하면 고칩니다.
   - 애매한 반응은 승인이 아닙니다. "승인할까요?"라고 묻습니다.

5. **단계를 씁니다.** 해당 단계 안내 파일을 **처음부터 끝까지 읽고** 그대로 따릅니다.
   - bugfix → `<BASE>/stages/bugfix.md`
   - design → `<BASE>/stages/design.md`
   - tasks → `<BASE>/stages/tasks.md`

6. **멈추고 리뷰를 요청합니다.** 단계 안내의 "보고" 형식으로 보고하고, 마지막 줄에 다음을 씁니다.

   > 이대로 승인하면 "승인"이라고 답해 주세요. 고칠 점이 있으면 알려 주세요.

   **스스로 승인하지 않습니다. 사용자 답 없이 다음 단계를 쓰지 않습니다.**

## 지키는 것

- 버그를 "고치는" 코드는 implement 단계에서, **탐색 테스트가 고치기 전에 실패한 것을 확인한 뒤에만** 씁니다.
- 형식은 기억으로 쓰지 않습니다. 매번 규칙 파일과 정답 예제를 읽고 맞춥니다.
- 훅이 형식 오류를 알리면 그 자리에서 고칩니다. 단계 잠금 훅이 막으면 앞 단계 승인부터 받습니다.
- 승인 기록(`.spec-mirror.json`)은 직접 고치지 않습니다.
