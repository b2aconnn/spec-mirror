# 테스트

> spec-mirror 예제 프로젝트의 convention 예시입니다. 테스트 이름과 given / when / then 형식은 spec-mirror 규칙을 따르고, 여기서는 종류와 도구만 정합니다.

## 테스트 종류

판단이 있는 계층의 테스트가 그 기준을 맡습니다.

| 종류 | 대상 | 맡는 것 | 실제로 도는 것 | 바꾸는 것 |
|---|---|---|---|---|
| **유닛** | 도메인 (Aggregate, Value Object, Domain Service) | 상태 전이, 불변식, 계산, 상태 · 값에 따른 거절 | 도메인 객체만 | 없음. 시각은 인자로 넘김 |
| **통합** | Application Service | 조회 · 본인 확인, 저장, 트랜잭션, 외부 결과에 따른 갈래, 동시성 · 유일 제약 | Service ~ 저장소 | 외부 시스템(가짜 구현), 시계(고정 시계) |
| **E2E** | Controller · API | 요청 형식 확인, 응답 코드 · 본문 | 요청 ~ 저장소 전부 | 외부 시스템(가짜 구현), 시계(고정 시계) |

## 거절 확인

| 종류 | 거절 확인 | 응답 코드 |
|---|---|---|
| 유닛 · 통합 | 예외: 종류, 에러 코드, 메시지 | 확인하지 않음 |
| E2E | 응답: 응답 코드, 에러 코드, 메시지 | 여기서만 확인 |

## 도구 · 위치

- JUnit 5, Kotest assertions. 통합 · E2E는 `@SpringBootTest` + Testcontainers(MySQL), E2E는 MockMvc
- 테스트 묶음: 종류마다 Requirement 하나당 클래스 하나. 도메인 유닛은 도메인 객체 하나당 하나. 예: `PaymentTest`, `PaymentConfirmIntegrationTest`, `OrderPaymentE2ETest`
- 외부 시스템 가짜 구현과 고정 시계는 `src/test/kotlin/.../support/`에 둡니다.
