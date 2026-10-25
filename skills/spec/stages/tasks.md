# 기능 명세 3단계: tasks

tasks.md는 design을 **구현 순서**로 옮긴 계획입니다.

## 읽을 것

1. `<BASE>/../../rules/feature/tasks-format.md`
2. `<BASE>/../../examples/order/tasks.md` — 항목의 길이와 말투를 맞춥니다

## 절차

1. **단계 잠금을 확인합니다.** `SM gate <이름> tasks`가 실패하면 멈추고 상태를 알립니다.

2. **입력을 모읍니다.**
   - requirements의 모든 기준 `N.M`
   - design 02의 컴포넌트 목록, 05의 테스트 묶음, 07의 Property 목록(번호와 이름)
   - design에 적힌 기존 코드·테스트 이관 필요 여부

3. **순서를 잡습니다.**
   1. (필요하면) 0. 요구사항 보완 확정
   2. 공통 기반 (설정, 공통 에러, 테스트 지원 코드)
   3. 도메인 모델·저장소
   4. Checkpoint
   5. 기능별 묶음 (Requirement 순서. 다른 Requirement의 결과를 검증에 쓰는 것은 뒤로) + Checkpoint
   6. 최종 Checkpoint - 명세 동기화

   기능 묶음마다 `인수 테스트 작성: <테스트 묶음>`을 먼저 두고 구현 태스크를 뒤에 둡니다. Property 테스트는 `*` 선택 태스크로 그 묶음 안에 둡니다.

4. **작성합니다.**
   - `SM scaffold <이름> tasks`로 골격을 만든 뒤 채웁니다.
   - 모든 구현·테스트 태스크에 `_Requirements: N.M_`을 씁니다.
   - Property 태스크는 design과 같은 번호·이름으로 `**Property N: 이름**`, `**Validates: Requirements …**`를 씁니다.
   - 마지막으로 Task Dependency Graph를 씁니다. 하위 태스크가 없는 모든 태스크가 정확히 한 번 나와야 합니다.

5. **기계 검사를 통과시킵니다.** `SM check <이름>`의 **오류를 0건**으로 만듭니다. 특히 TSK009(태스크에 없는 기준)와 TSK008(그래프 누락·중복)을 확인합니다.

6. **독립 리뷰를 받습니다.** `<BASE>/../../rules/workflow.md`의 "리뷰"를 따릅니다. 단계는 `tasks`, requirements·design·tasks 경로를 넣습니다.

## 보고

- 묶음별 태스크 수, 필수 / 선택 태스크 수
- 병렬로 진행할 수 있는 구간 (wave)
- 리뷰 결과 표 (지적 / 처리 / 이유)
- 승인 뒤 할 일: `/spec-mirror:implement <이름>`

## 하지 않는 것

- requirements·design에 없는 일을 태스크로 만들지 않습니다. 필요하면 앞 단계 보완으로 보고합니다.
- 코드를 고치지 않습니다.
