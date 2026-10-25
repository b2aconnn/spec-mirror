# Technical Design Document

## Overview

본 문서는 Spring Boot + Kotlin 기반 결제 승인 시스템에 **주문 기능**을 추가하기 위한 기술 설계를 정의합니다. 회원이 상품과 수량을 골라 주문하면 시스템이 주문 금액을 계산하고, 주문과 함께 준비된 결제를 토스페이먼츠로 승인합니다. 결제 결과는 주문 상태에 함께 반영되며, 결제 전 주문은 회원이 취소하거나 결제 기한(30분)이 지나면 자동으로 만료됩니다.

요구사항은 [requirements.md](requirements.md)에 있으며, 이 문서의 `Requirements N.M`은 그 문서의 Requirement N, 기준 M을 가리킵니다.

### 설계 목표

1. **주문 금액은 서버가 계산**: 클라이언트가 보낸 금액은 쓰지 않고, 상품 카탈로그의 판매가로 계산한 금액만 결제에 쓴다
2. **기존 결제 승인 규칙 유지**: PG 실패 3분류(거절 / 미도달 / 결과 불명), PG 호출은 트랜잭션 밖, 상태 변경은 조건부 UPDATE — 기존 코드의 원칙을 그대로 따른다
3. **주문 상태와 결제 상태는 항상 함께 바뀜**: 두 상태를 같은 트랜잭션에서 바꿔서, 한쪽만 바뀐 상태가 보이지 않게 한다
4. **중복 방지**: 같은 주문이 두 번 접수되거나, 같은 결제가 두 번 승인되거나, 승인·취소·만료가 동시에 반영되는 일을 막는다
5. **외부 시스템 지연 격리**: 상품 카탈로그나 PG 응답을 기다리는 동안 DB 커넥션과 락을 잡지 않는다

## 문서 구성

| 문서 | 내용 |
|---|---|
| [아키텍처](design/01-architecture.md) | Architecture |
| [컴포넌트와 인터페이스](design/02-components.md) | Components and Interfaces |
| [데이터 모델 · API](design/03-data-models.md) | Data Models |
| [에러 처리](design/04-error-handling.md) | Error Handling |
| [테스트 전략](design/05-testing.md) | Testing Strategy |
| [보안 · 성능](design/06-security-performance.md) | Security, Performance Optimization |
| [정확성 속성](design/07-correctness-properties.md) | Property-Based Testing Analysis, Correctness Properties |
| [배포 · 설정](design/08-deployment-configuration.md) | Deployment, Configuration |
