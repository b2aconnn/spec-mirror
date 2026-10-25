# Implementation Plan: 주문 · 주문 결제

## Overview

기존 결제 승인 시스템(Spring Boot + Kotlin, 토스페이먼츠)에 주문 기능을 추가합니다. 회원이 상품과 수량을 골라 주문하면 시스템이 주문 금액을 계산하고, 주문과 함께 만들어진 결제로 승인하며, 결제 결과를 주문 상태에 반영합니다. 결제 전 주문 취소와 결제 기한 만료도 포함합니다.

구현은 공통 기반과 도메인 모델부터 시작하여 주문 접수, 결제 연동, 조회, 취소, 만료 순으로 진행하며, 각 단계마다 인수 테스트를 먼저 작성하고(Red) 구현합니다(Green).

## Tasks

- [ ] 0. 요구사항 보완 확정
  - 요구사항에 기준이 없는데 코드에 있는 동작을 정리해 requirements.md에 넣거나 코드에서 뺀다
    - 주문 API 요청 형식 오류(회원 헤더 누락, JSON 파싱 불가) → 400 `INVALID_REQUEST`
    - 중복 주문 방지 키 24시간 경계 (정각부터 재사용 가능)
    - 결제 키 앞뒤 공백 제거 (기존 AC-CNF-19)
    - PG 응답 불일치 중 PG 상태가 승인 완료가 아니면 승인 취소 요청 안 함 (기존 AC-APV-03)
    - PG 승인 일시가 없으면 현재 시각 기록 (기존 AC-APV-05)
    - 금액 불일치 WARN 로그
  - 상품 카탈로그 연동 규격(API, 타임아웃) 확정
  - _Requirements: 1.2, 2.3, 6.1, 6.5, 6.17, 6.18_

- [ ] 1. 프로젝트 기본 설정 및 공통 컴포넌트
  - `build.gradle.kts`에 ULID 라이브러리 추가
  - `application.yml`에 상품 카탈로그·만료 배치 설정 추가
  - `OrderErrorCode`, `OrderException`, `OrderExceptionHandler` 작성
  - `PaymentErrorCode.ORDER_NOT_PAYABLE` 추가
  - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.10, 2.1, 2.5, 3.2, 4.2, 5.4, 6.9_

- [ ] 2. 테스트 지원 코드 작성
  - [ ] 2.1 고정 Clock 설정
    - 고정 시각 `2026-01-15T01:00:00Z`, 테스트 중 시간 이동 가능
    - _Requirements: 2.3, 6.11, 8.2_

  - [ ] 2.2 FakeProductCatalog 작성
    - 테스트 기준 데이터 상품 등록 (101~105, 201~221)
    - 장애 상태 스위치, 호출 횟수 카운터
    - _Requirements: 1.5, 1.6, 2.4, 3.5_

  - [ ] 2.3 테스트 헬퍼 작성
    - 기본 주문 접수, 결제 승인 요청 헬퍼
    - 주문·결제 상태 짝 검증 헬퍼
    - _Requirements: 9.1_

- [ ] 3. 도메인 모델 및 Repository 구현
  - [ ] 3.1 Order, OrderItem, OrderStatus 작성
    - 주문 금액·스냅샷 필드는 불변(`val`)
    - 상태는 조건부 UPDATE로만 변경
    - _Requirements: 1.13, 1.17_

  - [ ] 3.2 OrderRepository 구현
    - 주문번호 / 회원+주문번호 / 회원+키 조회, 회원별 내역 조회
    - 주문 상태 조건부 UPDATE, 중복 방지 키 떼어내기
    - 만료 대상 조회
    - _Requirements: 2.2, 2.3, 3.2, 4.4, 8.2_

  - [ ] 3.3 Payment, PaymentRepository 변경
    - `Payment.forOrder()` 팩토리 추가
    - 취소용 `failReady`, 만료용 `failReadyExpired` 추가
    - `markFailed`가 변경된 행 수를 반환하도록 변경
    - _Requirements: 1.13, 5.6, 8.3_

  - [ ] 3.4 DDL 반영
    - README.md에 `orders`, `order_items` 테이블 추가
    - _Requirements: 2.7, 2.8_

- [ ] 4. Checkpoint - 기본 구조 확인
  - 애플리케이션 기동 및 테이블 생성 확인
  - 기존 테스트 모두 통과 확인

- [ ] 5. 상품 카탈로그 연동 구현
  - [ ] 5.1 ProductCatalog 인터페이스 및 HttpProductCatalog 구현
    - 연결 실패, 타임아웃, 5XX, 파싱 불가 → `ProductCatalogUnavailableException`
    - _Requirements: 1.5, 1.6_

  - [ ]* 5.2 단위 테스트: HttpProductCatalog
    - 정상 응답, 일부 상품 없음, 5XX, 타임아웃

