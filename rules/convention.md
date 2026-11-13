# convention 규칙

spec-mirror는 **명세를 쓰고, 명세와 테스트 · 코드를 잇는 일**만 정합니다. 아키텍처, 계층 · 모듈 구조, DDD를 쓸지, 이름 스타일, 검증 · 예외 처리 방식, 테스트 종류, 코드 스타일은 프로젝트마다 다르므로 **프로젝트 convention**이 정합니다.

## 위치

두 곳에서 찾고, 찾은 문서를 모두 읽습니다.

| 설정 | 기본값 | 찾는 것 |
|---|---|---|
| `conventionDir` | `docs/convention` | 그 폴더 안의 모든 파일 (하위 폴더까지) |
| `conventionFiles` | `convention.md`, `*-convention.md` | 프로젝트 어디서든 이 이름의 파일. 예: `convention.md`, `project-convention.md`, `backend-convention.md`. `*`는 아무 글자, 대소문자 무시 |

- `ignoreDirs`(`node_modules`, `build` 등)와 `.`으로 시작하는 폴더 · 파일은 찾지 않습니다.
- 검사기의 `convention` 명령(스킬에서는 `SM convention`)으로 찾은 문서 목록을 봅니다.
- 한쪽만 쓰려면 `conventionDir`을 `""`로, 또는 `conventionFiles`를 `[]`로 둡니다.

## 있을 때

**고치지 않고 그대로 따릅니다.** 아키텍처를 새로 추천하지 않습니다.

## 없을 때

찾은 convention 문서가 하나도 없으면, 설계나 구현을 시작하기 전에 **만듭니다**. 만드는 곳은 `conventionDir`입니다. `init`, design(기능 · 버그 · adopt), implement 중 먼저 오는 곳에서 한 번 합니다.

1. **무엇을 만드는 프로젝트인지 봅니다.** 빌드 파일, 소스 트리, 기존 코드로 백엔드 · 프론트엔드 · 둘 다 · 그 밖(모바일, 배치, 라이브러리)을 가립니다.
2. **기존 코드가 있으면 지금 구조를 먼저 읽습니다.** 계층 · 모듈, 이름, 검증 · 예외 처리, 테스트 도구 · 종류를 코드에서 찾습니다.
3. **아키텍처를 추천합니다.** 아래 표에서 프로젝트 종류와 규모에 맞는 것을 골라, 근거(규모 신호)와 함께 제안합니다.
   - 기존 코드가 있으면 **지금 구조를 첫 번째 선택지**로 둡니다. 규모에 더 맞는 구조가 있으면 함께 제안하되, 바꾸는 비용도 적습니다.
   - adopt는 지금 코드를 그대로 옮기는 일이므로 추천하지 않고 지금 구조를 그대로 적습니다.
4. **사용자가 고릅니다.** 고르기 전에는 만들지 않습니다.
5. **초안을 씁니다.** `templates/convention/`의 틀로, 고른 구조와 기존 코드에서 찾은 규칙을 채웁니다. 초안을 보여 주고 사용자가 확인하면 저장합니다.
6. 이후로는 "있을 때"와 같습니다.

### 규모 신호

| 신호 | 작음 | 보통 | 큼 |
|---|---|---|---|
| 기능 · 화면 수 | 몇 개 | 수십 개 | 많고 계속 늘어남 |
| 상태 · 규칙 | 단순 CRUD | 상태 전이, 여러 값을 함께 지키는 규칙 | 여러 대상에 걸친 규칙, 동시성 |
| 외부 연동 | 없거나 조회만 | 몇 개 | 많고 결과가 불확실함(결과 불명, 대사) |
| 팀 · 수명 | 한두 명, 짧게 씀 | 한 팀 | 여러 팀, 오래 씀 |

애매하면 낮은 쪽을 고릅니다. 규모보다 높은 신호 몇 개는 그 부분만 보강합니다(예: 작은 프로젝트의 외부 연동 하나에만 인터페이스를 둠).

### 추천 아키텍처

| 종류 | 작음 | 보통 | 큼 |
|---|---|---|---|
| 백엔드 | 3 layer (Controller · Service · Repository), 규칙은 서비스에 흐름대로 | 3 layer + 도메인 모델(상태 전이 · 규칙을 엔티티가 지킴) | DDD(Aggregate · Value Object · Domain Event) + 헥사고날(포트 · 어댑터), 필요하면 모듈러 모놀리스 |
| 프론트엔드 | 페이지 기준 폴더 (pages · components · api) | Feature-based (`features/<기능>/` 안에 화면 · 상태 · api) | Feature-Sliced Design (app · pages · widgets · features · entities · shared) 또는 모노레포 패키지 분리 |

그 밖의 종류도 같은 방식으로 규모에 맞게 추천합니다.

### 문서에 담을 것

