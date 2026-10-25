# Technical Design Document — 배포 · 설정

> [design.md](../design.md)로 돌아가기

## Deployment

### 배포 전략

#### 1. 데이터베이스 마이그레이션

- `orders`, `order_items` 테이블과 인덱스를 먼저 생성 (`ddl-auto: validate` 유지)
- `payments` 테이블은 변경 없음

#### 2. 배포 순서

1. 테이블 생성
2. 애플리케이션 배포 (주문 API 추가, 결제 준비 API 제거)
3. 결제 준비 API를 호출하던 클라이언트를 주문 접수 API로 전환

결제 준비 API는 즉시 제거합니다(요구사항 Open Question 6). 클라이언트 전환이 먼저 끝나야 합니다.

#### 3. 멀티 인스턴스

- 만료 배치와 대사 배치가 여러 서버에서 동시에 돌아도 조건부 UPDATE로 데이터는 안전
- 중복 조회 낭비를 줄이려면 ShedLock 도입 검토 (이번 범위 밖)

## Configuration

### 애플리케이션 설정

**application.yml (추가분):**

```yaml
order:
  catalog:
    base-url: ${PRODUCT_CATALOG_URL}
    connect-timeout: 1s
    read-timeout: 2s
  expiration:
    enabled: true
    fixed-delay: 60000     # 1분

# 기존 설정 유지
spring:
  jpa:
    open-in-view: false
```

**src/test/resources/application.yml (추가분):**

```yaml
order:
  catalog:
    base-url: http://localhost:0
  expiration:
    enabled: false         # 테스트에서는 배치를 직접 호출
```

**build.gradle.kts (추가분):**

```kotlin
implementation("com.github.f4b6a3:ulid-creator:5.2.3")
```