- [ ] 6. 주문 접수 구현
  - [ ] 6.1 인수 테스트 작성: OrderPlaceAcceptanceTest
    - 정상 접수, 상품 개수·수량·중복 상품, 카탈로그 장애, 없는 상품, 판매 중지 상품, 금액 한도
    - 주문번호 형식, 주문명, 주문·항목·결제 함께 생성, 응답 내용
    - 요청 금액 무시, PG 호출 없음, 가격 변경 후 금액 불변
    - _Requirements: 1.1 ~ 1.17_

  - [ ] 6.2 OrderRequestValidator 구현
    - 상품 개수 → 수량 → 중복 상품 순서로 검증
    - 중복 주문 방지 키 형식 검증
    - _Requirements: 1.2, 1.3, 1.4, 2.1_

  - [ ] 6.3 OrderLines, OrderDraft 구현
    - 없는 상품 → 판매 중지 → 금액 계산 → 한도 확인
    - 주문번호(`ORD_` + ULID), 주문명, 결제 기한(+30분)
    - _Requirements: 1.7, 1.8, 1.9, 1.10, 1.11, 1.12_

  - [ ] 6.4 OrderWriter, OrderPlaceService, OrderController 구현
    - 주문 + 주문 항목 + 결제를 한 트랜잭션에서 저장
    - 상품 카탈로그는 트랜잭션 밖에서 호출
    - _Requirements: 1.1, 1.5, 1.6, 1.13, 1.14, 1.16_

  - [ ]* 6.5 Property 테스트: 주문 상품 개수 / 수량 / 중복 상품
    - **Property 1: 주문 상품 개수 제한**
    - **Property 2: 상품별 수량 제한**
    - **Property 3: 중복 상품 거절**
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [ ]* 6.6 Property 테스트: 주문 금액은 서버 계산값
    - **Property 4: 주문 금액은 서버 계산값**
    - **Validates: Requirements 1.9, 1.13, 1.15**

  - [ ]* 6.7 Property 테스트: 주문명 형식
    - **Property 5: 주문명 형식**
    - **Validates: Requirements 1.12**

  - [ ]* 6.8 Property 테스트: 접수된 주문의 불변성
    - **Property 6: 접수된 주문의 불변성**
    - **Validates: Requirements 1.17, 3.5**

- [ ] 7. 중복 주문 방지 구현
  - [ ] 7.1 인수 테스트 작성: OrderIdempotencyAcceptanceTest
    - 키 없음 / 형식 오류
    - 같은 내용 재요청 → 200 기존 주문 (카탈로그 호출 없음)
    - 다른 내용 → 422, 24시간 경과 후 재사용
    - 다른 회원 같은 키, 동시 요청
    - _Requirements: 2.1 ~ 2.8_

  - [ ] 7.2 OrderFingerprint, OrderIdempotencyService 구현
    - 주문 내용 지문 (항목 순서 무관)
    - 기존 주문 확인, 24시간 경과 키 떼어내기
    - 동시 요청 시 유니크 제약 위반 → 먼저 접수된 주문 반환
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 7.3 Property 테스트: 주문 내용 동일성
    - **Property 8: 주문 내용 동일성**
    - **Validates: Requirements 2.4, 2.6**

  - [ ]* 7.4 Property 테스트: 다른 내용의 키 재사용 거절
    - **Property 9: 다른 내용의 키 재사용 거절**
    - **Validates: Requirements 2.5**

  - [ ]* 7.5 Property 테스트: 키는 회원별
    - **Property 10: 키는 회원별**
    - **Validates: Requirements 2.7**

  - [ ]* 7.6 Property 테스트: 동시 주문은 하나만 접수
    - **Property 11: 동시 주문은 하나만 접수**
    - **Validates: Requirements 2.8**

- [ ] 8. Checkpoint - 주문 접수 확인
  - 주문 접수·중복 방지 인수 테스트 통과 확인
  - 모든 테스트 통과 확인

