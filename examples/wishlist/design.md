# Technical Design Document

## Overview

본 문서는 주문 · 결제 시스템에 **상품 찜**을 추가하기 위한 기술 설계를 정의합니다. 회원은 상품을 찜 목록에 담고, 빼고, 지금 가격과 판매 여부와 함께 볼 수 있습니다. 상태가 없고 규칙이 적은 작은 기능이므로, 서비스 하나에 흐름대로 구현하고 Aggregate · 포트 · 이벤트를 새로 만들지 않습니다.

요구사항은 [requirements.md](requirements.md)에 있으며, 이 문서의 `Requirements N.M`은 그 문서의 Requirement N, 기준 M을 가리킵니다.

### 설계 목표

1. **작게 유지**: 서비스 하나와 Repository 하나로 끝냅니다. convention대로 규칙이 적은 기능에 계층을 더 만들지 않습니다.
2. **기존 연동 재사용**: 상품 카탈로그는 주문 기능의 `ProductCatalog` 포트를 그대로 씁니다.
3. **같은 상품은 한 번만**: 동시에 담아도 찜이 하나만 남도록 저장소 제약으로 지킵니다.

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
