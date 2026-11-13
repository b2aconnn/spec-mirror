# 기능 명세 2단계: design

design은 requirements의 도메인 용어와 기준을 **코드에 연결**하는 문서입니다. requirements에 없는 동작을 design에서 새로 만들지 않습니다.

## 읽을 것

1. `<BASE>/../../rules/feature/design-format.md` — 파일 구성과 섹션 규칙, 기술 정보 찾기
2. `<BASE>/../../rules/traceability.md` — 테스트 이름과 코드 주석
3. `<BASE>/../../rules/convention.md` — convention이 없을 때 만드는 법, 우선순위, design에서 읽는 범위
4. `<BASE>/../../examples/order/design.md`와 `<BASE>/../../examples/order/design/` — 형식 기준. 예제의 기술 스택과 구조는 따라 하지 않습니다. 작은 기능은 `<BASE>/../../examples/wishlist/design/`을 분량 기준으로 봅니다

## 절차

1. **단계 잠금을 확인합니다.** `SM gate <이름> design`이 실패하면 멈추고 requirements 승인부터 안내합니다.

2. **convention을 확인합니다.** `SM convention`으로 문서가 있는지 봅니다.
   - **있으면** 설계에 관한 것(구조와 의존 방향, 이름 규칙, 예외 · 에러 응답, 검증 방식, 트랜잭션, 저장소, 외부 연동, 테스트 종류 · 도구)을 읽습니다. 고치지 않고, 아키텍처를 추천하지 않습니다.
   - **없으면** `rules/convention.md`의 "없을 때"를 따릅니다. 프로젝트 종류와 규모에 맞는 아키텍처를 추천하고, 사용자가 고르면 초안을 보여 주고 확인받은 뒤 저장합니다. 그 전에는 design을 쓰지 않습니다.

3. **용어를 convention에 반영할지 묻습니다.** design을 쓰기 전에 합니다. `rules/convention.md`의 "용어"를 따릅니다.
   - requirements Glossary를 convention 용어와 대조해, convention에 없는 용어와 다르게 쓴 용어를 표로 보여 줍니다.

     | 용어 | 상태 | 제안 |
     |---|---|---|
     | 결제 기한 (Expires At) | convention에 없음 | 추가 |
     | 사용자 (User) | convention은 "회원 (Member)" | convention 유지, requirements를 맞춤 |

   - 용어마다 추가 · 변경 · 그대로 중 무엇을 할지 받습니다. 받은 대로 convention을 고치고(requirements를 고쳐야 하면 고친 뒤 requirements 재승인), 그다음 design을 씁니다.
   - 대조할 용어가 없으면 "convention과 다른 용어 없음"으로 보고하고 넘어갑니다.

4. **requirements를 읽고 목록을 만듭니다.**
   - Glossary 용어 전체
   - 모든 기준 `N.M`과 각 기준의 에러 코드·메시지·로그·상태 변화
   - 외부 시스템과 정책 수치

5. **기술 맥락을 찾습니다.** 규칙 파일의 "기술 정보 찾기" 순서(convention → `techContext` 문서 → 빌드 파일 → 기존 코드)를 따릅니다.
   - convention이 spec-mirror 추적 규칙(테스트 이름, `R{N}-{M}` 주석, 에러 메시지 원문)과 부딪치면 그 부분만 추적 규칙을 따르고 보고에 적습니다.
   - 정할 수 없는 것은 **추측하지 말고** 선택지와 추천을 들어 사용자에게 묻습니다.

6. **작성합니다.**
   - `SM scaffold <이름> design`으로 목차 + 8개 파일의 골격을 만든 뒤 채웁니다.
   - 순서: 01 → 08 → 마지막에 design.md Overview
   - 01: `### 따른 convention` 표(항목, 따른 규칙, 근거 문서)를 먼저 씁니다. 나머지 파일은 이 표를 따릅니다.
   - 02: 컴포넌트는 convention의 구조대로 나누고, 요청이 흐르는 순서로 둡니다. 메서드 안의 확인 순서는 requirements 처리 흐름 순서와 같습니다. 기준 하나는 한 곳에서 판단합니다.
   - 02 · 03의 이름: Glossary 영문 표기와 기존 코드의 이름을 쓰고, 03 `### 도메인 용어 ↔ 코드` 표에 Glossary 용어를 **모두** 넣습니다. 접미사 · 메서드 이름 스타일은 convention을 따릅니다. 이름과 설명은 비즈니스 용어로 씁니다.
   - 04: 에러 코드와 메시지를 requirements와 **글자까지 같게** 옮기고, 모든 `로그:` 항목을 로깅 표에 넣습니다. 여러 위반이 겹칠 때 하나를 고르는 순서를 씁니다.
   - 05: convention의 테스트 종류, `기준 ↔ 테스트` 표, `에러 ↔ 응답 테스트` 표, 테스트 지원 코드, 테스트 기준 데이터를 씁니다. 기준은 02에서 그 판단을 하는 코드를 확인하는 테스트가 맡습니다. 04의 에러마다 회원이 받는 응답을 확인하는 시나리오가 하나 이상 있어야 하고, 모든 경계값에 그 값을 만드는 데이터가 있어야 합니다. 테스트 형식은 `<BASE>/../../rules/traceability.md`의 "테스트"를 따릅니다.
   - 07: Prework 제목은 기준 문장 그대로입니다. PROPERTY로 분류한 기준은 모두 어떤 Property의 Validates에 넣습니다.
   - 해당 없는 섹션은 제목을 남기고 "해당 없음 — <이유>"라고 씁니다.

7. **기계 검사를 통과시킵니다.** `SM check <이름>`의 **오류를 0건**으로 만듭니다 (REQ·DES 규칙 모두).

8. **requirements와 대조합니다.** 아래 표를 만들어 빈 칸이 없는지 확인합니다.

   | 기준 | 구현 위치(컴포넌트·메서드) | 테스트 종류 · 묶음 | Property |
   |---|---|---|---|

   - 칸이 비면 design을 보완합니다.
   - requirements에 없는 분기가 필요해 보이면 design에 넣지 말고 "requirements 보완 필요"로 보고합니다.

9. **독립 리뷰를 받습니다.** `<BASE>/../../rules/workflow.md`의 "리뷰"를 따릅니다. 단계는 `design`, requirements·design 경로와 convention 문서 경로를 넣습니다.

## 보고

- convention: 새로 만들었으면 고른 아키텍처와 만든 문서, 있었으면 따른 설계 규칙. 추적 규칙 때문에 따르지 않은 것
- 용어: convention에 추가 · 변경한 용어
- 핵심 설계 결정: 기술 선택과 근거, 트랜잭션·외부 호출 경계, 동시성 처리
- requirements 보완이 필요한 항목
- 리뷰 결과 표 (지적 / 처리 / 이유)
- 남은 경고

## 하지 않는 것

- requirements를 몰래 고치지 않습니다. 고쳐야 하면 멈추고 묻습니다. 고친 뒤에는 requirements 재승인이 필요합니다.
- 정해진 8개 파일 외의 design 파일을 만들거나 섹션 순서를 바꾸지 않습니다.
- 코드를 고치지 않습니다.
