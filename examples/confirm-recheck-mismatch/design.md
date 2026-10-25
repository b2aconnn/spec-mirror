# Bugfix Design Document

## Overview

결제 승인 결과가 불명이어서 즉시 조회했을 때 PG 승인 내용이 주문과 다르면, 승인 취소와 결제 실패 처리는 되지만 회원 응답이 `400 PG_REJECTED`로 바뀌는 버그를 고칩니다. 승인 흐름이 조회 결과의 실패 사유를 보고 `PG_RESPONSE_MISMATCH`를 승인 응답 경로와 같은 `502`로 돌려주도록 바꿉니다. 조회·대조·승인 취소를 하는 대사 코드는 바꾸지 않아서, 대사 배치의 동작은 그대로 둡니다.

버그 분석은 [bugfix.md](bugfix.md)에 있으며, 이 문서의 `Requirements N.M`은 그 문서의 항목 N.M을 가리킵니다.

## Glossary

- **Bug Condition (C)**: 버그가 나타나는 입력. 승인 결과 불명 → 즉시 조회 → PG 승인 완료 + 주문과 불일치
- **Property (P)**: C에서 고친 코드가 만족해야 하는 동작. PG 승인 취소 + 결제 실패(`PG_RESPONSE_MISMATCH`) + `502 PG_RESPONSE_MISMATCH`, 표준 메시지
- **Preservation**: C가 아닌 입력에서 고치기 전과 같아야 하는 동작 (bugfix.md 3.1 ~ 3.5)
- **`PaymentConfirmService.confirm`**: 결제 승인 흐름. `PgUnknownResultException`이면 결과 확인 중으로 바꾸고 `PaymentReconciler.reconcile`로 즉시 조회한다
- **`PaymentReconciler.reconcile`**: PG 조회로 결제를 확정한다. 즉시 조회와 대사 배치(`reconcileStale`)가 함께 쓴다
- **`PaymentApprovalHandler.apply`**: PG 승인 내용을 주문과 대조하고, 다르면 승인 취소 후 `markFailed(PG_RESPONSE_MISMATCH)` 하고 `PaymentException(PG_RESPONSE_MISMATCH)`를 던진다

## Bug Details

### Bug Condition

결제 승인 요청에서 PG 승인 결과를 알 수 없고(`PgUnknownResultException`), 즉시 조회한 PG 결제가 승인 완료(`DONE`)이지만 주문번호·결제 금액·결제 키 중 하나가 주문과 다를 때 나타납니다.

**Formal Specification:**

~~~
FUNCTION isBugCondition(input)
  INPUT: input = { confirm: PG 승인 호출 결과, lookup: PG 조회 결과, payment: 저장된 결제 }
  OUTPUT: boolean

  RETURN input.confirm = UNKNOWN_RESULT
         AND input.lookup.status = DONE
         AND ( input.lookup.orderId ≠ input.payment.orderId
               OR input.lookup.totalAmount ≠ input.payment.amount
               OR input.lookup.paymentKey ≠ input.payment.paymentKey )
END FUNCTION
~~~

### Examples

- 주문 14,000원, 조회 결과 15,000원 승인 완료 → 기대: `502 PG_RESPONSE_MISMATCH`, 표준 메시지 / 실제: `400 PG_REJECTED`, 메시지 "amount(15000 != 14000)"
- 주문번호 `ORD_A`, 조회 결과 주문번호 `ORD_B` → 기대: `502` / 실제: `400`, 메시지 "orderId(ORD_B)"
- 결제 키 `pk_1`, 조회 결과 결제 키 `pk_2` → 기대: `502` / 실제: `400`, 메시지 "paymentKey"
- (C 아님) 조회 결과 승인 완료 + 대조 일치 → `200` 그대로
- (C 아님) 조회 결과 `ABORTED` → `400 PG_REJECTED`, 메시지 "PG 상태: ABORTED" 그대로

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 승인 응답에서의 대조 불일치는 `PaymentApprovalHandler`가 던진 `PG_RESPONSE_MISMATCH`가 그대로 `502`가 된다 (Requirements 3.1)
- 즉시 조회 승인 완료 + 대조 일치 → `200` (3.2)
- 즉시 조회 결과 PG 실패 확정(`ABORTED` · `EXPIRED` · `CANCELED` · `NOT_FOUND_IN_PG`) → `400 PG_REJECTED`, 메시지는 실패 사유 (3.3)
- 즉시 조회 실패 또는 PG 미확정 → `202 PAYMENT_RESULT_UNKNOWN` (3.4)
- 대사 배치(`reconcileStale`)의 불일치 처리: 승인 취소 + 결제 실패, 로그, 다음 건 계속 (3.5)

