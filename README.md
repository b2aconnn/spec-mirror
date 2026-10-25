# spec-mirror

**명세가 원본입니다.** 문서에 적힌 비즈니스 흐름과 코드의 흐름을 일치시키는 Claude Code 스펙 주도 개발 플러그인입니다.

AWS Kiro의 스펙 방식(Feature Spec · Bugfix Spec)을 Claude Code로 옮기고, 한 단계 더 엄격하게 만들었습니다.

- **기능**은 `requirements → design → tasks`, **버그**는 `bugfix → design → tasks` 세 단계로 진행합니다.
- 단계마다 **사람이 승인**해야 다음 단계로 넘어갑니다. 훅이 이 순서를 강제합니다.
- 모든 문서는 **정해진 형식**을 따르고, 저장할 때마다 검사기가 형식을 확인합니다.
- 요구사항의 기준 하나는 **코드 분기 하나, 인수 테스트 하나**로 이어지고, 추적표로 확인합니다.

> [English README](README.en.md) · 명세 템플릿과 형식 규칙은 한국어 기준입니다.

## 목차

- [왜 spec-mirror인가](#왜-spec-mirror인가)
- [빠른 시작](#빠른-시작)
- [설치](#설치)
- [기능 명세](#기능-명세)
- [버그 명세](#버그-명세)
- [기존 코드에서 명세 만들기](#기존-코드에서-명세-만들기)
- [명령](#명령)
- [승인과 단계 잠금](#승인과-단계-잠금)
- [리뷰](#리뷰)
- [형식 검사](#형식-검사)
- [추적: 문서 ↔ 테스트 ↔ 코드](#추적-문서--테스트--코드)
- [설정](#설정)
- [기술 스택](#기술-스택)
- [CI 연동](#ci-연동)
- [저장소 구조](#저장소-구조)
- [문제 해결](#문제-해결)
- [개발](#개발)

## 왜 spec-mirror인가

| | 흔한 스펙 도구 | spec-mirror |
|---|---|---|
| 요구사항 문장 | 자유 서술, EARS | **도메인 언어만.** 기술 용어 · 클래스명 · URL은 오류 |
| 기준의 단위 | 기능 | **기준 하나 = 코드 분기 하나 = 인수 테스트 하나** |
| 기준의 순서 | 정해지지 않음 | **처리 흐름 = 실행 순서.** 위에서 아래로 읽으면 메서드를 읽는 것과 같음 |
| 버그 수정 | 바로 고침 | **현재 · 기대 · 유지할 동작**을 먼저 정하고, 탐색 테스트가 **고치기 전에 실패**하는 것을 확인한 뒤 고침 |
| 형식 준수 | 프롬프트에 의존 | 검사기 + 훅이 저장마다 검사, 오류는 승인을 막음 |
| 단계 전환 | 대화로 확인 | 승인을 문서 해시로 기록. 승인 전에는 다음 단계 문서를 **쓸 수 없음** |
| 코드와의 연결 | 태스크 체크박스 | 테스트 이름 `R{N}-{M}`, 분기 주석 `// R{N}-{M}` → **추적표** |
| 문서와 코드가 다를 때 | — | **문서가 맞다.** 코드에만 있는 분기는 사용자에게 묻고, 나머지는 테스트 → 코드 순서로 고침 |

## 빠른 시작

필요한 것: Claude Code, Node.js 18 이상. 별도 패키지 설치는 없습니다.

```text
/plugin marketplace add b2aconnn/spec-mirror
/plugin install spec-mirror@spec-mirror

/spec-mirror:init
```

**새 기능**

```text
/spec-mirror:spec order 회원이 상품을 골라 주문하고 결제하는 기능
```

Claude가 requirements.md를 쓰고 멈춥니다. 읽어 보고 "승인"이라고 답하면 design, 다시 승인하면 tasks로 넘어갑니다. tasks까지 승인되면 구현합니다.

```text
/spec-mirror:implement order next
/spec-mirror:sync order
```

**버그**

```text
/spec-mirror:bugfix confirm-recheck-mismatch 결제 결과 불명 후 즉시 조회에서 금액이 다르면 400 PG_REJECTED 로 응답함. 승인 응답에서 불일치면 502 인데 다름
```

Claude가 bugfix.md(현재 동작 / 기대 동작 / 유지할 동작)를 쓰고 멈춥니다. 승인하면 design(원인 · 고치는 범위), 그다음 tasks로 넘어갑니다.

**기존 코드**

```text
/spec-mirror:adopt
```

프로젝트 전체의 명세 지도(기능 목록과 순서)를 먼저 만들고, 승인하면 기능 하나씩 코드 그대로 명세로 옮깁니다.

완성된 예제는 [`examples/order/`](examples/order/)(기능)와 [`examples/confirm-recheck-mismatch/`](examples/confirm-recheck-mismatch/)(그 기능의 버그)에 있습니다. [`examples/README.md`](examples/README.md)는 명세 지도 예제입니다.

## 설치

**Git 저장소에서 설치 (권장)**

```text
/plugin marketplace add b2aconnn/spec-mirror
/plugin install spec-mirror@spec-mirror
```

저장소가 비공개인 동안에는 설치하는 사람이 저장소에 초대되어 있어야 하고, 그 컴퓨터에 GitHub 로그인(`gh auth login`)이나 Git 자격 증명이 있어야 합니다.

**로컬 폴더에서 설치**

```text
/plugin marketplace add /path/to/spec-mirror
/plugin install spec-mirror@spec-mirror
```

**팀 전체에 적용**

프로젝트의 `.claude/settings.json`에 추가하면, 팀원이 그 프로젝트를 열 때 설치를 안내받습니다.

```json
{
  "extraKnownMarketplaces": {
    "spec-mirror": {
      "source": { "source": "github", "repo": "b2aconnn/spec-mirror" }
    }
  },
  "enabledPlugins": {
    "spec-mirror@spec-mirror": true
  }
}
```

**플러그인 개발 중**

```bash
claude --plugin-dir /path/to/spec-mirror
```

## 기능 명세

```
requirements ──승인──▶ design ──승인──▶ tasks ──승인──▶ implement ──▶ sync
```

```
docs/spec/<기능>/
├── requirements.md          비즈니스 규칙의 원본 (도메인 언어)
├── design.md                Overview + 문서 구성(목차)
├── design/
│   ├── 01-architecture.md
│   ├── 02-components.md
│   ├── 03-data-models.md
│   ├── 04-error-handling.md
│   ├── 05-testing.md
│   ├── 06-security-performance.md
│   ├── 07-correctness-properties.md
│   └── 08-deployment-configuration.md
├── tasks.md                 구현 계획
└── .spec-mirror.json        승인 기록 (자동 생성)
```

| 단계 | 하는 일 |
|---|---|
| requirements | 비즈니스 규칙을 도메인 언어로 씁니다. 기존 기능을 바꾸면 기존 코드의 분기를 빠짐없이 옮깁니다 |
| design | 기준을 컴포넌트 · 데이터 · API · 에러 · 테스트 · Property에 연결합니다. 기술은 프로젝트에서 찾습니다 |
| tasks | 구현 순서입니다. 모든 기준이 태스크에 들어가고, 인수 테스트(Red)가 구현(Green)보다 앞섭니다 |

### requirements.md

```markdown
# Requirements Document

## Introduction
## Glossary
- **주문 (Order)**: 회원이 구매하려는 주문 항목 목록과 시스템이 확정한 주문 금액

## Requirements

### Requirement 1: 주문 접수

**User Story:** As a 회원, I want to 상품과 수량을 골라 주문할 수 있어야, so that 시스템이 확정한 금액으로 결제를 진행할 수 있다

#### Acceptance Criteria

##### 처리 흐름

1. **회원은 상품과 수량을 골라 주문할 수 있다.**
   - 요청 정보: 주문 항목 목록(상품, 수량), 중복 주문 방지 키

2. **주문 상품은 1개 이상 20개 이하로 담을 수 있다.** 비어 있거나 20개를 넘으면 주문을 받지 않는다.
   - 경계: 20개 가능, 21개 불가
   - 에러: `400` `INVALID_ORDER_ITEM_COUNT`
   - 메시지: "주문 상품은 1개 이상 20개 이하로 담아주세요."

##### 항상 지켜야 할 규칙

15. **주문 금액은 언제나 시스템이 계산한다.** 요청에 금액이 들어 있어도 쓰지 않는다.

## Open Questions
```

- 기준은 **굵은 규칙 한 줄 + 정해진 이름의 세부 항목**입니다.
- **처리 흐름**은 코드 실행 순서이고, **항상 지켜야 할 규칙**은 어느 시점에도 성립하는 규칙입니다. 번호는 두 묶음에 걸쳐 이어서 매깁니다.
- 처리 흐름의 순서는 **비즈니스가 판단하는 순서**로 먼저 정합니다. 값싸고 부작용 없는 확인이 먼저 오고, 되돌리기 어려운 일(변경, 외부 요청)이 가장 뒤에 옵니다. 순서는 다음과 같습니다.

  요청 형식 → 같은 요청 반복 → 대상 → 권한 → 요청 값 대조 → 이미 끝난 같은 요청 → 상태 → 시간 → 외부 조회·계산 → 변경 → 외부 요청 → 응답

  이 순서를 지키면 처리 흐름을 위에서 아래로 읽는 것이 곧 코드의 분기를 위에서 아래로 읽는 것이 됩니다.
- 전체 규칙: [rules/feature/requirements-format.md](rules/feature/requirements-format.md)

### design

목차 파일 1개와 본문 파일 8개입니다. 파일 이름과 섹션 순서는 고정입니다.

| 파일 | 섹션 |
|---|---|
| design.md | Overview (설계 목표), 문서 구성 |
| 01-architecture | Architecture |
| 02-components | Components and Interfaces |
| 03-data-models | Data Models (도메인 용어 ↔ 코드 표 필수) |
| 04-error-handling | Error Handling |
| 05-testing | Testing Strategy (테스트 기준 데이터 필수) |
| 06-security-performance | Security, Performance Optimization |
| 07-correctness-properties | Property-Based Testing Analysis, Correctness Properties |
| 08-deployment-configuration | Deployment, Configuration |

전체 규칙: [rules/feature/design-format.md](rules/feature/design-format.md)

### tasks.md

```markdown
# Implementation Plan: 주문 · 주문 결제

## Overview
## Tasks

- [ ] 6. 주문 접수 구현
  - [ ] 6.1 인수 테스트 작성: OrderPlaceAcceptanceTest
    - _Requirements: 1.1 ~ 1.17_
  - [ ]* 6.5 Property 테스트: 주문 상품 개수 / 수량 / 중복 상품
    - **Property 1: 주문 상품 개수 제한**
    - **Validates: Requirements 1.2, 1.3, 1.4**

## Notes
## Task Dependency Graph
```

전체 규칙: [rules/feature/tasks-format.md](rules/feature/tasks-format.md)

## 버그 명세

```
bugfix ──승인──▶ design ──승인──▶ tasks ──승인──▶ implement ──▶ sync
```

버그를 고치는 숙련된 개발자의 방식 그대로입니다. **원인을 찾고, 바뀌어야 할 것을 정하고, 바뀌면 안 되는 것을 명시적으로 지킵니다.**

```
docs/spec/<버그 이름>/
├── bugfix.md            현재 동작 / 기대 동작 / 유지할 동작 (도메인 언어)
├── design.md            원인 · 버그 조건 · 고치는 범위 · Property (한 파일)
├── tasks.md             탐색 테스트 → 보존 테스트 → 수정 → 확인 → 명세 반영
└── .spec-mirror.json
```

### bugfix.md: 세 가지 동작

```markdown
# Bugfix Requirements Document

## Introduction
## Bug Analysis

### Current Behavior (Defect)

1.1 **결과를 알 수 없어 PG에 한 번 조회했을 때 승인 내용이 주문과 다르면, PG 승인을 취소하고 결제를 실패 처리하지만 PG가 거절한 것처럼 응답한다.**
   - 재현: 주문 금액 14,000원 결제 승인 요청 → PG 승인 결과 불명 → PG 조회 결과 승인 완료, 결제 금액 15,000원
   - 에러: `400` `PG_REJECTED`

### Expected Behavior (Correct)

2.1 **… 승인 응답에서 불일치가 난 때와 같이 PG 승인을 취소하고 결제 실패로 응답한다.**
   - 에러: `502` `PG_RESPONSE_MISMATCH`
   - 메시지: "결제사 응답이 주문 정보와 일치하지 않아 결제를 취소했습니다."
   - 명세: order 6.21

### Unchanged Behavior (Regression Prevention)

3.1 **승인 응답에서 대조 결과가 다르면 지금처럼 PG 승인을 취소하고 결제 실패로 응답한다.**
   - 명세: order 6.18

## Open Questions
```

| 묶음 | 문장 | 필수 항목 |
|---|---|---|
| 현재 동작 `1.M` | **<조건>이면 <잘못된 동작>.** | `재현:` |
| 기대 동작 `2.M` | **<조건>이면 <올바른 동작>.** `2.N`은 `1.N`을 고친 모습 | `명세:` (권장) |
| 유지할 동작 `3.M` | **<조건>이면 지금처럼 <기존 동작>.** | `명세:` (권장) |

- **유지할 동작이 핵심입니다.** 같은 분기의 다른 갈래, 같은 결과를 내는 다른 경로, 같은 코드를 쓰는 배치처럼 **버그와 가장 가까운 경우**를 찾아 고친 뒤에도 그대로인지 테스트로 남깁니다.
- `명세: order 6.21`은 이 동작을 정하는 기능 명세 기준입니다. 버그를 고치면 기능 명세도 함께 고칩니다. 문서에 없는 분기가 코드에 남지 않게 하기 위해서입니다.
- 전체 규칙: [rules/bugfix/bugfix-format.md](rules/bugfix/bugfix-format.md)

### design.md: 원인과 범위

| 섹션 | 쓰는 것 |
|---|---|
| Overview · Glossary | 버그 요약, Bug Condition (C) · Property (P) · Preservation 정의 |
| Bug Details | `FUNCTION isBugCondition(input)` 의사 코드, 예시 |
| Expected Behavior | Preservation Requirements |
| Hypothesized Root Cause | **코드를 읽고** 쓴 원인 (확인됨 / 가설) |
| Correctness Properties | `Bug Condition - …`(2.M 검증), `Preservation - …`(3.M 검증) |
| Fix Implementation | 고칠 파일 · 함수 · 변경, **바꾸지 않는 것** |
| Testing Strategy | 탐색(고치기 전 반례), Fix Checking, Preservation Checking |

전체 규칙: [rules/bugfix/design-format.md](rules/bugfix/design-format.md)

### tasks.md: 순서가 고정입니다

| 번호 | 태스크 | 확인 |
|---|---|---|
| 1 | 버그 조건 탐색 테스트 작성 | **고치기 전 코드에서 실패**해야 합니다. 통과하면 멈추고 원인을 다시 분석합니다 |
| 2 | 보존 테스트 작성 | **고치기 전 코드에서 통과**해야 합니다 |
| 3 | 버그 수정 | 고친 뒤 탐색 테스트 통과, 보존 테스트 계속 통과 |
| 4 | 명세 반영 | 기능 명세를 고친 동작에 맞추고 재승인 |
| 5 | Checkpoint | 전체 테스트, 명세 동기화 |

전체 규칙: [rules/bugfix/tasks-format.md](rules/bugfix/tasks-format.md)

### 언제 버그 명세를 쓰나

| 상황 | 방법 |
|---|---|
| 동작이 명세와 다름, 원인이 분명하지 않음, 고쳤는데 다시 깨짐, 회귀 비용이 큼 | `/spec-mirror:bugfix` |
| 오타, 한 줄짜리 명백한 실수 | 바로 고칩니다. 동작이 바뀌면 기능 명세도 함께 고칩니다 |
| 고치려면 새 기능이 필요함 | 기능 명세(`/spec-mirror:spec`)를 따로 만들고, bugfix는 원래 결함에만 집중합니다 |

## 기존 코드에서 명세 만들기

이미 동작하는 코드를 **동작을 바꾸지 않고** 기능 명세로 옮깁니다. 결과물은 일반 기능 명세와 같은 형식이고, 다 옮긴 뒤에는 일반 기능 명세처럼 관리합니다.

```text
/spec-mirror:adopt                       프로젝트 전체: 명세 지도부터
/spec-mirror:adopt payment-confirm       기능 하나
```

### 프로젝트 전체: 명세 지도

한 파일에 모두 쓰지 않습니다. 먼저 **명세 지도**(`docs/spec/README.md`)를 만들어 기능을 나누고 순서를 정합니다. 지도를 승인받은 뒤 **기능 하나씩** 진행합니다.

```
docs/spec/
├── README.md            명세 지도: 기능 목록 · 범위 · 진입점 · 관련 기능 · 순서
├── payment-confirm/     기능 명세 (requirements → design → tasks)
├── order/
└── ...
```

| 순서 | 기능 | 범위 | 진입점 | 관련 기능 |
|---|---|---|---|---|
| 1 | [payment-confirm](payment-confirm/) | 결제 승인, 결과 확인, 대사 | 결제 승인 요청, 대사 배치 | — |
| 2 | [order](order/) | 주문 접수 · 조회 · 취소 · 만료 | 주문 요청 5개, 기한 만료 배치 | payment-confirm |

- **기능을 나누는 기준:** 같은 대상을 같은 규칙으로 다루는 유스케이스를 한 기능으로 묶습니다. Requirement 하나가 진입점 하나입니다. 기능 하나는 Requirement 10개, 기준 100개 정도까지입니다.
- **다른 기능 참조:** `payment-confirm 6.21`처럼 씁니다. 검사기가 그 기능 명세에 기준이 있는지 확인합니다.
- **진행 상황:** 지도에 손으로 적지 않습니다. `spec-mirror map` · `/spec-mirror:status`가 승인 기록에서 계산합니다.
- 전체 규칙: [rules/spec-map.md](rules/spec-map.md)

### 기능 하나: 세 단계의 다른 점

| 단계 | 일반 기능 명세와 다른 점 |
|---|---|
| requirements | 코드를 진입점부터 따라가 **분기 목록**을 먼저 만듭니다. 분기 하나를 기준 하나로 옮기고, **분기 ↔ 기준 대조표의 빈 칸이 0개**여야 합니다. 순서는 코드 순서입니다. 확인 순서 표와 다른 곳과 이상한 동작은 고치지 않고 Open Questions에 올립니다 |
| design | 새로 설계하지 않고 **지금 구조를 설명**합니다. 코드 조각은 실제 코드에서 옮깁니다. 02에 `기준 ↔ 코드 분기` 표, 05에 기존 테스트 이관 표를 둡니다 |
| tasks | **도입 작업**입니다: 기존 테스트 이름을 `R{N}-{M}`으로 정리, 빠진 인수 테스트 추가, 분기 주석. 새 테스트는 **지금 코드에서 바로 통과**해야 하고, 실패하면 코드를 고치지 않고 멈춥니다 |

버그로 보이는 동작은 adopt 중에 고치지 않습니다. "bugfix 후보"로 보고하고, adopt가 끝난 뒤 `/spec-mirror:bugfix`로 고칩니다. 전체 규칙: [rules/adopt.md](rules/adopt.md)

## 명령

| 명령 | 설명 |
|---|---|
| `/spec-mirror:init` | 설정 파일과 명세 폴더를 만들고 CLAUDE.md에 작업 흐름 안내를 추가 |
| `/spec-mirror:spec <이름> [단계] [설명]` | 기능 명세. 지금 단계를 이어서 진행 (requirements → design → tasks) |
| `/spec-mirror:bugfix <이름> [단계] [설명]` | 버그 명세. 지금 단계를 이어서 진행 (bugfix → design → tasks) |
| `/spec-mirror:adopt [기능] [단계] [설명]` | 기존 코드에서 명세 만들기. 기능이 없으면 명세 지도부터 |
| `/spec-mirror:implement <이름> [번호\|next\|all]` | 태스크 구현 (세 단계 승인 필요) |
| `/spec-mirror:sync <이름> [--report-only]` | 명세 동기화: 추적표 보고 후 문서 기준으로 수정 |
| `/spec-mirror:check [이름...]` | 형식 검사만 (수정 없음) |
| `/spec-mirror:status [이름]` | 단계별 승인 상태, 태스크 진행률, 다음 할 일 |
| `/spec-mirror:approve <이름> [단계]` | 단계 승인 (사용자 전용 — 모델이 스스로 부르지 않음) |

함께 설치되는 구성 요소:

| 구성 요소 | 역할 |
|---|---|
| `spec-reviewer` 에이전트 | 작성자와 독립적으로 명세를 읽고 기계 검사가 못 잡는 위반을 보고. 버그 명세에서는 **빠진 유지할 동작**과 **코드와 맞지 않는 원인 분석**을, adopt에서는 분기 목록을 **따로 다시 만들어** 빠진 분기를 찾음 |
| 훅 (쓰기 전) | 앞 단계 승인 전에는 다음 단계 문서를 못 쓰게 막음. 승인 기록 직접 수정도 막음 |
| 훅 (쓴 뒤) | 명세 문서를 저장할 때마다 형식 검사. 오류는 그 자리에서 고치게 함 |
| 훅 (세션 시작) | 진행 중인 명세와 다음 할 일을 알림 |

## 승인과 단계 잠금

- **승인은 사람이 합니다.** Claude는 단계 문서를 다 쓰면 멈추고 리뷰를 요청합니다. 대화에서 "승인"처럼 분명하게 답하거나 `/spec-mirror:approve`를 실행해야 기록됩니다. 애매한 반응은 승인으로 보지 않습니다.
- 승인 기록은 `<specRoot>/<이름>/.spec-mirror.json`에 **문서 해시**로 남습니다. 문서 자체에는 아무것도 덧붙이지 않습니다.
- 스킬은 검사 · 상태 · 골격 생성 명령만 미리 허용합니다. **승인 명령은 미리 허용하지 않아서**, 대화로 승인하더라도 실행 전에 Claude Code의 권한 확인을 한 번 더 거칩니다(`/spec-mirror:approve`는 사용자가 직접 부르므로 바로 실행됩니다).
- 승인할 때 그 단계 문서에 형식 오류가 있으면 승인되지 않습니다.
- 승인 뒤 문서가 바뀌면 **승인 후 변경됨**이 되고, 다음 단계가 잠깁니다.
- 앞 단계를 다시 승인하면 뒤 단계는 **앞 단계가 바뀜**이 되어 다시 확인하고 재승인해야 합니다.
- tasks의 체크 표시(`[ ]` `[-]` `[x]`)와 `결과:` 줄은 진행 기록이므로 승인을 풀지 않습니다.
- 단계 잠금 훅은 설정 `"stageGate": false`로 끌 수 있습니다. 승인 기록 보호는 꺼지지 않습니다.

## 리뷰

단계 문서를 다 쓰면 사용자에게 보여 주기 전에 `spec-reviewer` 에이전트가 **독립적으로** 리뷰합니다. 기능, 버그, adopt의 모든 단계와 명세 지도에 적용됩니다.

1. **첫 리뷰는 항상 합니다.** 리뷰어는 작성한 대화를 모르고 문서 · 규칙 · 코드만 봅니다.
2. **지적을 직접 확인합니다.** 메인 Claude가 지적마다 문서와 코드를 다시 보고 맞는 것만 반영합니다.
3. **구조가 바뀐 경우에만 다시 리뷰합니다.** 반영하면서 기준을 옮기거나 · 나누거나 · 합쳤거나 새로 넣었으면, **바뀐 부분만** 한 번 더 맡깁니다. 문장만 고쳤으면 다시 리뷰하지 않습니다.
4. **리뷰 결과를 보고합니다.** 승인 요청에 `지적 | 처리(반영 / 반영 안 함 / 사용자 판단) | 이유` 표가 함께 나옵니다.

## 형식 검사

검사기는 정해진 형식 가운데 기계로 확인할 수 있는 규칙을 모두 검사합니다. 실행 위치는 세 곳입니다.

- **훅**: 명세 문서를 쓰거나 고칠 때마다 자동으로 실행됩니다. 템플릿을 채우는 중(자리표시자 `<...>`가 남음)에는 막지 않고 남은 일만 알립니다.
- **명령**: `/spec-mirror:check`
- **CLI**: `node scripts/spec-mirror.mjs check`

| 범위 | 규칙 ID | 주요 규칙 |
|---|---|---|
| requirements | REQ000~018 | 섹션 순서 · User Story · 기준 묶음과 연속 번호 · 굵은 규칙 · 항목 이름 · 에러/응답/메시지 형식 · 금지 표현 · 기술 용어 · 코드 식별자 · `N.M` 참조 · 다른 기능 참조 `<기능> N.M` |
| design (기능) | DES000~011 | 목차와 8개 파일 · 제목 · 섹션 순서 · 컴포넌트 번호 · 필수 하위 섹션 · Prework · Property · Validates |
| tasks | TSK000~010 | 섹션 · 체크박스 형식 · 번호 · `_Requirements_` · Property · Dependency Graph · **모든 기준 포함 여부** |
| bugfix | BUG000~017 | 세 묶음 제목과 번호 · 기대 = 현재 수 · `재현:` · "지금처럼" · `명세:` 연결과 기준 존재 · 도메인 언어 |
| design (버그) | BDS000~010 | 섹션 순서 · `isBugCondition` 의사 코드 · Property 종류와 검증 범위 · 원인 항목 |
| tasks (버그) | BTK001~005 | 다섯 단계 순서 · 탐색·보존 테스트 필수 · 수정 뒤 확인 태스크 · 그래프 순서 · 탐색 결과 기록 |
| 명세 지도 | MAP000~005 | 제목과 섹션 · 표의 열 · 순서와 기능 링크 · 관련 기능 · 지도에 없는 기능 명세 |

- **오류**는 승인을 막고, **경고**는 리뷰에서 판단합니다.
- 규칙 ID별 설명은 각 규칙 문서 끝의 "검사 규칙" 표에 있습니다.

```text
$ node scripts/spec-mirror.mjs check confirm-recheck-mismatch

■ confirm-recheck-mismatch (버그)  — 오류 1, 경고 0
  오류 BUG007  docs/spec/confirm-recheck-mismatch/bugfix.md:58  3.4: 유지할 동작은 "**<조건>이면 지금처럼 <기존 동작>.**" 으로 씁니다.
```

## 추적: 문서 ↔ 테스트 ↔ 코드

```text
$ node scripts/spec-mirror.mjs trace order

| 기준 | 테스트 | 코드 | 불일치 내용 |
|---|---|---|---|
| R1-2 | src/test/.../OrderPlaceAcceptanceTest.kt:41 | src/main/.../OrderRequestValidator.kt:18 | — |
| R1-3 | — | src/main/.../OrderRequestValidator.kt:21 | 테스트 없음 |

코드에만 있는 번호 (문서에 없는 기준):
  - R10-1 (코드) src/main/.../OrderService.kt:52
처리 흐름 순서와 다른 주석:
  - src/main/.../OrderService.kt:30 R1-5 가 R1-6 보다 아래에 있습니다. 처리 흐름 순서와 다릅니다.
코드에서 찾지 못한 메시지:
  - R1-6 "상품 정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요."
```

| 대상 | 이름 규칙 |
|---|---|
| 기능 테스트 | `R{N}-{M} <기준 요약>`. 경계값은 `R1-2a`, `R1-2b` |
| 기능 코드 주석 | 분기 바로 위 `// R{N}-{M}` (언어의 주석 문법). 처리 흐름은 번호 순서대로 |
| 버그 테스트 | `명세:`가 있으면 그 기능 기준의 `R{N}-{M}`(새 테스트는 `R6-21c`처럼 접미사). 없으면 `B{N}-{M}` + 파일에 버그 이름 |

`trace <버그 이름>`은 기대 동작마다 테스트와 코드 주석을, 유지할 동작마다 보존 테스트를 찾습니다. `/spec-mirror:sync`는 이 표에 사람 눈의 대조(에러 코드 · 상태 · 결과 갈래 순서 · 주석 없는 분기)를 더해 보고한 뒤, 문서 기준으로 테스트 → 코드 순서로 고칩니다. 전체 규칙: [rules/traceability.md](rules/traceability.md)

## 설정

`/spec-mirror:init`이 프로젝트 루트에 `.spec-mirror/config.json`을 만듭니다. 모든 키는 생략할 수 있습니다.

```json
{
  "specRoot": "docs/spec",
  "techContext": ["CLAUDE.md", "README.md"],
  "extraItemLabels": [],
  "testPathPatterns": ["(^|/)(test|tests|__tests__|spec|specs)/", "(Test|Tests|Spec|IT)\\.[A-Za-z]+$"]
}
```

| 키 | 기본값 | 설명 |
|---|---|---|
| `specRoot` | `docs/spec` | 명세 폴더 위치 |
| `stageGate` | `true` | 단계 잠금 훅. `false`면 승인 전에도 다음 단계 문서를 쓸 수 있음 |
| `techContext` | `["CLAUDE.md", "README.md"]` | design · implement가 기술 맥락을 찾을 때 먼저 읽는 문서 |
| `extraItemLabels` | `[]` | 세부 항목 이름으로 더 허용할 이름. Glossary 용어와 Glossary에 나오는 영문 약어(예: PG)는 따로 넣지 않아도 됩니다 |
| `testPathPatterns` | 일반적인 테스트 경로 | 추적할 때 테스트 파일을 구분하는 정규식 |
| `ignoreDirs` | `.git`, `node_modules`, `build` 등 | 추적할 때 건너뛸 폴더 |
| `sourceExtensions` | 주요 언어 확장자 | 추적 대상 파일 확장자 |

## 기술 스택

spec-mirror는 **특정 언어 · 프레임워크를 가정하지 않습니다.** 문서 형식은 기술과 무관하고, 기술은 프로젝트에서 찾습니다. design과 implement는 다음 순서로 기술 맥락을 확인합니다.

1. 설정 `techContext`의 문서 (예: CLAUDE.md의 아키텍처 · 테스트 관례)
2. 빌드 · 의존성 파일 (`build.gradle`, `package.json`, `pyproject.toml`, `go.mod` …)
3. 같은 종류의 기존 코드와 테스트
4. 세션에서 쓸 수 있는 기술 전용 스킬
5. 그래도 정할 수 없으면 사용자에게 묻습니다

팀의 기술 관례를 스킬이나 CLAUDE.md로 정리해 두면 design 품질이 그만큼 일정해집니다.

## CI 연동

검사기는 의존성이 없는 Node 스크립트라서 CI에서 그대로 실행할 수 있습니다.

```yaml
# .github/workflows/spec.yml
name: spec
on: [pull_request]
jobs:
  spec-mirror:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/checkout@v4
        with:
          repository: b2aconnn/spec-mirror
          path: .spec-mirror-plugin
          token: ${{ secrets.SPEC_MIRROR_TOKEN }}   # 저장소가 비공개인 동안 필요 (읽기 권한 토큰)
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node .spec-mirror-plugin/scripts/spec-mirror.mjs check
```

| CLI 명령 | 설명 | 종료 코드 |
|---|---|---|
| `check [이름...] [--json] [--draft]` | 형식 검사 | 오류 있으면 1 |
| `trace <이름> [--json]` | 추적표 | 불일치 있으면 1 |
| `status [이름...] [--json]` | 승인 상태 · 진행률 · 다음 할 일 | 0 |
| `next <이름> [--json]` | 지금 할 일 하나 (`write` · `approve` · `implement` · `sync`) | 0 |
| `gate <이름> <단계\|implement>` | 앞 단계 승인 확인 | 미승인이면 1 |
| `approve <이름> <단계>` | 승인 기록 | 실패하면 1 |
| `scaffold <이름> <단계> [--adopt]` | 빈 템플릿 생성 (덮어쓰지 않음). `--adopt`는 기존 코드에서 옮기는 명세로 표시 | 0 |
| `list [--json]` | 명세 목록과 종류 | 0 |
| `map [--json]` | 명세 지도 검사와 기능별 진행 상황 | 오류 있으면 1 |
| `scaffold map` | 명세 지도 템플릿 생성 | 0 |
| `init` | 설정 파일 생성 | 0 |

## 저장소 구조

```
spec-mirror/
├── .claude-plugin/
│   ├── plugin.json              플러그인 매니페스트
│   └── marketplace.json         설치용 마켓플레이스 정의
├── skills/                      /spec-mirror:<명령> 9개 (spec · bugfix · adopt 는 stages/ 에 단계별 안내)
├── agents/spec-reviewer.md      독립 리뷰 에이전트
├── hooks/hooks.json             단계 잠금 · 형식 검사 · 세션 시작 알림
├── rules/                       형식 규칙의 원본 (스킬과 에이전트가 매번 읽음)
│   ├── feature/                 requirements · design · tasks
│   ├── bugfix/                  bugfix · design · tasks
│   ├── adopt.md                 기존 코드에서 명세 만들기
│   ├── spec-map.md              명세 지도
│   ├── traceability.md
│   └── workflow.md
├── templates/                   scaffold 가 복사하는 빈 문서 (feature/, bugfix/, adopt/, map.md)
├── examples/                    정답 예제 (검사기 테스트의 기준)
│   ├── README.md                명세 지도 예제
│   ├── order/
│   └── confirm-recheck-mismatch/
├── scripts/
│   ├── spec-mirror.mjs          CLI 진입점 (의존성 없음)
│   └── lib/                     검사 · 승인 · 추적 · 훅 모듈
└── tests/                       검사기 테스트 (node:test)
```

규칙의 원본은 `rules/` 하나입니다. 스킬은 규칙을 복사해 두지 않고 실행할 때마다 읽으므로, 규칙을 고치면 모든 단계에 바로 반영됩니다.

## 문제 해결

**훅이 실행되지 않습니다.**
- `node --version`이 18 이상인지 확인합니다.
- 명세가 설정의 `specRoot` 아래 `<이름>/requirements.md` 또는 `<이름>/bugfix.md`인지 확인합니다. 훅은 그 폴더의 명세 문서에만 반응합니다.

**"앞 단계 승인 뒤에 씁니다"라며 문서를 쓰지 못합니다.**
- 단계 잠금 훅입니다. `/spec-mirror:status <이름>`으로 상태를 보고, 앞 단계 문서를 리뷰한 뒤 승인합니다.

**design 단계가 "승인 후 변경됨"으로 막힙니다.**
- 승인 뒤 앞 단계 문서가 바뀌었습니다. 바뀐 내용을 리뷰한 뒤 다시 승인합니다.

**버그 탐색 테스트가 고치기 전에 통과합니다.**
- 원인 분석이 틀렸거나 테스트가 버그 조건을 만들지 못한 것입니다. Claude는 여기서 멈추고 보고합니다. design의 Hypothesized Root Cause를 다시 보고, 고친 뒤 재승인합니다.

**경고가 많이 나옵니다.**
- 경고는 승인을 막지 않습니다. 의도한 표현이면 그대로 두어도 됩니다.
- Glossary에 없는 외부 시스템 이름을 항목 이름으로 쓴다면 `extraItemLabels`에 추가합니다.

**추적표가 테스트를 코드로 분류합니다.**
- `testPathPatterns`에 프로젝트의 테스트 경로 규칙을 추가합니다.

## 개발

```bash
npm test                              # 검사기 테스트 (node:test)
node scripts/spec-mirror.mjs check    # 현재 폴더 기준 형식 검사
claude plugin validate .              # 플러그인 구조 검증
claude --plugin-dir .                 # 수정한 플러그인으로 Claude Code 실행
```

- 형식 규칙을 바꿀 때는 `rules/`, `scripts/lib/`, `templates/`, `tests/`를 함께 고칩니다. 두 정답 예제가 여전히 **오류 0건 · 경고 0건**인지 확인합니다.
- 버전은 [Semantic Versioning](https://semver.org/)을 따릅니다. 형식이 바뀌어 기존 문서가 새로 오류가 되는 변경은 메이저 버전입니다.
- 변경 이력: [CHANGELOG.md](CHANGELOG.md)

## 라이선스

Copyright (c) 2026 b2aconnn. All rights reserved.

공개 배포 전까지는 저작권자의 허락 없이 복제 · 수정 · 배포할 수 없습니다. 공개할 때 오픈소스 라이선스로 바꿀 예정입니다. [LICENSE](LICENSE)를 확인하세요.
