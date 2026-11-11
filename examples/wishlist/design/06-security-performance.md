# Technical Design Document — 보안 · 성능

> [design.md](../design.md)로 돌아가기

## Security

### 보안 요구사항 구현

#### 1. 본인 찜만 접근

- 모든 조회 · 삭제 조건에 `memberId`를 넣음 (3.6)
- 찜 해제는 다른 회원의 찜을 지정할 방법이 없음 (경로에 회원이 없고 `X-Member-Id`로만 정함)

## Performance Optimization

### 성능 최적화 전략

#### 1. 상품 카탈로그 호출 최소화

- 찜 목록 조회는 상품 ID를 모아 **한 번만** 호출 (최대 100개)
- 이미 찜한 상품 담기, 찜 해제, 빈 찜 목록은 호출하지 않음

#### 2. 인덱스

- `(member_id, created_at, id)`: 찜 목록 정렬 조회
- `(member_id, product_id)` 유니크: 기존 찜 확인과 중복 방지
