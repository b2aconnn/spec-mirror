# 아키텍처

> spec-mirror 예제 프로젝트의 convention 예시입니다. 실제 프로젝트에서는 `docs/convention/`(설정 `conventionDir`)에 둡니다.
> 이 프로젝트는 규모 "보통 ~ 큼"의 백엔드라 **3 layer + DDD 전술 패턴**을 고른 경우입니다. spec-mirror가 정한 것이 아니라 팀이 정한 것입니다.

## 구조

Spring Boot + Kotlin 백엔드입니다. 패키지는 `api` / `application` / `domain` / `adapter`(외부 연동) / `persistence`입니다.

```
api (Controller) → application (Service) → domain ← adapter · persistence
```

- 의존은 바깥에서 안으로만 향합니다. `domain`은 다른 패키지를 모릅니다.
- 외부 시스템은 `domain`에 포트(인터페이스)를 두고 `adapter`가 구현합니다.

## 규칙을 두는 곳

기능의 상태 · 규칙이 얼마나 복잡한지에 따라 고릅니다.

| 기능 | 규칙의 위치 | 예 |
|---|---|---|
| 상태가 없거나 규칙마다 한 곳(제약 하나)에서 지킴 | 서비스 메서드 하나에 흐름대로 (Transaction Script). 엔티티는 간단한 메서드만 | 찜 목록 |
| 한 대상에 여러 상태 · 전이, 함께 지켜야 하는 값 | **Aggregate Root 메서드**가 불변식과 상태 전이를 지킴. Application Service는 순서만 조율 | 주문, 결제 |

- Aggregate는 한 트랜잭션에서 함께 일관돼야 하는 것만 묶습니다. 다른 Aggregate는 ID로 참조합니다.
- 여러 Aggregate가 "함께 바뀐다"를 요구하면 Application Service가 한 트랜잭션에서 바꿉니다. 응답 뒤에 따라 바뀌어도 되면 Domain Event로 나눕니다.
- 규칙이나 계산이 있는 값은 Value Object로 둡니다.
- 조회만 하는 흐름은 Aggregate를 거치지 않고 조회용 쿼리로 바로 읽습니다.

## 컴포넌트 나누기

컴포넌트는 바뀌는 이유 하나에 하나입니다. 다음 중 하나에 해당할 때만 따로 둡니다.

1. 트랜잭션 경계가 다르다 (예: 외부 호출을 트랜잭션 밖에 둬야 함)
2. 외부 시스템이나 다른 도메인과 연동한다
3. 둘 이상의 흐름이 같은 규칙을 함께 쓴다
4. Aggregate · Value Object로 불변식을 지킨다
5. 진입점이 따로 있다 (요청, 배치, 이벤트 처리)

호출만 넘기는 계층(Facade, Manager), 구현이 하나뿐인 내부 인터페이스, 한 흐름에서만 쓰는 Validator 클래스는 만들지 않습니다.

## 트랜잭션 · 외부 연동

- 외부 시스템 호출은 트랜잭션 밖에서 합니다.
- 상태 변경은 Repository의 조건부 UPDATE(`WHERE status = ?`)로 겹치는 요청 중 하나만 반영합니다.
- 외부 응답은 어댑터에서 도메인 모델로 번역합니다.
