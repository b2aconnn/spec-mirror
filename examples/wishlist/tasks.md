# Implementation Plan: 상품 찜

## Overview

회원이 상품을 찜 목록에 담고, 빼고, 지금 가격과 판매 여부와 함께 볼 수 있게 합니다. 설계 규모가 작음이라 서비스 하나(`WishlistService`)와 Repository 하나(`WishRepository`)로 구현하고, 상품 카탈로그는 주문 기능의 `ProductCatalog` 포트를 그대로 씁니다.

공통 기반(에러 코드, 테이블)을 먼저 만들고, 찜하기 → 찜 해제 → 찜 목록 조회 순으로 진행합니다. 각 기능은 인수 테스트를 먼저 작성하고(Red) 구현합니다(Green).

## Tasks

- [ ] 1. 공통 기반
  - `WishlistErrorCode`, `WishlistException`, `WishlistExceptionHandler` 작성
  - `wishes` 테이블 마이그레이션 추가
  - _Requirements: 1.3, 1.5, 1.6, 3.3_

- [ ] 2. 테스트 기준 데이터 준비
  - 주문 기능의 `FakeProductCatalog`에 상품 301 ~ 400 추가
  - 회원 1 ~ 4의 찜 데이터 (design 05의 테스트 기준 데이터)
  - _Requirements: 1.4, 3.2_

- [ ] 3. 상품 찜하기
  - [ ] 3.1 인수 테스트 작성: WishAddAcceptanceTest
    - 첫 찜 201, 다시 담기 200 기존 찜 (카탈로그 호출 없음)
    - 99개 → 담기 가능, 100개 → `WISHLIST_FULL`
    - 카탈로그 장애, 없는 상품, 판매 중지 상품 담기
    - 같은 상품 동시 담기 → 찜 1건
    - _Requirements: 1.1 ~ 1.9_

  - [ ] 3.2 Wish 엔티티, WishRepository 구현
    - `(member_id, product_id)` 유니크 제약, 회원별 조회 · 개수 · 삭제
    - _Requirements: 1.7, 1.9_

  - [ ] 3.3 WishlistService.add, WishlistController 찜하기 구현
    - 기존 찜 → 개수 → 상품 카탈로그 → 없는 상품 → 저장 순서
    - 유니크 제약 위반이면 기존 찜 응답
    - _Requirements: 1.1 ~ 1.8_

  - [ ]* 3.4 Property 테스트: 같은 상품은 한 번만 담긴다
    - **Property 1: 같은 상품은 한 번만 담긴다**
    - **Validates: Requirements 1.2, 1.9**

  - [ ]* 3.5 Property 테스트: 찜 목록은 100개까지
    - **Property 2: 찜 목록은 100개까지**
    - **Validates: Requirements 1.3**

- [ ] 4. 찜 해제
  - [ ] 4.1 인수 테스트 작성: WishRemoveAcceptanceTest
    - 담은 상품 빼기 204, 없는 상품 빼기 204
    - 카탈로그 장애 상태에서도 204, 카탈로그 호출 없음
    - _Requirements: 2.1 ~ 2.5_

  - [ ] 4.2 WishlistService.remove, WishlistController 찜 해제 구현
    - _Requirements: 2.1 ~ 2.5_

- [ ] 5. 찜 목록 조회
  - [ ] 5.1 인수 테스트 작성: WishlistQueryAcceptanceTest
    - 빈 목록 (카탈로그 호출 없음), 최근 담은 순서
    - 판매 중 · 판매 중지 · 판매 종료, 본인 찜만
    - 카탈로그 장애 → 503
    - _Requirements: 3.1 ~ 3.6_

  - [ ] 5.2 WishlistService.list, WishlistController 찜 목록 조회 구현
    - `WishView`, `SaleStatus`
    - _Requirements: 3.1 ~ 3.6_

- [ ] 6. 최종 Checkpoint - 명세 동기화
  - 모든 기준에 대응하는 테스트(`R{N}-{M}`)와 코드 주석(`// R{N}-{M}`) 확인
  - 에러 메시지가 requirements.md와 글자까지 같은지 확인
  - 모든 테스트 통과 확인

## Notes

- **인수 테스트 우선**: 각 기능은 인수 테스트를 먼저 작성해 실패를 확인한 뒤 구현합니다
- **Property 테스트**: `*` 표시된 태스크는 선택적입니다
- **테스트 이름**: `` `R{N}-{M} <기준 요약>` `` 형식입니다
- **작게 유지**: 기능이 작아 중간 Checkpoint 없이 마지막에 한 번 확인합니다. 새 클래스는 엔티티, Repository, 서비스, 컨트롤러, 에러 코드 · 핸들러, DTO뿐입니다

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "4.1", "5.1"] },
    { "id": 2, "tasks": ["3.3", "4.2", "5.2"] },
    { "id": 3, "tasks": ["3.4", "3.5"] },
    { "id": 4, "tasks": ["6"] }
  ]
}
```
