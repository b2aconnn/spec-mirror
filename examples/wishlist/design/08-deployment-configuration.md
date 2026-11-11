# Technical Design Document — 배포 · 설정

> [design.md](../design.md)로 돌아가기

## Deployment

### 배포 전략

#### 1. 마이그레이션

- `wishes` 테이블 추가 (03의 DDL). 기존 테이블은 바꾸지 않음
- 새 테이블만 추가하므로 배포 순서 제약과 하위 호환 문제가 없음

## Configuration

### 애플리케이션 설정

변경 없음 — 상품 카탈로그 설정(`catalog.*`)은 주문 기능의 것을 그대로 씁니다.
