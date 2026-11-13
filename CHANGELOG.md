# Changelog

이 프로젝트의 변경 이력입니다. 버전은 [Semantic Versioning](https://semver.org/)을 따릅니다.

## [0.8.0] - 2026-11-13

### 추가
- requirements "용어 정하기": 용어는 새로 짓기 전에 다른 명세의 Glossary, 코드의 엔티티 · enum, 기존 메시지에서 찾아 같은 개념이면 그 이름을 씀 (예: 코드에 `User`가 있으면 회원(Member)이 아니라 사용자(User)). 영문 표기는 코드 이름 그대로, 한글 용어는 현업에서 쓰는 비즈니스 말. 개발자 말(레코드, 플래그, 엔티티)은 쓰지 않음
- spec · adopt · bugfix 작성 안내에 용어 찾기 단계, 보고에 용어 출처. 작성 후 점검 · 리뷰어에 용어 항목
- design "검증 위치": 요청만 보고 알 수 있는 검증은 Controller에서 Bean Validation 표준 어노테이션(`@NotNull` · `@NotBlank` · `@NotEmpty` · `@Size` · `@Min` · `@Max` · `@Pattern` · `@Email` …)으로, 비즈니스 검증은 Application Service · Aggregate · Domain Service에서. 커스텀 제약은 표준으로 안 될 때만. 여러 위반이면 requirements 순서상 앞선 하나만 응답
- 04 템플릿 계층별 예외 처리를 요청 검증 / 비즈니스 검증으로 나눔. design · implement 안내와 리뷰어에 검증 위치 반영

### 변경
- design "이름 짓기": 기존 코드에 같은 개념의 이름이 있으면 그 이름. 관례 접미사 `…Request` · `…Response` · `…Command` · `…Result` · `…Query` 명시. design 본문도 비즈니스 용어로
- 예제 order: 요청 값 Value Object(`OrderRequestItems`, `IdempotencyKey`)를 없애고 Order Controller의 Bean Validation(`PlaceOrderRequest` 어노테이션, `@UniqueProductIds`, `OrderRequestValidationHandler`)으로 옮김. 페이지 요청 확인(4.2)도 Controller로

## [0.6.0] - 2026-11-12

### 변경
- requirements 색 범례 위치를 문서 맨 위(제목 아래)에서 `## Requirements` 바로 아래(첫 Requirement 앞)로 옮김. 아이콘이 처음 나오는 곳 가까이에서 뜻을 볼 수 있게 함
- 검사 REQ020: 새 위치에서 범례를 찾음. 맨 위에만 있으면 경고
- 규칙 · 템플릿 · 작성 안내 · README · 예제 order · wishlist 반영
- requirements를 한국어 틀로 바꿈: 요구사항 · 개요 · 용어 · 기능별 요구사항 · 요구사항 N · 사용자 이야기("<누가>는 <무엇을> 하고 싶다. <왜> 위해서다.") · 인수 조건 · 확인이 필요한 사항. 템플릿과 예제 order · wishlist를 한국어 틀로 다시 씀
- 영어 틀(Requirements Document · Introduction · User Story …)도 그대로 받음. 검사 REQ021(경고): 한 문서에 두 틀이 섞임
- 문장 규칙 14 "한국 사람이 읽기 편한 한국어": 번역체("~로 본다") 피하기, 한 문장에 하나, 현업에서 쓰는 말, 번호 참조는 문장 끝, 확인 사항은 질문으로. 작성 안내 · 리뷰어에 반영

## [0.5.0] - 2026-11-12

### 변경
- requirements: ⛔ `예외` 표시를 없애고, 처리 흐름의 모든 기준 앞에 색을 표시. 🟢 기능 흐름(요청 · 동작 · 응답) · 🟠 검증 · 🟣 외부 요청. 종류 글자는 쓰지 않고, 뜻은 문서 맨 위 범례 한 줄에 둠
- 분류 근거: Cockburn *Writing Effective Use Cases*의 단계 종류(상호작용 · 검증 · 내부 변경), `항상 지켜야 할 규칙`은 Design by Contract의 불변식
- 검사 REQ019를 오류로 바꿈: 처리 흐름 기준에 색 표시가 없음, 그 밖의 아이콘, 색 뒤에 종류 글자, `항상 지켜야 할 규칙`에 표시
- 예제 order 6.17의 굵은 문장에서 "결과를 응답한다"를 뺌 (응답은 세부 항목). 예제 order 4.4에 `응답: 200` 추가

### 추가
- 검사 REQ020(경고): 처리 흐름이 있는데 제목 아래에 색 범례 표가 없음

## [0.4.0] - 2026-11-11

### 추가
- requirements: 에러로 끝나는 기준 앞에 ⛔ `예외` 표시. 표시 없는 줄은 기능, ⛔ 줄은 예외로 한눈에 구분
- 검사 REQ019(경고): `에러:`가 있는데 표시가 없거나, 없는데 표시가 있음

### 변경
- 예제 order · wishlist requirements와 템플릿, README 예시에 표시 적용

## [0.3.0] - 2026-11-11

### 추가
- design 규칙 "이름 짓기": 도메인 개념은 Glossary 영문 표기, 상태 값은 Glossary `ENUM` 그대로, 상태 전이는 행위 메서드(`cancel`, `expire`), 유스케이스는 첫 기준의 동사, 뜻이 흐린 이름(`…Manager`, `process…`, `data`) 금지
- 검사 DES016(경고): Glossary 용어가 03 `도메인 용어 ↔ 코드` 표에 없음
- `trace`: Glossary 상태 값이 코드에 없으면 알림
- implement는 03 표대로 이름을 짓고, 표에 없는 도메인 개념은 멈춰서 보고. sync · 리뷰어에 이름 점검 항목

### 변경
- 예제 order: 용어 표에 빠진 Glossary 용어 추가, 주문 상태 전이를 `markPaid` · `markPaymentFailed` · `cancel` · `expire`로 나눔 (`changeOrderStatus` 제거)

## [0.2.0] - 2026-11-11

### 추가
- design을 DDD로 설계하되 기능 규모에 맞춰 적용: 01 `### 설계 규모`(작음 · 보통 · 큼, 신호 표) · `### 도메인 경계`, 02 `**역할:**`(DDD 구성 요소와 분리 조건), 03 `### Aggregates` · `### Value Objects`
- 규칙 `rules/feature/design-format.md`의 "설계 규모와 DDD": 규모 판단, 규모별로 쓰는 것, 여러 Aggregate가 함께 바뀔 때, 컴포넌트 분리 조건과 만들지 않는 것
- 검사 DES012(규모 값), DES013(규모 대비 컴포넌트 수, 경고), DES014(규모와 Aggregates 불일치, 경고), DES015(Aggregates의 기준 참조). DES006 필수 섹션에 설계 규모 · 도메인 경계 · Aggregates 추가
- 리뷰어 design 항목: 규모 판단, 과하게 나눔, 덜 나눔, Aggregate 경계. adopt · bugfix에서 규모를 다루는 방법
- 설계 규모 작음 예제 `examples/wishlist/` (상품 찜: 서비스 하나 + Repository, Aggregate 없음, 보통 칸 신호 둘은 국소 보강). 명세 지도 예제에 추가

### 변경
- 예제 `examples/order` design을 규모 "큼"으로 정리: `OrderRequestValidator`를 Value Object `OrderRequestItems` · `IdempotencyKey`로 바꿈

## [0.1.0] - 2026-10-25

첫 버전입니다. 공개 배포 전 개발 버전입니다.

### 추가
- 기능 명세: `requirements → design(목차 + 8개 파일) → tasks` 세 단계와 `/spec-mirror:spec`
- 버그 명세: `bugfix(현재 · 기대 · 유지할 동작) → design(원인 · 버그 조건 · Property) → tasks(탐색 테스트 → 보존 테스트 → 수정 → 명세 반영)` 세 단계와 `/spec-mirror:bugfix`
- `/spec-mirror:implement`, `sync`, `check`, `status`, `approve`, `init`
- 형식 검사기: REQ · DES · TSK(기능), BUG · BDS · BTK(버그) 규칙, 템플릿 자리표시자 검사
- 문서 해시 기반 단계 승인과 "승인 후 변경됨" · "앞 단계가 바뀜" 상태
- 훅: 단계 잠금(쓰기 전), 형식 검사(쓴 뒤), 진행 상황 알림(세션 시작)
- 추적: 기능 기준별 테스트 · 코드 주석, 코드에만 있는 번호, 처리 흐름 순서, 메시지 문구 / 버그 항목별 테스트
- `spec-reviewer` 에이전트 (기능 · 버그 명세 리뷰)
- 정답 예제 `examples/order/`, `examples/confirm-recheck-mismatch/`
- `/spec-mirror:adopt`: 기존 코드를 동작을 바꾸지 않고 기능 명세로 옮김 (분기 목록 ↔ 기준 대조, 지금 구조를 설명하는 design, 도입 작업 tasks). `scaffold --adopt`, adopt tasks 템플릿
- 명세 지도 `<specRoot>/README.md`: 기능 목록 · 순서 · 관련 기능. `spec-mirror map`, `scaffold map`, MAP 규칙, 예제 `examples/README.md`
- 기능 사이 참조 `<기능> N.M` 검사 (REQ018)
- 리뷰 방식: 모든 단계에서 첫 리뷰, 지적 직접 확인, 구조가 바뀐 경우에만 바뀐 부분 다시 리뷰, 승인 요청에 리뷰 결과 표
- requirements 규칙: "처리 흐름의 순서 정하기"(확인 순서 표, 같은 단계 안의 순서, 기존 코드와 다를 때)와 "코드로 옮기기 좋게 쓰기" — 작성 안내 · 리뷰 에이전트 · design 02 · bugfix 명세 반영 · 기준 번호가 바뀔 때의 추적 규칙에 반영