| 문서 | 내용 |
|---|---|
| `architecture.md` | 구조와 의존 방향, 패키지 · 폴더 배치, 규칙(불변식 · 상태 전이)을 두는 곳, 외부 연동 방식, 트랜잭션 |
| `coding.md` | 이름 규칙(접미사, 메서드 이름), 검증 · 예외 · 에러 응답 방식, 로깅, 코드 스타일, 커밋 규칙 |
| `testing.md` | 테스트 종류(예: 유닛 · 통합 · E2E)와 각각 무엇을 확인하는지, 도구, 테스트 위치 · 묶음, 가짜 구현 · 고정 시계 |

프로젝트에 필요한 문서를 더 둘 수 있습니다. spec-mirror의 추적 규칙(아래 우선순위 1)은 convention에 옮겨 적지 않습니다.

## 용어

convention 문서에 용어(용어집, Glossary, 용어 표 등)가 있으면 **그 용어가 가장 우선**합니다. requirements의 Glossary는 convention 용어를 그대로 쓰고, convention에 없는 개념만 새로 정의합니다([용어 정하기](feature/requirements-format.md#용어-정하기-기존-용어--현업-용어)).

**design 전에 묻습니다.** requirements를 쓴 뒤 design을 시작하기 전에, Glossary 용어를 convention과 대조해 다음을 사용자에게 묻습니다.

| 경우 | 묻는 것 |
|---|---|
| convention에 없는 용어 | convention에 추가할지 |
| convention과 다르게 쓴 용어 (Open Questions에 올린 것) | convention을 바꿀지, requirements를 convention에 맞출지 |

- 사용자가 고른 대로 convention을 고친 뒤에 design을 시작합니다. 고르지 않은 용어는 그대로 둡니다.
- 이것은 "있을 때는 고치지 않는다"의 예외입니다. 사용자가 고른 용어만, 고른 대로 고칩니다.
- 넣을 곳은 convention의 용어 문서입니다. 없으면 어디에 둘지 묻고, 기본은 `<conventionDir>/glossary.md`(틀: `templates/convention/glossary.md`)입니다.
- 묻는 일은 기능 명세(spec)와 기존 코드 옮기기(adopt)의 design 시작 때 합니다. 버그 명세는 convention 용어를 따르기만 합니다.

## 우선순위

| 순서 | 무엇 | 내용 |
|---|---|---|
| 1 | spec-mirror 추적 규칙 | 테스트 이름 `R{N}-{M} <상황>이면 <결과>다`와 given / when / then 본문, 분기 주석 `R{N}-{M}`, 에러 코드 · 메시지를 requirements와 글자까지 같게 쓰기 |
| 2 | convention 문서 | 팀이 정한 설계 · 개발 규칙 |
| 3 | 승인된 design | 이 기능의 설계 |
| 4 | 프로젝트에서 찾은 것 | `techContext` 문서, 빌드 파일, 기존 코드 |

1은 명세와 코드를 잇는 데 필요한 것이라 convention보다 앞섭니다. convention이 1과 부딪치면 그 부분만 1을 따르고, 나머지는 convention을 따른 뒤 보고에 적습니다.

예: convention이 테스트 이름을 `should_…`로 정했다 → 테스트 이름만 `R6-17 결제사가 주문과 같은 내용으로 승인하면 결제가 완료된다`로 쓰고, 테스트 위치 · 도구 · 픽스처 작성법은 convention을 따릅니다.

## 단계별로 읽는 범위

| 단계 | 읽는 범위 | 예 |
|---|---|---|
| design (기능 · 버그 · adopt) | **설계에 관한 것만** | 구조와 의존 방향, 이름 규칙, 예외 · 에러 응답 구조, 검증 방식, 트랜잭션, 저장소 · DB 규칙, 외부 연동 방식, 테스트 종류 · 도구 |
| 구현 (implement, sync의 수정, adopt의 도입 작업) | **전부** | 위 내용에 더해 코드 스타일, 포맷, import, 주석, 로깅, 테스트 작성법, 커밋 규칙 |

- design에는 코드 스타일 · 포맷 · 커밋 규칙을 옮겨 적지 않습니다. 구현 단계에서 convention을 직접 보고 지킵니다.
- design에서 따른 convention은 01 Architecture의 `### 따른 convention` 표에 남깁니다(항목, 따른 규칙, 근거 문서).

## 다를 때

- **design이 convention과 다름** (구현 중에 발견): 그 태스크를 멈추고 보고합니다. design을 고칠지는 사용자가 정합니다.
- **기존 코드가 convention과 다름**: 새로 쓰거나 고치는 코드만 convention을 따릅니다. 태스크 범위 밖의 기존 코드는 고치지 않고 보고합니다. adopt는 지금 코드를 그대로 옮기고, 다른 곳만 보고합니다.
- **convention에 없음**: 기존 코드를 따르고, 그래도 정할 수 없으면 사용자에게 묻습니다. 정한 것이 앞으로도 쓰일 규칙이면 convention에 더할지 사용자에게 묻습니다.
