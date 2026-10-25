# 버그 명세 3단계: tasks

버그 tasks는 순서가 고정입니다: **탐색 테스트(고치기 전 실패) · 보존 테스트(고치기 전 통과) → 수정 → 확인 → 명세 반영 → Checkpoint**

## 읽을 것

1. `<BASE>/../../rules/bugfix/tasks-format.md`
2. `<BASE>/../../rules/feature/tasks-format.md`의 "태스크 규칙"과 "Task Dependency Graph 규칙" — 줄 형식과 그래프는 같습니다
3. `<BASE>/../../examples/confirm-recheck-mismatch/tasks.md` — 정답 예제

## 절차

1. **단계 잠금을 확인합니다.** `SM gate <이름> tasks`가 실패하면 멈추고 상태를 알립니다.

2. **입력을 모읍니다.**
   - bugfix.md의 모든 항목 (1.M, 2.M, 3.M)
   - design의 Property 목록(번호와 이름), Fix Implementation의 고칠 곳, Testing Strategy의 테스트 이름
   - 고친 뒤 바뀔 기능 명세 기준

3. **작성합니다.** `SM scaffold <이름> tasks`로 골격을 만든 뒤 채웁니다.
   - 1번: Bug Condition Property 전부, 테스트 이름과 위치, 예상 반례. `_Requirements_`는 1.M과 2.M
   - 2번: Preservation Property 전부, 기존 테스트 이름, 새로 쓸 테스트. `_Requirements_`는 3.M
   - 3번: 고칠 곳마다 하위 태스크 하나, 그 뒤에 `탐색 테스트 통과 확인`, `보존 테스트 통과 확인`
   - 4번: 고칠 기능 명세 기준(requirements, 필요하면 design)과 재승인. 바뀌는 것이 없으면 "변경 없음 확인"
   - 5번: 전체 테스트, `/spec-mirror:sync <기능>`, `/spec-mirror:sync <버그 이름>`
   - Dependency Graph: 1·2번 → 고치는 일 → 두 확인 → 4 → 5

4. **기계 검사를 통과시킵니다.** `SM check <이름>`의 **오류를 0건**으로 만듭니다. 특히 BTK001(순서), BTK002(Property), BTK004(그래프)를 확인합니다.

5. **독립 리뷰를 받습니다.** `<BASE>/../../rules/workflow.md`의 "리뷰"를 따릅니다. 단계는 `bugfix-tasks`입니다.

## 보고

- 탐색 테스트와 예상 반례
- 보존 테스트 (기존 / 신규)
- 고칠 곳
- 명세 반영 대상
- 리뷰 결과 표 (지적 / 처리 / 이유)
- 승인 뒤 할 일: `/spec-mirror:implement <이름>`

## 하지 않는 것

- 코드를 고치지 않습니다.
