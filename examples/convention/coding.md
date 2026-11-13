# 코딩

> spec-mirror 예제 프로젝트의 convention 예시입니다.

## 이름

- 상태를 바꾸는 메서드는 도메인 행위 이름입니다. 예: `cancel()`, `expire()`, `markPaid()`. `setStatus(to)`, `changeStatus(to)`를 바깥에 두지 않습니다.
- 유스케이스 메서드는 첫 기준의 행위 이름입니다. 예: 주문 접수 → `place`, 찜하기 → `add`
- 기술 역할 접미사
  - 계층 · 역할: `…Controller`, `…Service`, `…Repository`, `…Adapter`, `…Scheduler`, `…Exception`, `…ErrorCode`
  - 데이터 전달: `…Request` · `…Response`(Controller), `…Command` · `…Result`(Application Service), `…Query`(조회 조건)
  - 접미사 앞에 기술 말을 넣지 않습니다. ❌ `OrderRecordDto` → ✅ `OrderResponse`
- 뜻이 흐린 이름은 쓰지 않습니다: `…Manager`, `…Helper`, `…Util`, `…Processor`, `process…`, `handle…`, `data`, `info`, `temp`

## 검증 · 예외

- 요청만 보고 알 수 있는 검증은 Controller에서 합니다. 방법은 [요청 검증](validation.md)입니다.
- 저장된 것 · 상태 · 외부 정보가 필요한 검증은 Application Service · 도메인에서 하고, 기능별 예외(`…Exception`)에 에러 코드를 담아 던집니다.
- 에러 코드는 기능별 `…ErrorCode` enum 하나에 상태 · 메시지와 함께 둡니다. 기능별 `@RestControllerAdvice`가 공통 `ErrorResponse`(`code`, `message`)로 바꿉니다.
- 요청 형식 오류(헤더 누락, JSON 파싱 불가)는 공통 핸들러가 `400 INVALID_REQUEST`로 처리합니다.

## 로깅

- 비즈니스 이벤트는 `INFO`, 결과 불명 · 대사 대상은 `WARN`, 예상하지 못한 오류는 `ERROR`
- 개인정보(카드 번호, 연락처)는 로그에 남기지 않습니다.

## 코드 스타일 · 커밋

- ktlint 기본 규칙
- 커밋 메시지는 한국어, 첫 줄 50자 안