- [ ] 9. 결제 결과의 주문 반영 구현
  - [ ] 9.1 인수 테스트 작성: OrderPaymentResultAcceptanceTest
    - 승인 완료 → 주문 결제 완료
    - 결제 실패 확정 → 주문 결제 실패
    - 미도달 / 결과 불명 → 주문 결제 대기 그대로
    - 정합성 경보 2종
    - _Requirements: 7.1 ~ 7.7_

  - [ ] 9.2 OrderPaymentSynchronizer 구현
    - 결제 상태 변경 트랜잭션 안에서 주문 상태 함께 변경
    - 주문 상태 변경 로그, 정합성 경보 로그
    - `PaymentStateService.markDone` / `markFailed`에서 호출
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 9.2, 9.5_

  - [ ]* 9.3 Property 테스트: 결과 반영은 경로와 무관
    - **Property 15: 결과 반영은 경로와 무관**
    - **Validates: Requirements 7.7**

- [ ] 10. 주문 결제 승인 변경
  - [ ] 10.1 기존 결제 테스트 이관
    - `AC-CNF-*`, `AC-APV-*` → `OrderPaymentConfirmAcceptanceTest`의 `R6-N` 테스트로 이름 변경
    - 셋업을 결제 준비 대신 주문 접수로 변경
    - `AC-PRE-*` 삭제
    - 메시지까지 검증하도록 보강
    - _Requirements: 6.1 ~ 6.25_

  - [ ] 10.2 신규 인수 테스트 작성
    - 취소·만료된 주문 결제 → 409 `ORDER_NOT_PAYABLE`
    - 승인 완료·실패 후 주문 상태 확인
    - 결제 준비 API → 404
    - _Requirements: 6.9, 6.10, 6.17, 6.18, 6.19, 6.26_

  - [ ] 10.3 PaymentStateService, PaymentController 변경
    - 결제 실패 분기를 `ORDER_NOT_PAYABLE` / `ALREADY_FAILED`로 분리
    - 결제 준비 API와 `prepare` 메서드 제거
    - 분기마다 `// R6-N` 주석
    - _Requirements: 6.1 ~ 6.26_

  - [ ]* 10.4 Property 테스트: PG 승인은 한 번만
    - **Property 13: PG 승인은 한 번만**
    - **Validates: Requirements 6.25**

  - [ ]* 10.5 Property 테스트: 결과 불명은 실패로 단정하지 않음
    - **Property 14: 결과 불명은 실패로 단정하지 않음**
    - **Validates: Requirements 6.24, 7.4**

- [ ] 11. Checkpoint - 결제 연동 확인
  - 결제 승인·결과 반영 인수 테스트 통과 확인
  - 대사 테스트(`PaymentReconcilerTest`) 셋업 변경 및 통과 확인
  - 모든 테스트 통과 확인

- [ ] 12. 주문 조회 및 주문 내역 구현
  - [ ] 12.1 인수 테스트 작성: OrderQueryAcceptanceTest
    - 본인 주문 조회, 다른 회원 주문 → 404
    - 주문·결제 정보 함께 응답, 결제 진행 중 표시
    - 조회 중 카탈로그 호출 없음
    - _Requirements: 3.1 ~ 3.5_

  - [ ] 12.2 인수 테스트 작성: OrderHistoryAcceptanceTest
    - 페이지 번호·크기 검증, 기본 20건 / 최대 50건
    - 최근순, 다음 페이지 여부, 본인 주문만
    - _Requirements: 4.1 ~ 4.5_

  - [ ] 12.3 OrderQueryService, OrderController 구현
    - _Requirements: 3.1 ~ 3.5, 4.1 ~ 4.5_

  - [ ]* 12.4 Property 테스트: 본인 주문만 접근
    - **Property 12: 본인 주문만 접근**
    - **Validates: Requirements 3.2, 4.5, 5.2**

- [ ] 13. 결제 전 주문 취소 구현
  - [ ] 13.1 인수 테스트 작성: OrderCancelAcceptanceTest
    - 정상 취소 → 주문 취소 + 결제 실패(`ORDER_CANCELED`)
    - 다른 회원 주문, 이미 취소된 주문, 취소할 수 없는 상태
    - 결제 진행 중 취소 불가, 취소와 승인 동시
    - PG 호출 없음
    - _Requirements: 5.1 ~ 5.9_

  - [ ] 13.2 OrderCancelService, OrderController 구현
    - 결제 → 주문 순서로 한 트랜잭션에서 변경
    - _Requirements: 5.1 ~ 5.9_

  - [ ]* 13.3 Property 테스트: 접수·취소는 PG를 호출하지 않음
    - **Property 7: 접수·취소는 PG를 호출하지 않음**
    - **Validates: Requirements 1.16, 5.9**