**Scope:**
`isBugCondition`이 거짓인 모든 입력은 고치기 전과 같은 응답, 결제·주문 상태 변화, PG 호출 횟수, 로그를 보여야 합니다.

## Hypothesized Root Cause

1. **승인 흐름이 조회 결과의 실패를 모두 PG 거절로 바꾼다** (확인됨 — 직접 원인)
   - `PaymentConfirmService.confirm`의 `PgUnknownResultException` 분기는 `reconciled.status == FAILED`이면 실패 사유와 관계없이 `PaymentException(PG_REJECTED, reconciled.failMessage, reconciled.failCode)`를 던진다
   - 대조 불일치일 때 `failMessage`는 `apply`가 남긴 대조 항목(`amount(15000 != 14000)`)이라 그대로 회원 메시지가 된다

2. **대사가 대조 불일치 예외를 결과로 바꾼다** (확인됨 — 원인이 드러나는 경로)
   - `PaymentReconciler.reconcile`의 `DONE` 분기는 `runCatching { approvalHandler.apply(...) }.getOrElse { 실패 처리된 결제 }`로 `PG_RESPONSE_MISMATCH`를 잡아 결제 실패 결과로 돌려준다
   - 대사 배치에는 이 동작이 맞다(회원 응답이 없고 다음 건을 계속 처리해야 한다). 그래서 여기는 고치지 않는다

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Bug Condition - 즉시 조회의 대조 불일치는 502로 응답

*For any* `isBugCondition(input)`이 참인 결제 승인 요청에 대해, 고친 `confirm`은 PG 승인 취소를 정확히 1번 요청하고, 결제를 결제 실패(`PG_RESPONSE_MISMATCH`), 주문을 결제 실패로 바꾸며, `502 PG_RESPONSE_MISMATCH`와 표준 메시지로 응답한다. 응답 메시지에는 대조 항목이 없다

**Validates: Requirements 2.1, 2.2**

### Property 2: Preservation - 버그 조건 밖의 승인 결과는 그대로

*For any* `isBugCondition(input)`이 거짓인 결제 승인 요청에 대해, 고친 `confirm`의 응답(상태·코드·메시지), 결제·주문 상태, PG 호출 횟수는 고치기 전 코드와 같다

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 3: Preservation - 대사 배치는 그대로

*For any* 대사 배치가 처리하는 결제 목록(대조 불일치 결제를 포함)에 대해, 고친 코드에서도 불일치 결제는 승인 취소 후 결제 실패가 되고, 나머지 결제의 대사 결과와 로그는 고치기 전과 같다

**Validates: Requirements 3.5**

## Fix Implementation

### Changes Required

**File:** `src/main/kotlin/com/example/payment/application/PaymentConfirmService.kt`

**Function:** `confirm` — `PgUnknownResultException` 분기

**Specific Changes:**

1. **대조 불일치 갈래 추가**: `reconciled.status == FAILED`이고 `reconciled.failCode == "PG_RESPONSE_MISMATCH"`이면 `PaymentException(PaymentErrorCode.PG_RESPONSE_MISMATCH)`를 던진다. 메시지는 에러 코드의 표준 메시지를 쓴다
2. **분기 순서**: 갈래는 성공(`DONE`) → 대조 불일치 → PG 실패 확정 → 미확정 순서로 둔다
3. **주석**: 새 갈래 위에 `// R6-21` 을 단다 (order 6.21 의 갈래)

~~~kotlin
return when {
    reconciled.status == PaymentStatus.DONE -> reconciled
    // R6-21
    reconciled.status == PaymentStatus.FAILED && reconciled.failCode == "PG_RESPONSE_MISMATCH" ->
        throw PaymentException(PaymentErrorCode.PG_RESPONSE_MISMATCH)
    reconciled.status == PaymentStatus.FAILED -> throw PaymentException(
        PaymentErrorCode.PG_REJECTED,
        reconciled.failMessage ?: "결제가 승인되지 않았습니다.",
        reconciled.failCode,
    )
    else -> throw PaymentException(PaymentErrorCode.PAYMENT_RESULT_UNKNOWN)
}
~~~

**바꾸지 않는 것:**
- `PaymentReconciler`, `PaymentApprovalHandler` — 대사 배치와 승인 응답 경로를 그대로 두기 위해 (Requirements 3.1, 3.5)

