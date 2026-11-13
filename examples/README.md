# Spec Map

## Overview

spec-mirror 의 정답 예제입니다. 검사기 테스트와 스킬이 형식 기준으로 쓰며, 모든 문서가 형식 검사 **오류 0건 · 경고 0건**이어야 합니다. 예제의 기술 스택(Spring Boot + Kotlin, 토스페이먼츠)은 형식 예시일 뿐이고, 스킬은 프로젝트에서 기술을 찾습니다.

- 이 파일은 명세 지도(`<specRoot>/README.md`)의 예제이기도 합니다. 지도에는 기능 명세만 적고, 버그 명세(`confirm-recheck-mismatch/`, order 6.21 을 고치는 버그)는 적지 않습니다.
- 두 기능 명세는 같은 convention 안에서 구조가 다릅니다. order는 상태 규칙이 많아 Aggregate 2개 · 컴포넌트 11개, wishlist는 규칙이 적어 서비스 하나 + Repository입니다. convention이 정한 대로 design이 어떻게 달라지는지 비교해 볼 수 있습니다.
- [`convention/`](convention/)은 예제 프로젝트의 convention 문서(`docs/convention/`) 예시입니다(아키텍처 · 코딩 · 요청 검증 · 테스트). 명세가 아니라서 지도에 적지 않습니다. 두 기능의 design 01 `### 따른 convention` 표가 이 문서를 근거로 씁니다.
- 예제를 고치면 `npm test` 로 모든 예제가 여전히 깨끗한지 확인합니다.

## Features

| 순서 | 기능 | 범위 | 진입점 | 관련 기능 |
|---|---|---|---|---|
| 1 | [order](order/) | 주문 접수 · 중복 주문 방지 · 조회 · 내역 · 결제 전 취소 · 결제 승인 · 결과 반영 · 기한 만료 · 상태 일관성 | 주문 요청 5개, 결제 승인 요청, 기한 만료 배치 | — |
| 2 | [wishlist](wishlist/) | 상품 찜하기 · 찜 해제 · 찜 목록 조회 | 찜 요청 3개 | order |

## Out of Scope

- 결제 완료 주문의 취소 · 환불, 재고, 쿠폰 · 포인트: 예제 범위 밖입니다.