- [ ] 14. 결제 기한 만료 구현
  - [ ] 14.1 인수 테스트 작성: OrderExpirationAcceptanceTest
    - 기한 정각 포함, 오래된 순 최대 100건
    - 주문 기한 만료 + 결제 실패(`ORDER_EXPIRED`)
    - 만료 직전 승인 시작 → 건너뜀, 결제 진행 중 → 만료 안 함
    - 한 건 실패해도 나머지 처리, 동시 실행 시 한 번만 만료
    - _Requirements: 8.1 ~ 8.7_

  - [ ] 14.2 OrderExpirationScheduler, OrderExpirer 구현
    - 1분마다 실행, 주문별 트랜잭션
    - _Requirements: 8.1 ~ 8.7_

  - [ ]* 14.3 Property 테스트: 만료 대상 선정
    - **Property 17: 만료 대상 선정**
    - **Validates: Requirements 8.2, 8.6**

  - [ ]* 14.4 Property 테스트: 만료는 한 번만
    - **Property 18: 만료는 한 번만**
    - **Validates: Requirements 8.7**

- [ ] 15. 주문·결제 상태 일관성 검증
  - [ ] 15.1 인수 테스트 작성: OrderPaymentConsistencyAcceptanceTest
    - 모든 인수 테스트 종료 시 주문·결제 상태 짝 확인
    - 주문 변경 실패 시 결제 변경도 롤백
    - 승인·취소·만료 동시 실행 → 하나만 반영
    - 외부 호출 중 DB 커넥션 점유 없음
    - 주문 상태 변경 로그
    - _Requirements: 9.1 ~ 9.5_

  - [ ]* 15.2 Property 테스트: 승인·취소·만료는 하나만 반영
    - **Property 16: 승인·취소·만료는 하나만 반영**
    - **Validates: Requirements 5.7, 6.13, 8.4, 9.3**

  - [ ]* 15.3 Property 테스트: 주문·결제 상태 짝
    - **Property 19: 주문·결제 상태 짝**
    - **Validates: Requirements 9.1, 9.2**

  - [ ]* 15.4 Property 테스트: 종결 상태 불변
    - **Property 20: 종결 상태 불변**
    - **Validates: Requirements 7.5, 7.6**

- [ ] 16. 최종 Checkpoint - 명세 동기화
  - 모든 기준에 대응하는 테스트(`R{N}-{M}`)와 코드 주석(`// R{N}-{M}`) 확인
  - 에러 메시지가 requirements.md와 글자까지 같은지 확인
  - 코드 주석 순서가 요구사항 번호 순서와 같은지 확인
  - README.md 갱신 (흐름, DDL, 결제 준비 API 제거)
  - 모든 테스트 통과 확인

## Notes

- **인수 테스트 우선**: 각 기능은 인수 테스트를 먼저 작성해 실패를 확인한 뒤 구현합니다
- **Property 테스트**: `*` 표시된 태스크는 선택적입니다. 인수 테스트가 대표 사례를 이미 검증하며, Property 테스트는 무작위 입력으로 범위를 넓힙니다
- **테스트 이름**: `` `R{N}-{M} <기준 요약>` `` 형식, 경계값은 `R1-2a`, `R1-2b`로 나눕니다
- **테스트 환경**: H2(MySQL 모드) + `FakePgClient` + `FakeProductCatalog` + 고정 `Clock`
- **기존 기술 테스트**: `TossPaymentsClientTest`, `PaymentDomainTest`, `PaymentConfigTest`, `PaymentReconcilerTest`는 기존 이름을 유지합니다
- **범위 밖**: PG 웹훅, ShedLock, 재고·쿠폰·포인트

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0"] },
    { "id": 1, "tasks": ["1", "3.1"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3", "3.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["4"] },
    { "id": 4, "tasks": ["5.1", "6.1", "7.1"] },
    { "id": 5, "tasks": ["5.2", "6.2", "6.3"] },
    { "id": 6, "tasks": ["6.4", "7.2"] },
    { "id": 7, "tasks": ["6.5", "6.6", "6.7", "6.8", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 8, "tasks": ["8"] },
    { "id": 9, "tasks": ["9.1", "10.1", "12.1", "12.2"] },
    { "id": 10, "tasks": ["9.2", "12.3"] },
    { "id": 11, "tasks": ["9.3", "10.2", "12.4"] },
    { "id": 12, "tasks": ["10.3"] },
    { "id": 13, "tasks": ["10.4", "10.5", "11"] },
    { "id": 14, "tasks": ["13.1", "14.1"] },
    { "id": 15, "tasks": ["13.2", "14.2"] },
    { "id": 16, "tasks": ["13.3", "14.3", "14.4", "15.1"] },
    { "id": 17, "tasks": ["15.2", "15.3", "15.4"] },
    { "id": 18, "tasks": ["16"] }
  ]
}
```
