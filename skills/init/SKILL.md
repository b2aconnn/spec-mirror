---
name: init
description: spec-mirror 프로젝트 설정. .spec-mirror/config.json 과 명세 폴더(기본 docs/spec)를 만들고, 기술 맥락 문서 · 테스트 경로 규칙 · 항목 이름을 프로젝트에 맞게 정한 뒤, CLAUDE.md 에 spec-mirror 작업 흐름 안내를 추가합니다. 프로젝트에서 spec-mirror 를 처음 쓸 때 사용합니다.
allowed-tools: Bash(node *spec-mirror.mjs* init*), Bash(node *spec-mirror.mjs* check*), Bash(node *spec-mirror.mjs* status*)
---

# spec-mirror: init

## 경로

이 스킬을 불러올 때 표시되는 **Base directory**를 `<BASE>`라고 합니다.

- 검사기: `node "<BASE>/../../scripts/spec-mirror.mjs"` (아래에서 `SM`)

## 절차

1. **실행 환경을 확인합니다.** `node --version`이 18 이상인지, 프로젝트 루트(Git 루트)가 어디인지 확인합니다.

2. **설정 파일을 만듭니다.** `SM init`을 실행합니다. `.spec-mirror/config.json`과 `docs/spec/`이 생깁니다. 이미 있으면 내용을 보여 주고 넘어갑니다.

3. **프로젝트에 맞게 설정을 조정합니다.** 바꿀 값이 있으면 제안하고, 사용자가 동의하면 고칩니다.

   | 키 | 확인할 것 |
   |---|---|
   | `specRoot` | 이미 명세 폴더가 있으면 그 위치 (기본 `docs/spec`) |
   | `techContext` | 기술 스택·관례가 적힌 문서 (`CLAUDE.md`, `README.md`, `docs/architecture.md` 등) |
   | `testPathPatterns` | 테스트 파일을 구분하는 경로 정규식. 기존 테스트 위치를 보고 맞는지 확인 |
   | `extraItemLabels` | Glossary에 없지만 세부 항목 이름으로 쓸 외부 시스템 이름 |
   | `stageGate` | 단계 잠금 훅 (기본 켜짐. 끄는 것은 권장하지 않음) |

4. **CLAUDE.md에 안내를 추가합니다.**
   - 아래 블록을 보여 주고, 사용자가 동의하면 CLAUDE.md 끝에 추가합니다. CLAUDE.md가 없으면 만듭니다.
   - 이미 같은 블록이 있으면 건너뜁니다.
   - 규칙 본문은 복사하지 않습니다. 규칙의 원본은 플러그인 하나입니다.

   ```markdown
   ## 명세 (spec-mirror)

   - 명세가 원본이다. 명세는 `docs/spec/<이름>/` 에 있다.
     - 기능: requirements.md → design.md(+ design/) → tasks.md — `/spec-mirror:spec <이름>`
     - 버그: bugfix.md → design.md → tasks.md — `/spec-mirror:bugfix <이름>`
     - 기존 코드에서 옮기기: `/spec-mirror:adopt [기능]` (전체 목록은 `docs/spec/README.md`)
   - 단계마다 사용자 승인을 받는다. 승인 전에는 다음 단계를 쓰지 않는다.
   - 기준 하나 = 코드 분기 하나 = 인수 테스트 하나. 테스트 이름은 `R{N}-{M} <요약>`, 분기 주석은 `R{N}-{M}`.
   - 버그는 탐색 테스트가 고치기 전에 실패하는 것을 확인한 뒤에 고치고, 고친 동작을 기능 명세에 반영한다.
   - 문서와 코드가 다르면 문서가 맞다. "명세 동기화해줘" 는 `/spec-mirror:sync <이름>` 이다.
   ```

5. **기존 명세를 확인합니다.** `docs/spec/` 아래에 이미 명세가 있으면 `SM check`를 실행해 결과를 보고합니다. 오류가 있으면 어느 명령으로 고칠지 안내합니다.

6. **다음 할 일을 안내합니다.**
   - 기존 코드를 명세로 옮기기: `/spec-mirror:adopt` (프로젝트 전체 지도부터) 또는 `/spec-mirror:adopt <기능>`
   - 새 기능: `/spec-mirror:spec <이름> <만들 것>`
   - 버그: `/spec-mirror:bugfix <버그 이름> <버그 설명>`
