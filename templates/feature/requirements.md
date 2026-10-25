# Requirements Document

## Introduction

<기능이 무엇이고 왜 필요한지 2~5문장>

- 범위 밖: <이번에 다루지 않는 것>
- API 경로, 코드 구조, 저장 구조 등 구현 정보는 [design.md](design.md)에 있습니다.

## Glossary

- **<도메인 용어> (<English>)**: <정의>
- **<상태 묶음 이름> (<English> Status)**
  - <한글 상태명> (`<ENUM_VALUE>`): <의미>

## Requirements

### Requirement 1: <기능 이름>

**User Story:** As a <역할>, I want to <행동>, so that <얻는 가치>

#### Acceptance Criteria

##### 처리 흐름

1. **<역할>은 <무엇을> 할 수 있다.**
   - 요청 정보: <보내는 정보>

2. **<지켜야 할 비즈니스 규칙>.** <어기면 어떻게 되는지>.
   - 경계: <허용 값> 가능, <거부 값> 불가
   - 에러: `<상태>` `<ERROR_CODE>`
   - 메시지: "<안내 문구>"

3. **<결과를 응답한다>.**
   - 응답: `<상태>` — <응답 내용>

##### 항상 지켜야 할 규칙

4. **<흐름의 어느 시점에서든 성립해야 하는 규칙>.**

## Open Questions

없음
