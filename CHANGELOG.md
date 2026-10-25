# Changelog

이 프로젝트의 변경 이력입니다. 버전은 [Semantic Versioning](https://semver.org/)을 따릅니다.

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