## Testing Strategy

### Validation Approach

두 단계로 확인합니다. 먼저 고치기 전 코드에서 버그를 재현하는 반례를 찾아 원인 분석이 맞는지 확인하고, 고친 뒤 버그 조건에서는 기대 동작을, 그 밖에서는 기존 동작을 확인합니다.

### Exploratory Bug Condition Checking

**Goal:** 고치기 전 코드에서 반례를 찾아 원인 분석을 확인하거나 반박합니다. 반박되면 원인을 다시 분석합니다.

**Test Plan:** `FakePgClient`로 승인 호출은 결과 불명, 조회는 승인 완료 + 불일치로 두고 결제 승인을 요청합니다. 고치기 전 코드에서 실행해 실패를 확인합니다.

**Test Cases:**
1. **금액 불일치**: 주문 14,000원, 조회 15,000원 (고치기 전 실패 예상)
2. **주문번호 불일치**: 조회 주문번호가 다름 (고치기 전 실패 예상)
3. **결제 키 불일치**: 조회 결제 키가 다름 (고치기 전 실패 예상)

**Expected Counterexamples:**
- 응답 `400 PG_REJECTED`, 메시지 "amount(15000 != 14000)", `pgCode` = `PG_RESPONSE_MISMATCH`
- 원인: 위 Hypothesized Root Cause 1

### Fix Checking

**Goal:** 버그 조건의 모든 입력에서 고친 코드가 Property 1을 만족하는지 확인합니다.

~~~
FOR ALL input WHERE isBugCondition(input) DO
  result := confirm_fixed(input)
  ASSERT result.status = 502 AND result.code = PG_RESPONSE_MISMATCH
  ASSERT result.message = "결제사 응답이 주문 정보와 일치하지 않아 결제를 취소했습니다."
  ASSERT pg.cancelCount = 1 AND payment.status = FAILED AND order.status = PAYMENT_FAILED
END FOR
~~~

### Preservation Checking

**Goal:** 버그 조건 밖의 모든 입력에서 고친 코드가 고치기 전과 같은지 확인합니다.

~~~
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT confirm_original(input) = confirm_fixed(input)
END FOR
~~~

**Testing Approach:** 고치기 전 코드에서 기존 인수 테스트와 Property 테스트를 먼저 실행해 통과를 확인하고(현재 동작 기록), 고친 뒤 다시 실행합니다. Property 테스트는 PG 승인 결과(승인 · 거절 · 미도달 · 결과 불명 · 예상 못한 오류)와 조회 결과(승인 일치 · 실패 확정 · 미확정 · 조회 실패)의 조합을 무작위로 만들고, 버그 조건 조합은 뺍니다.

**Test Cases:**
1. **승인 응답 불일치 보존**: 승인 응답에서 금액 불일치 → `502` 그대로 (기존 `R6-18`)
2. **즉시 조회 일치 보존**: `200` 그대로 (기존 `R6-21a`)
3. **즉시 조회 실패 확정 보존**: `400 PG_REJECTED`, 실패 사유 메시지 그대로 (기존 `R6-21b`)
4. **미확정 보존**: `202` 그대로 (기존 `R6-22`)
5. **대사 배치 보존**: 불일치 결제 + 정상 결제를 함께 대사 → 불일치는 결제 실패, 정상은 승인 완료 (기존 `R7-2`)

### 테스트 이름

| bugfix 항목 | 테스트 | 위치 |
|---|---|---|
| 2.1, 2.2 | `R6-21c 즉시 조회에서 대조 결과가 다르면 승인을 취소하고 502로 응답한다` (신규) | `OrderPaymentConfirmAcceptanceTest` |
| 3.1 | `R6-18 대조 결과가 다르면 PG 승인을 취소하고 결제 실패로 처리한다` (기존) | `OrderPaymentConfirmAcceptanceTest` |
| 3.2, 3.3 | `R6-21a`, `R6-21b` (기존) | `OrderPaymentConfirmAcceptanceTest` |
| 3.4 | `R6-22` (기존) | `OrderPaymentConfirmAcceptanceTest` |
| 3.5 | `R7-2` (기존) | `OrderPaymentResultAcceptanceTest` |
| Property 1 ~ 3 | `ConfirmRecheckMismatchPropertyTest` (신규, 클래스 주석에 `confirm-recheck-mismatch`) | `src/test/kotlin/.../payment/` |
