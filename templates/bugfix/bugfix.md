# Bugfix Requirements Document

## Introduction

<어떤 상황에서 무엇이 잘못되는지, 누가 어떤 영향을 받는지 2~5문장>

- 관련 명세: [<기능> requirements](../<기능>/requirements.md) <N.M>
- 범위 밖: <이번에 고치지 않는 것>
- 원인과 고치는 방법은 [design.md](design.md)에 있습니다.

## Bug Analysis

### Current Behavior (Defect)

1.1 **<조건>이면 <잘못된 동작>.**
   - 재현: <어떤 요청·상태에서>
   - 에러: `<상태>` `<ERROR_CODE>`
   - 메시지: "<지금 보이는 문구>"

### Expected Behavior (Correct)

2.1 **<조건>이면 <올바른 동작>.**
   - 에러: `<상태>` `<ERROR_CODE>`
   - 메시지: "<안내 문구>"
   - 명세: <기능> <N.M>

### Unchanged Behavior (Regression Prevention)

3.1 **<비슷하지만 버그가 아닌 조건>이면 지금처럼 <기존 동작>.**
   - 응답: `<상태>` — <응답 내용>
   - 명세: <기능> <N.M>

## Open Questions

없음
