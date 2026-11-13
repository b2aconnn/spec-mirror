# 요청 검증 (Spring)

> spec-mirror 예제 프로젝트의 convention 문서 예시입니다. 실제 프로젝트에서는 `docs/convention/`(설정 `conventionDir`)에 둡니다.
> spec-mirror는 검증을 어디서 · 어떻게 할지 정하지 않습니다. 이런 팀 문서를 따릅니다.

## 원칙

- 요청만 보고 알 수 있는 검증(필수 값, 길이, 개수, 숫자 범위, 형식)은 Controller의 요청 DTO · 파라미터 · 헤더에서 **Bean Validation**으로 합니다.
- 저장된 것 · 상태 · 외부 정보가 필요한 검증은 Application Service · 도메인에서 합니다. Controller에서 저장소를 조회하지 않습니다.

## 어노테이션

현업에서 많이 쓰는 **표준 어노테이션을 먼저** 씁니다.

| 용도 | 어노테이션 |
|---|---|
| 값 있음 | `@NotNull`, `@NotBlank`(문자열), `@NotEmpty`(목록) |
| 길이 · 개수 | `@Size(min, max)` |
| 숫자 | `@Min`, `@Max`, `@Positive`, `@PositiveOrZero`, `@DecimalMin`, `@DecimalMax` |
| 형식 | `@Pattern`, `@Email` |
| 날짜 | `@Past`, `@PastOrPresent`, `@Future`, `@FutureOrPresent` |

- 적용: 요청 본문은 `@Valid @RequestBody`, 목록 안의 객체는 `@Valid`, 파라미터 · 헤더는 Controller에 `@Validated`
- 표준 어노테이션으로 나타낼 수 없을 때만 커스텀 제약(`@Constraint` + `ConstraintValidator`)을 만듭니다. 예: 목록 안 상품 ID가 겹치지 않음. 커스텀 제약도 요청만 보고 판단해야 합니다.

## 에러 응답

- 어노테이션의 `message`에는 **에러 코드**를 적습니다. 예: `@Min(1, message = "INVALID_QUANTITY")`
- `@RestControllerAdvice`가 `MethodArgumentNotValidException` · `HandlerMethodValidationException`(파라미터 · 헤더)을 그 에러 코드의 상태 · 메시지로 바꿉니다.
- 여러 위반이 겹치면 Bean Validation은 위반을 모두 모으므로, 핸들러가 기능별로 정한 에러 코드 순서에서 가장 앞선 하나만 응답합니다(또는 `@GroupSequence`로 순서를 정합니다).
