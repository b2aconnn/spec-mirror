import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkSpec, loadConfig, expandRefs, parseSpecLink, trace, approve, gate, next, stageStatus, stageHash, checkMap } from '../scripts/spec-mirror.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLI = path.join(ROOT, 'scripts', 'spec-mirror.mjs')
const EXAMPLES = path.join(ROOT, 'examples')
const BUG = 'confirm-recheck-mismatch'

/** 정답 예제(order, confirm-recheck-mismatch)를 담은 임시 프로젝트 */
function project({ config = {}, only, map = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-mirror-'))
  fs.mkdirSync(path.join(dir, '.spec-mirror'))
  fs.writeFileSync(path.join(dir, '.spec-mirror', 'config.json'), JSON.stringify({ specRoot: 'docs/spec', ...config }))
  for (const name of only || ['order', BUG]) fs.cpSync(path.join(EXAMPLES, name), path.join(dir, 'docs', 'spec', name), { recursive: true })
  if (map) fs.copyFileSync(path.join(EXAMPLES, 'README.md'), path.join(dir, 'docs', 'spec', 'README.md'))
  const p = {
    dir,
    file: (name, f) => path.join(dir, 'docs', 'spec', name, f),
    config: () => loadConfig(dir),
    check: (name, opts) => checkSpec(dir, loadConfig(dir), name, opts),
    write: (rel, text) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text) },
  }
  return p
}

function edit(file, from, to) {
  const text = fs.readFileSync(file, 'utf8')
  assert.ok(text.includes(from), `fixture 에 "${from.slice(0, 50)}" 이(가) 없습니다`)
  fs.writeFileSync(file, text.replace(from, to))
}

const fmt = (list) => list.map((e) => `${e.rule} ${e.file}:${e.line} ${e.message}`).join('\n')
const errorsOf = (r, rule) => r.report.errors.filter((i) => i.rule === rule)
const warningsOf = (r, rule) => r.report.warnings.filter((i) => i.rule === rule)

function cli(cwd, ...args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' })
}

function hook(kind, cwd, payload) {
  return spawnSync(process.execPath, [CLI, 'hook', kind], { cwd, input: JSON.stringify({ cwd, ...payload }), encoding: 'utf8' })
}

/** fixture 를 고친 뒤 규칙이 잡히는지 */
function mutationCases(title, name, file, cases) {
  describe(title, () => {
    for (const [rule, label, from, to, severity = 'error'] of cases) {
      test(`${rule} ${label}`, () => {
        const p = project()
        edit(p.file(name, file), from, to)
        const r = p.check(name)
        const found = severity === 'error' ? errorsOf(r, rule) : warningsOf(r, rule)
        assert.ok(found.length > 0, `${rule} 이(가) 잡히지 않았습니다.\n${fmt(r.report.issues)}`)
      })
    }
  })
}

// ─────────────────────────────── 정답 예제 ───────────────────────────────

describe('정답 예제', () => {
  test('order: 오류 0, 경고 0', () => {
    const r = project().check('order')
    assert.equal(r.type, 'feature')
    assert.deepEqual(r.report.errors, [], fmt(r.report.errors))
    assert.deepEqual(r.report.warnings, [], fmt(r.report.warnings))
  })

  test('order: Requirement 9개, 기준 수가 문서와 같고 Property 20개', () => {
    const r = project().check('order')
    assert.deepEqual(r.first.requirements.map((x) => x.criteria.length), [17, 8, 5, 5, 9, 26, 7, 7, 5])
    assert.equal(r.design.properties.length, 20)
  })

  test(`${BUG}: 오류 0, 경고 0`, () => {
    const r = project().check(BUG)
    assert.equal(r.type, 'bugfix')
    assert.deepEqual(r.report.errors, [], fmt(r.report.errors))
    assert.deepEqual(r.report.warnings, [], fmt(r.report.warnings))
  })

  test(`${BUG}: 현재 2 · 기대 2 · 유지 5, Property 3개, 명세 연결`, () => {
    const r = project().check(BUG)
    assert.deepEqual(r.first.requirements.map((x) => x.criteria.length), [2, 2, 5])
    assert.deepEqual(r.design.properties.map((x) => x.kind), ['bug', 'keep', 'keep'])
    assert.deepEqual(r.first.linkedFeatures, ['order'])
  })

  test('templates: 자리표시자가 남은 골격은 오류로 잡힌다', () => {
    const p = project({ only: [] })
    for (const s of ['requirements', 'design', 'tasks']) assert.equal(cli(p.dir, 'scaffold', 'feat', s).status, 0)
    for (const s of ['bugfix', 'design', 'tasks']) assert.equal(cli(p.dir, 'scaffold', 'bug', s).status, 0)
    for (const [name, rules] of [['feat', ['REQ000', 'DES000', 'TSK000']], ['bug', ['BUG000', 'BDS000', 'TSK000']]]) {
      const r = p.check(name)
      for (const rule of rules) assert.ok(errorsOf(r, rule).length > 0, `${name} ${rule}`)
    }
    assert.ok(fs.existsSync(p.file('feat', 'design/08-deployment-configuration.md')))
    assert.ok(!fs.existsSync(p.file('bug', 'design')))
  })
})

// ─────────────────────────────── 기능 명세 ───────────────────────────────

mutationCases('requirements 검사', 'order', 'requirements.md', [
  ['REQ000', '자리표시자', '- 범위 밖: 결제 완료 주문의', '- 범위 밖: <범위 밖 항목>, 결제 완료 주문의'],
  ['REQ001', 'Open Questions 섹션 누락', '## Open Questions', '## 미정 사항'],
  ['REQ001', '첫 줄 제목', '# Requirements Document', '# 요구사항'],
  ['REQ002', 'Requirement 번호 건너뜀', '### Requirement 2: 중복 주문 방지', '### Requirement 3: 중복 주문 방지'],
  ['REQ003', 'User Story 형식', '**User Story:** As a 회원, I want to 상품과 수량을 골라', '**User Story:** 회원은 상품과 수량을 골라'],
  ['REQ004', 'Acceptance Criteria 누락', '#### Acceptance Criteria\n\n##### 처리 흐름\n\n1. **회원은 상품과', '##### 처리 흐름\n\n1. **회원은 상품과'],
  ['REQ005', '허용되지 않은 기준 묶음', '##### 항상 지켜야 할 규칙\n\n15.', '##### 기타 규칙\n\n15.'],
  ['REQ006', '기준 번호 건너뜀', '2. **주문 상품은 1개 이상 20개 이하로', '3. **주문 상품은 1개 이상 20개 이하로'],
  ['REQ007', '굵은 규칙 누락', '2. **주문 상품은 1개 이상 20개 이하로 담을 수 있다.**', '2. 주문 상품은 1개 이상 20개 이하로 담을 수 있다.'],
  ['REQ008', '허용되지 않은 항목 이름', '   - 경계: 20개 가능, 21개 불가', '   - 범위: 20개 가능, 21개 불가', 'warning'],
  ['REQ010', '에러 항목 형식', '- 에러: `400` `INVALID_ORDER_ITEM_COUNT`', '- 에러: 400 잘못된 개수'],
  ['REQ011', '응답에 상태 없음', '   - 응답: `200` — 기존 주문 정보', '   - 응답: 기존 주문 정보', 'warning'],
  ['REQ012', '메시지 따옴표 없음', '- 메시지: "주문 상품은 1개 이상 20개 이하로 담아주세요."', '- 메시지: 주문 상품은 1개 이상 20개 이하로 담아주세요.', 'warning'],
  ['REQ013', '금지 표현', '비어 있거나 20개를 넘으면 주문을 받지 않는다.', '비어 있거나 20개를 넘으면 예외 처리한다.'],
  ['REQ014', '기술 용어 (인라인 코드 안)', '1. **회원은 상품과 수량을 골라 주문할 수 있다.**', '1. **회원은 `POST /api/orders` 로 주문할 수 있다.**'],
  ['REQ014', '처리 방식', '16. **주문을 접수하는 동안 PG에는 어떤 요청도 보내지 않는다.**', '16. **주문 접수 알림은 메시지 큐로 비동기 발송한다.**'],
  ['REQ015', '코드 식별자', '- 이유: 추측할 수 없어야 하고', '- 이유: OrderIdGenerator 가 추측할 수 없어야 하고', 'warning'],
  ['REQ016', '없는 기준 참조', '주문: 7.1에 따라 결제 완료', '주문: 7.9에 따라 결제 완료'],
  ['REQ016', '없는 Requirement 참조', '이유: 기한 만료 처리는 Requirement 8이 맡는다', '이유: 기한 만료 처리는 Requirement 12가 맡는다'],
  ['REQ017', '상태 줄 형식', '  - 결제 대기 (`PENDING_PAYMENT`): 주문이 접수됐고', '  - 결제 대기 `PENDING_PAYMENT` (`대기`) 주문이 접수됐고', 'warning'],
])

describe('requirements 허용 규칙', () => {
  test('Glossary 에 나오는 약어(PG)와 형식 · 요약 항목, 이름 없는 보충 줄은 경고가 아니다', () => {
    const r = project().check('order')
    assert.equal(warningsOf(r, 'REQ008').length, 0)
  })
  test('extraItemLabels 로 항목 이름을 늘릴 수 있다', () => {
    const p = project({ config: { extraItemLabels: ['범위'] } })
    edit(p.file('order', 'requirements.md'), '   - 경계: 20개 가능, 21개 불가', '   - 범위: 20개 가능, 21개 불가')
    assert.equal(warningsOf(p.check('order'), 'REQ008').length, 0)
  })
  test('큰따옴표 안의 안내 문구와 코드 블록은 검사하지 않는다', () => {
    const p = project()
    const f = p.file('order', 'requirements.md')
    edit(f, '- 메시지: "주문 상품은 1개 이상 20개 이하로 담아주세요."', '- 메시지: "주문 상품은 1개 이상 20개 이하로 담아주세요. 적절한 수량을 고르세요."')
    edit(f, '## Open Questions', '```\nPOST /api/orders 트랜잭션 예외 처리\n```\n\n## Open Questions')
    assert.deepEqual(p.check('order').report.errors, [])
  })
})

mutationCases('design 검사', 'order', 'design.md', [
  ['DES001', '첫 줄 제목', '# Technical Design Document', '# Design'],
  ['DES001', '설계 목표 누락', '### 설계 목표', '### 목표'],
  ['DES002', '문서 구성 순서', '| [아키텍처](design/01-architecture.md) | Architecture |\n| [컴포넌트와 인터페이스](design/02-components.md) | Components and Interfaces |', '| [컴포넌트와 인터페이스](design/02-components.md) | Components and Interfaces |\n| [아키텍처](design/01-architecture.md) | Architecture |'],
])

mutationCases('design 본문 검사', 'order', 'design/07-correctness-properties.md', [
  ['DES006', 'Property Reflection 누락', '**Property Reflection:**', '**Reflection:**'],
  ['DES007', 'Classification 값', 'Classification: EXAMPLE\n  Test Strategy: FakeProductCatalog를 장애 상태로', 'Classification: SCENARIO\n  Test Strategy: FakeProductCatalog를 장애 상태로'],
  ['DES008', 'Prework 제목이 기준 문장과 다름', '1.6 상품 정보를 확인할 수 없으면 주문을 받지 않는다', '1.6 카탈로그 장애 시 거절', 'warning'],
  ['DES009', 'Property 번호 건너뜀', '### Property 2: 상품별 수량 제한', '### Property 3: 상품별 수량 제한'],
  ['DES009', 'For any 누락', '*For any* 회원 A의 주문에 대해', '회원 A의 주문에 대해'],
  ['DES010', '없는 기준 검증', '**Validates: Requirements 8.7**', '**Validates: Requirements 8.9**'],
])

describe('design 파일 구성', () => {
  test('DES003 · DES004 본문 파일 제목과 섹션', () => {
    const p = project()
    edit(p.file('order', 'design/06-security-performance.md'), '## Performance Optimization', '## Performance')
    edit(p.file('order', 'design/01-architecture.md'), '> [design.md](../design.md)로 돌아가기', '')
    const r = p.check('order')
    assert.ok(errorsOf(r, 'DES004').length > 0)
    assert.ok(errorsOf(r, 'DES003').length > 0)
  })
  test('DES005 컴포넌트 번호', () => {
    const p = project()
    edit(p.file('order', 'design/02-components.md'), '### 3. Order Idempotency Service', '### 4. Order Idempotency Service')
    assert.ok(errorsOf(p.check('order'), 'DES005').length > 0)
  })
  test('DES006 도메인 용어 ↔ 코드 누락', () => {
    const p = project()
    edit(p.file('order', 'design/03-data-models.md'), '### 도메인 용어 ↔ 코드', '### 용어 표')
    assert.ok(errorsOf(p.check('order'), 'DES006').length > 0)
  })
  test('DES002 본문 파일 누락 (draft 에서는 정보)', () => {
    const p = project()
    fs.rmSync(p.file('order', 'design/08-deployment-configuration.md'))
    assert.ok(errorsOf(p.check('order'), 'DES002').length > 0)
    assert.equal(errorsOf(p.check('order', { draft: true }), 'DES002').length, 0)
  })
})

mutationCases('tasks 검사', 'order', 'tasks.md', [
  ['TSK001', '섹션 누락', '## Notes', '## 메모'],
  ['TSK002', '체크박스 줄 형식', '- [ ] 4. Checkpoint - 기본 구조 확인', '- [] 4. Checkpoint - 기본 구조 확인'],
  ['TSK003', '하위 번호 건너뜀', '  - [ ] 2.2 FakeProductCatalog 작성', '  - [ ] 2.3 FakeProductCatalog 작성'],
  ['TSK004', '_Requirements_ 형식', '    - _Requirements: 2.3, 6.11, 8.2_', '    - Requirements: 2.3, 6.11, 8.2 _Requirements_'],
  ['TSK004', '없는 기준 참조', '    - _Requirements: 2.3, 6.11, 8.2_', '    - _Requirements: 2.3, 6.11, 8.20_'],
  ['TSK005', '없는 Property', '    - **Property 17: 만료 대상 선정**', '    - **Property 27: 만료 대상 선정**'],
  ['TSK005', 'Property 이름 다름', '    - **Property 17: 만료 대상 선정**', '    - **Property 17: 만료 대상**', 'warning'],
  ['TSK007', '그래프 JSON 깨짐', '{ "id": 0, "tasks": ["0"] },', '{ "id": 0, "tasks": ["0"] ,'],
  ['TSK008', '그래프 태스크 누락', '{ "id": 3, "tasks": ["4"] },', '{ "id": 3, "tasks": [] },'],
  ['TSK008', '그래프에 상위 태스크', '{ "id": 3, "tasks": ["4"] },', '{ "id": 3, "tasks": ["4", "2"] },'],
  ['TSK010', '상위 완료 · 하위 미완료', '- [ ] 2. 테스트 지원 코드 작성', '- [x] 2. 테스트 지원 코드 작성', 'warning'],
])

// ─────────────────────────────── 버그 명세 ───────────────────────────────

mutationCases('bugfix.md 검사', BUG, 'bugfix.md', [
  ['BUG000', '자리표시자', '- 범위 밖: 대사의 처리 방식', '- 범위 밖: <범위 밖>'],
  ['BUG001', '첫 줄 제목', '# Bugfix Requirements Document', '# Bugfix'],
  ['BUG001', 'Open Questions 누락', '## Open Questions', '## 미정'],
  ['BUG002', '하위 제목 순서', '### Expected Behavior (Correct)', '### Expected Behavior'],
  ['BUG003', '번호가 묶음과 다름', '2.2 **회원에게 보여주는 안내 문구에는', '3.2 **회원에게 보여주는 안내 문구에는'],
  ['BUG003', '번호 건너뜀', '3.4 **한 번 조회로도', '3.6 **한 번 조회로도'],
  ['BUG004', '기대 동작 수가 다름', '2.2 **회원에게 보여주는 안내 문구에는 대조한 항목 정보를 넣지 않는다.**', '보충: 안내 문구에는 대조한 항목 정보를 넣지 않는다.'],
  ['BUG005', '굵은 문장 없음', '3.4 **한 번 조회로도 확정되지 않으면 지금처럼 결과를 확인 중이라고 응답한다.**', '3.4 한 번 조회로도 확정되지 않으면 지금처럼 결과를 확인 중이라고 응답한다.'],
  ['BUG006', '현재 동작에 재현 없음', '   - 재현: 주문 금액 14,000원 결제 승인 요청', '   - 조건: 주문 금액 14,000원 결제 승인 요청'],
  ['BUG007', '유지할 동작에 지금처럼 없음', '3.4 **한 번 조회로도 확정되지 않으면 지금처럼 결과를', '3.4 **한 번 조회로도 확정되지 않으면 결과를'],
  ['BUG007', '기대 동작에 지금처럼', '2.2 **회원에게 보여주는 안내 문구에는', '2.2 **지금처럼 회원에게 보여주는 안내 문구에는', 'warning'],
  ['BUG008', '허용되지 않은 항목 이름', '   - 이유: 대조 항목은 회원이', '   - 배경: 대조 항목은 회원이', 'warning'],
  ['BUG009', '에러 형식', '   - 에러: `502` `PG_RESPONSE_MISMATCH`\n   - 메시지: "결제사 응답이 주문 정보와 일치하지 않아 결제를 취소했습니다."\n   - 명세: order 6.21', '   - 에러: 502 불일치\n   - 메시지: "결제사 응답이 주문 정보와 일치하지 않아 결제를 취소했습니다."\n   - 명세: order 6.21'],
  ['BUG012', '금지 표현', '대사는 회원에게 응답하지 않으며', '대사는 적절한 처리를 하며'],
  ['BUG013', '기술 용어', '3.5 **대사가 같은 불일치를 확인하면', '3.5 **대사 배치의 `PaymentReconciler` 클래스가 같은 불일치를 확인하면'],
  ['BUG015', '명세 형식', '   - 명세: order 6.22', '   - 명세: 결제 승인 6.22'],
  ['BUG015', '없는 기능 명세', '   - 명세: order 6.22', '   - 명세: payment 6.22'],
  ['BUG015', '없는 기준', '   - 명세: order 6.22', '   - 명세: order 6.40'],
  ['BUG016', '명세 없음', '   - 응답: `202` `PAYMENT_RESULT_UNKNOWN`\n   - 메시지: "결제 결과를 확인 중입니다. 잠시 후 결제 내역을 확인해주세요."\n   - 명세: order 6.22', '   - 응답: `202` `PAYMENT_RESULT_UNKNOWN`\n   - 메시지: "결제 결과를 확인 중입니다. 잠시 후 결제 내역을 확인해주세요."', 'warning'],
  ['BUG017', '없는 기능 기준 참조', '   - 주문: order 7.2에 따라 결제 실패\n   - 에러: `502`', '   - 주문: order 7.12에 따라 결제 실패\n   - 에러: `502`'],
  ['BUG017', '없는 항목 참조', '   - 재현: 1.1과 같다.', '   - 재현: 1.4와 같다.'],
])

describe('bugfix.md 명세 연결', () => {
  test('parseSpecLink', () => {
    assert.deepEqual(parseSpecLink('없음').kind, 'none')
    assert.deepEqual(parseSpecLink('새 기준 (order)'), { kind: 'new', feature: 'order', refs: [] })
    assert.deepEqual(parseSpecLink('order 6.18, 6.21').refs.map((r) => r.raw), ['order 6.18', 'order 6.21'])
    assert.equal(parseSpecLink('결제 6.18').kind, 'invalid')
  })
  test('명세: 새 기준 · 없음 은 오류가 아니다', () => {
    const p = project()
    const f = p.file(BUG, 'bugfix.md')
    edit(f, '   - 명세: order 6.22', '   - 명세: 새 기준 (order)')
    edit(f, '   - 명세: order 7.2', '   - 명세: 없음')
    assert.deepEqual(p.check(BUG).report.errors, [])
  })
  test('한 폴더에 requirements.md 와 bugfix.md 가 함께 있으면 SPEC001', () => {
    const p = project()
    fs.copyFileSync(p.file('order', 'requirements.md'), p.file(BUG, 'requirements.md'))
    assert.ok(errorsOf(p.check(BUG), 'SPEC001').length > 0)
  })
})

mutationCases('bugfix design 검사', BUG, 'design.md', [
  ['BDS001', '첫 줄 제목', '# Bugfix Design Document', '# Technical Design Document'],
  ['BDS001', '섹션 순서', '## Hypothesized Root Cause', '## Root Cause'],
  ['BDS002', '필수 하위 섹션', '### Preservation Checking', '### 보존 확인'],
  ['BDS003', 'isBugCondition 의사 코드', 'FUNCTION isBugCondition(input)', 'FUNCTION check(input)'],
  ['BDS004', 'Property 머리말', '*A property is a characteristic', '*Property 는'],
  ['BDS005', 'Validates 누락', '**Validates: Requirements 3.5**', 'Requirements 3.5'],
  ['BDS006', '없는 항목 검증', '**Validates: Requirements 3.5**', '**Validates: Requirements 3.5, 3.9**'],
  ['BDS007', 'Property 종류 이름', '### Property 3: Preservation - 대사 배치는 그대로', '### Property 3: 대사 배치는 그대로'],
  ['BDS008', 'Bug Condition 이 3.M 검증', '**Validates: Requirements 2.1, 2.2**', '**Validates: Requirements 2.1, 2.2, 3.1**'],
  ['BDS009', '검증되지 않은 유지할 동작', '**Validates: Requirements 3.5**', '**Validates: Requirements 3.4**'],
])

describe('bugfix design 파일 구성', () => {
  test('BDS001 버그 명세에 design/ 폴더', () => {
    const p = project()
    p.write(`docs/spec/${BUG}/design/01-architecture.md`, '# x\n')
    assert.ok(errorsOf(p.check(BUG), 'BDS001').length > 0)
  })
})

mutationCases('bugfix tasks 검사', BUG, 'tasks.md', [
  ['BTK001', '상위 태스크 순서', '- [ ] 1. 버그 조건 탐색 테스트 작성', '- [ ] 1. 탐색 테스트'],
  ['BTK001', '명세 반영 누락', '- [ ] 4. 명세 반영', '- [ ] 4. 문서 정리'],
  ['BTK002', '탐색 테스트가 선택', '- [ ] 1. 버그 조건 탐색 테스트 작성', '- [ ]* 1. 버그 조건 탐색 테스트 작성'],
  ['BTK002', '보존 테스트에 Property 누락', '  - **Property 3: Preservation - 대사 배치는 그대로**\n  - **고치기 전 코드에서 통과해야 합니다.**', '  - **고치기 전 코드에서 통과해야 합니다.**'],
  ['BTK003', '확인 태스크 이름', '  - [ ] 3.2 탐색 테스트 통과 확인', '  - [ ] 3.2 테스트 확인'],
  ['BTK004', '테스트보다 먼저 고침', '{ "id": 0, "tasks": ["1", "2"] },\n    { "id": 1, "tasks": ["3.1"] },', '{ "id": 0, "tasks": ["1", "2", "3.1"] },\n    { "id": 1, "tasks": [] },'],
  ['BTK005', '탐색 테스트 결과 기록 없음', '- [ ] 1. 버그 조건 탐색 테스트 작성', '- [x] 1. 버그 조건 탐색 테스트 작성', 'warning'],
])

describe('bugfix tasks 결과 기록', () => {
  test('완료한 탐색 테스트에 결과: 가 있으면 경고가 없다', () => {
    const p = project()
    edit(p.file(BUG, 'tasks.md'), '- [ ] 1. 버그 조건 탐색 테스트 작성\n', '- [x] 1. 버그 조건 탐색 테스트 작성\n  - 결과: 400 PG_REJECTED, 메시지 "amount(15000 != 14000)"\n')
    assert.equal(warningsOf(p.check(BUG), 'BTK005').length, 0)
  })
})

describe('여러 곳을 함께 고쳐야 잡히는 규칙', () => {
  test('BDS010 원인 항목 없음', () => {
    const p = project()
    const f = p.file(BUG, 'design.md')
    edit(f, '1. **승인 흐름이 조회 결과의 실패를', '- **승인 흐름이 조회 결과의 실패를')
    edit(f, '2. **대사가 대조 불일치 예외를', '- **대사가 대조 불일치 예외를')
    assert.ok(errorsOf(p.check(BUG), 'BDS010').length > 0)
  })
  test('TSK009 기능 기준이 어떤 태스크에도 없음', () => {
    const p = project()
    const f = p.file('order', 'tasks.md')
    edit(f, '    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 9.2, 9.5_', '    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 9.2_')
    edit(f, '    - _Requirements: 9.1 ~ 9.5_', '    - _Requirements: 9.1 ~ 9.4_')
    const r = p.check('order')
    assert.ok(errorsOf(r, 'TSK009').some((e) => e.message.includes('9.5')), fmt(r.report.errors))
  })
  test('TSK009 bugfix 항목이 어떤 태스크에도 없음', () => {
    const p = project()
    const f = p.file(BUG, 'tasks.md')
    edit(f, '  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_\n\n- [ ] 3.', '  - _Requirements: 3.1, 3.2, 3.3, 3.4_\n\n- [ ] 3.')
    edit(f, '    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_', '    - _Requirements: 3.1, 3.2, 3.3, 3.4_')
    const r = p.check(BUG)
    assert.ok(errorsOf(r, 'TSK009').some((e) => e.message.includes('3.5')), fmt(r.report.errors))
  })
})

// ─────────────────────────────── 승인 상태 ───────────────────────────────

describe('단계 승인', () => {
  test('앞 단계 순서대로만 승인된다', () => {
    const p = project()
    const c = p.config()
    assert.equal(approve(p.dir, c, 'order', 'design', 't').ok, false)
    assert.equal(gate(p.dir, c, 'order', 'design').ok, false)
    assert.equal(approve(p.dir, c, 'order', 'requirements', 't').ok, true)
    assert.equal(gate(p.dir, c, 'order', 'design').ok, true)
    assert.equal(gate(p.dir, c, 'order', 'implement').ok, false)
    assert.equal(approve(p.dir, c, 'order', 'design', 't').ok, true)
    assert.equal(approve(p.dir, c, 'order', 'tasks', 't').ok, true)
    assert.equal(gate(p.dir, c, 'order', 'implement').ok, true)
  })

  test('형식 오류가 있으면 승인하지 않는다', () => {
    const p = project()
    edit(p.file('order', 'requirements.md'), '- 에러: `400` `INVALID_ORDER_ITEM_COUNT`', '- 에러: 400')
    const r = approve(p.dir, p.config(), 'order', 'requirements', 't')
    assert.equal(r.ok, false)
    assert.match(r.message, /형식 오류/)
  })

  test('승인 뒤 바뀌면 changed, 앞 단계를 다시 승인하면 뒤 단계는 stale', () => {
    const p = project()
    const c = p.config()
    const dir = path.join(p.dir, 'docs/spec/order')
    for (const s of ['requirements', 'design', 'tasks']) assert.equal(approve(p.dir, c, 'order', s, 't').ok, true)
    edit(p.file('order', 'requirements.md'), '1회 주문 금액은 10,000,000원을 넘을 수 없습니다."', '1회 주문 금액은 10,000,000원을 넘길 수 없습니다."')
    assert.equal(stageStatus(dir, 'feature', 'requirements').status, 'changed')
    assert.equal(gate(p.dir, c, 'order', 'design').ok, false)
    assert.equal(approve(p.dir, c, 'order', 'requirements', 't').ok, true)
    assert.equal(stageStatus(dir, 'feature', 'design').status, 'stale')
    assert.equal(stageStatus(dir, 'feature', 'tasks').status, 'stale')
    assert.equal(approve(p.dir, c, 'order', 'design', 't').ok, true)
    assert.equal(stageStatus(dir, 'feature', 'tasks').status, 'stale')
    assert.equal(approve(p.dir, c, 'order', 'tasks', 't').ok, true)
    assert.equal(stageStatus(dir, 'feature', 'tasks').status, 'approved')
  })

  test('체크 표시와 결과: 줄은 tasks 승인을 풀지 않는다', () => {
    const p = project()
    const c = p.config()
    const dir = path.join(p.dir, 'docs/spec', BUG)
    for (const s of ['bugfix', 'design', 'tasks']) assert.equal(approve(p.dir, c, BUG, s, 't').ok, true)
    const before = stageHash(dir, 'bugfix', 'tasks')
    edit(p.file(BUG, 'tasks.md'), '- [ ] 1. 버그 조건 탐색 테스트 작성\n', '- [x] 1. 버그 조건 탐색 테스트 작성\n  - 결과: 400 PG_REJECTED\n')
    edit(p.file(BUG, 'tasks.md'), '  - [ ] 3.1 즉시', '  - [-] 3.1 즉시')
    assert.equal(stageHash(dir, 'bugfix', 'tasks'), before)
    assert.equal(stageStatus(dir, 'bugfix', 'tasks').status, 'approved')
    edit(p.file(BUG, 'tasks.md'), '    - 갈래 순서: 성공', '    - 갈래 순서(확정): 성공')
    assert.equal(stageStatus(dir, 'bugfix', 'tasks').status, 'changed')
  })

  test('버그 명세의 단계 이름은 bugfix · design · tasks', () => {
    const p = project()
    const c = p.config()
    assert.equal(approve(p.dir, c, BUG, 'requirements', 't').ok, false)
    assert.equal(approve(p.dir, c, BUG, 'bugfix', 't').ok, true)
    assert.equal(gate(p.dir, c, BUG, 'design').ok, true)
  })

  test('next 는 write → approve → implement → sync 순서로 안내한다', () => {
    const p = project({ only: [] })
    const c = p.config()
    assert.equal(next(p.dir, c, 'order').action, 'start')
    fs.cpSync(path.join(EXAMPLES, 'order', 'requirements.md'), p.file('order', 'requirements.md'))
    assert.deepEqual([next(p.dir, c, 'order').action, next(p.dir, c, 'order').stage], ['approve', 'requirements'])
    approve(p.dir, c, 'order', 'requirements', 't')
    assert.deepEqual([next(p.dir, c, 'order').action, next(p.dir, c, 'order').stage], ['write', 'design'])
    fs.cpSync(path.join(EXAMPLES, 'order'), path.join(p.dir, 'docs/spec/order'), { recursive: true })
    approve(p.dir, c, 'order', 'design', 't')
    approve(p.dir, c, 'order', 'tasks', 't')
    const n = next(p.dir, c, 'order')
    assert.equal(n.action, 'implement')
    assert.equal(n.task.id, '0')
    const tasks = p.file('order', 'tasks.md')
    fs.writeFileSync(tasks, fs.readFileSync(tasks, 'utf8').replace(/^(\s*- )\[ \](?!\*)/gm, '$1[x]'))
    assert.equal(next(p.dir, c, 'order').action, 'sync')
  })
})

// ─────────────────────────────── 훅 ───────────────────────────────

describe('훅', () => {
  test('post: 형식 오류가 있으면 종료 코드 2 와 규칙 ID 로 막는다', () => {
    const p = project()
    const f = p.file('order', 'requirements.md')
    edit(f, '- 에러: `400` `INVALID_ORDER_ITEM_COUNT`', '- 에러: 400 개수 오류')
    const r = hook('post', p.dir, { tool_name: 'Edit', tool_input: { file_path: f } })
    assert.equal(r.status, 2)
    assert.match(r.stderr, /REQ010/)
  })

  test('post: 자리표시자가 남은 작성 중 문서는 막지 않고 알린다', () => {
    const p = project({ only: [] })
    cli(p.dir, 'scaffold', 'feat', 'requirements')
    const r = hook('post', p.dir, { tool_name: 'Write', tool_input: { file_path: p.file('feat', 'requirements.md') } })
    assert.equal(r.status, 0)
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /자리표시자/)
  })

  test('post: 명세가 아닌 파일은 무시한다', () => {
    const p = project()
    p.write('src/app.kt', 'x')
    const r = hook('post', p.dir, { tool_name: 'Write', tool_input: { file_path: path.join(p.dir, 'src/app.kt') } })
    assert.equal(r.status, 0)
    assert.equal(r.stdout, '')
  })

  test('pre: 앞 단계 승인 전에는 다음 단계 문서를 쓰지 못한다', () => {
    const p = project()
    const deny = (file) => {
      const r = hook('pre', p.dir, { tool_name: 'Write', tool_input: { file_path: file } })
      assert.equal(r.status, 0)
      return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null
    }
    assert.equal(deny(p.file('order', 'design/02-components.md'))?.permissionDecision, 'deny')
    assert.equal(deny(p.file('order', 'requirements.md')), null)
    approve(p.dir, p.config(), 'order', 'requirements', 't')
    assert.equal(deny(p.file('order', 'design/02-components.md')), null)
    assert.equal(deny(p.file('order', 'tasks.md'))?.permissionDecision, 'deny')
  })

  test('pre: 승인 기록 · 종류가 다른 문서 · 버그 design 폴더를 막는다', () => {
    const p = project()
    approve(p.dir, p.config(), BUG, 'bugfix', 't')
    const decision = (file) => {
      const r = hook('pre', p.dir, { tool_name: 'Edit', tool_input: { file_path: file } })
      return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : 'allow'
    }
    assert.equal(decision(p.file(BUG, '.spec-mirror.json')), 'deny')
    assert.equal(decision(p.file('order', 'bugfix.md')), 'deny')
    assert.equal(decision(p.file(BUG, 'requirements.md')), 'deny')
    assert.equal(decision(p.file(BUG, 'design/01-architecture.md')), 'deny')
    assert.equal(decision(p.file(BUG, 'design.md')), 'allow')
    assert.equal(decision(p.file('new-feature', 'requirements.md')), 'allow')
    assert.equal(decision(p.file('new-feature', 'design.md')), 'deny')
  })

  test('pre: stageGate 를 끄면 단계 잠금을 하지 않는다 (승인 기록 보호는 유지)', () => {
    const p = project({ config: { stageGate: false } })
    const r = hook('pre', p.dir, { tool_name: 'Write', tool_input: { file_path: p.file('order', 'tasks.md') } })
    assert.equal(r.stdout, '')
    const s = hook('pre', p.dir, { tool_name: 'Write', tool_input: { file_path: p.file('order', '.spec-mirror.json') } })
    assert.match(s.stdout, /deny/)
  })

  test('session: 설정이 있으면 진행 중인 명세를 알리고, 없으면 조용하다', () => {
    const p = project()
    const r = hook('session', p.dir, {})
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /confirm-recheck-mismatch \(버그\)[\s\S]*order \(기능\)/)
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-mirror-empty-'))
    assert.equal(hook('session', empty, {}).stdout, '')
  })
})

// ─────────────────────────────── 추적 ───────────────────────────────

describe('추적', () => {
  test('기능: 코드에만 있는 번호, 처리 흐름 순서, 메시지', () => {
    const p = project()
    p.write('src/test/OrderPlaceAcceptanceTest.kt', 'fun `R1-2 주문 상품은 1개 이상 20개 이하로 담을 수 있다`() {}\nfun `R1-99 없는 기준`() {}\n')
    p.write('src/main/OrderPlaceService.kt', '// R1-3\nval a = 1\n// R1-2\nval b = "주문 상품은 1개 이상 20개 이하로 담아주세요."\n// R1-77\n')
    const t = trace(p.dir, p.config(), 'order')
    assert.deepEqual(t.rows.find((r) => r.id === 'R1-2').tests, ['src/test/OrderPlaceAcceptanceTest.kt:1'])
    assert.ok(t.orphans.some((o) => o.id === 'R1-99' && o.kind === 'test'))
    assert.ok(t.orphans.some((o) => o.id === 'R1-77' && o.kind === 'code'))
    assert.ok(t.orderIssues.some((o) => /R1-2 가 R1-3 보다 아래/.test(o.message)))
    assert.ok(!t.messages.some((m) => m.id === 'R1-2'))
    assert.ok(t.messages.some((m) => m.id === 'R1-3'))
  })

  test('버그: 기능 기준(R6-21c) 테스트와 버그 이름이 있는 B 테스트를 찾는다', () => {
    const p = project()
    p.write('src/test/OrderPaymentConfirmAcceptanceTest.kt', 'fun `R6-21c 즉시 조회에서 대조 결과가 다르면 502`() {}\nfun `R6-18 대조`() {}\n')
    p.write('src/test/ConfirmRecheckMismatchPropertyTest.kt', `// ${BUG}\nfun \`B3-5 대사 배치는 그대로\`() {}\n`)
    p.write('src/test/OtherTest.kt', 'fun `B3-4 다른 버그`() {}\n')
    p.write('src/main/PaymentConfirmService.kt', '// R6-21\nval x = 1\n')
    const t = trace(p.dir, p.config(), BUG)
    const row = (id) => t.rows.find((r) => r.id === id)
    assert.equal(t.type, 'bugfix')
    assert.ok(row('2.1').tests.some((w) => w.includes('OrderPaymentConfirmAcceptanceTest')))
    assert.deepEqual(row('2.1').issues, [])
    assert.ok(row('3.1').tests.length > 0)
    assert.ok(row('3.5').tests.some((w) => w.includes('ConfirmRecheckMismatchPropertyTest')))
    assert.deepEqual(row('3.4').issues, ['보존 테스트 없음'])
  })
})

// ─────────────────────────────── CLI ───────────────────────────────

describe('CLI', () => {
  test('check 는 오류가 있으면 종료 코드 1', () => {
    const p = project()
    assert.equal(cli(p.dir, 'check').status, 0)
    edit(p.file(BUG, 'bugfix.md'), '   - 재현: 주문 금액', '   - 조건: 주문 금액')
    const r = cli(p.dir, 'check', BUG)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /BUG006/)
  })

  test('scaffold 는 종류가 다른 단계를 거절하고 기존 파일을 덮어쓰지 않는다', () => {
    const p = project()
    assert.equal(cli(p.dir, 'scaffold', 'order', 'bugfix').status, 1)
    assert.equal(cli(p.dir, 'scaffold', BUG, 'requirements').status, 1)
    const before = fs.readFileSync(p.file('order', 'tasks.md'), 'utf8')
    cli(p.dir, 'scaffold', 'order', 'tasks')
    assert.equal(fs.readFileSync(p.file('order', 'tasks.md'), 'utf8'), before)
    assert.equal(cli(p.dir, 'scaffold', 'Bad_Name', 'bugfix').status, 2)
  })

  test('approve · status · next 명령', () => {
    const p = project()
    assert.equal(cli(p.dir, 'approve', BUG, 'design').status, 1)
    assert.equal(cli(p.dir, 'approve', BUG, 'bugfix').status, 0)
    const s = JSON.parse(cli(p.dir, 'status', BUG, '--json').stdout)[0]
    assert.equal(s.stages[0].status, 'approved')
    assert.equal(JSON.parse(cli(p.dir, 'next', BUG, '--json').stdout).stage, 'design')
  })

  test('init 은 설정을 만들고 다시 실행해도 덮어쓰지 않는다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-mirror-init-'))
    fs.mkdirSync(path.join(dir, '.git'))
    assert.equal(cli(dir, 'init').status, 0)
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.spec-mirror/config.json'), 'utf8'))
    assert.equal(cfg.specRoot, 'docs/spec')
    assert.match(cli(dir, 'init').stdout, /이미 설정/)
  })

  test('expandRefs', () => {
    assert.deepEqual(expandRefs('1.1 ~ 1.3, 2.4').map(([n, m]) => `${n}.${m}`), ['1.1', '1.2', '1.3', '2.4'])
  })
})

// ─────────────────────────────── 기능 사이 참조 ───────────────────────────────

describe('기능 사이 참조 (REQ018)', () => {
  function withOther(ref) {
    const p = project()
    fs.cpSync(path.join(EXAMPLES, 'order', 'requirements.md'), p.file('settlement', 'requirements.md'))
    edit(p.file('settlement', 'requirements.md'), '   - 주문: 7.1에 따라 결제 완료', `   - 주문: ${ref}에 따라 결제 완료`)
    return p.check('settlement')
  }
  test('있는 기준은 통과', () => assert.equal(errorsOf(withOther('order 7.1'), 'REQ018').length, 0))
  test('없는 기준은 오류', () => assert.ok(errorsOf(withOther('order 7.9'), 'REQ018').length > 0))
  test('다른 기능 참조는 같은 문서 참조로 보지 않는다', () => assert.equal(errorsOf(withOther('order 9.5'), 'REQ016').length, 0))
})

// ─────────────────────────────── 명세 지도 ───────────────────────────────

describe('명세 지도', () => {
  const mapFile = (p) => path.join(p.dir, 'docs/spec/README.md')
  const mapCheck = (p) => checkMap(p.dir, p.config()).report

  test('정답 예제(examples/README.md): 오류 0, 경고 0', () => {
    const r = mapCheck(project({ map: true }))
    assert.deepEqual(r.issues.filter((i) => i.severity !== 'info'), [], fmt(r.issues))
  })

  const cases = [
    ['MAP000', '자리표시자', '- 결제 완료 주문의 취소', '- <범위 밖> 결제 완료 주문의 취소'],
    ['MAP001', '첫 줄 제목', '# Spec Map', '# 명세 목록'],
    ['MAP001', '섹션 누락', '## Out of Scope', '## 제외'],
    ['MAP002', '표 열', '| 순서 | 기능 | 범위 | 진입점 | 관련 기능 |', '| 순서 | 기능 | 범위 | 관련 기능 |'],
    ['MAP003', '기능 링크 형식', '| 1 | [order](order/) |', '| 1 | order |'],
    ['MAP003', '순서 건너뜀', '| 1 | [order](order/) |', '| 2 | [order](order/) |'],
    ['MAP004', '없는 관련 기능', '기한 만료 배치 | — |', '기한 만료 배치 | payment |'],
  ]
  for (const [rule, label, from, to] of cases) {
    test(`${rule} ${label}`, () => {
      const p = project({ map: true })
      edit(mapFile(p), from, to)
      assert.ok(mapCheck(p).errors.some((i) => i.rule === rule), fmt(mapCheck(p).issues))
    })
  }

  test('MAP003 버그 명세를 지도에 적으면 오류', () => {
    const p = project({ map: true })
    edit(mapFile(p), '| 1 | [order](order/) |', `| 2 | [${BUG}](${BUG}/) | 버그 | 없음 | — |\n| 1 | [order](order/) |`)
    assert.ok(mapCheck(p).errors.some((i) => i.rule === 'MAP003' && i.message.includes('버그 명세')))
  })

  test('MAP005 지도에 없는 기능 명세는 경고', () => {
    const p = project({ map: true })
    fs.cpSync(path.join(EXAMPLES, 'order', 'requirements.md'), p.file('settlement', 'requirements.md'))
    assert.ok(mapCheck(p).warnings.some((i) => i.rule === 'MAP005' && i.message.includes('settlement')))
  })

  test('check 는 지도를 함께 검사하고, map 명령은 기능별 상태를 보여 준다', () => {
    const p = project({ map: true })
    const r = cli(p.dir, 'check')
    assert.equal(r.status, 0)
    assert.match(r.stdout, /README\.md \(명세 지도\)/)
    const m = JSON.parse(cli(p.dir, 'map', '--json').stdout)
    assert.equal(m.rows[0].name, 'order')
    assert.equal(m.rows[0].action, 'approve')
  })

  test('scaffold map 은 템플릿을 만들고 자리표시자는 MAP000', () => {
    const p = project({ only: [] })
    assert.equal(cli(p.dir, 'scaffold', 'map').status, 0)
    assert.ok(mapCheck(p).errors.some((i) => i.rule === 'MAP000'))
  })

  test('훅: 지도 저장 시 오류면 막고, 단계 잠금은 하지 않는다', () => {
    const p = project({ map: true })
    const pre = hook('pre', p.dir, { tool_name: 'Write', tool_input: { file_path: mapFile(p) } })
    assert.equal(pre.stdout, '')
    edit(mapFile(p), '# Spec Map', '# 지도')
    const post = hook('post', p.dir, { tool_name: 'Write', tool_input: { file_path: mapFile(p) } })
    assert.equal(post.status, 2)
    assert.match(post.stderr, /MAP001/)
  })
})

// ─────────────────────────────── adopt ───────────────────────────────

describe('adopt (기존 코드에서 명세 만들기)', () => {
  test('scaffold --adopt 는 표시를 남기고, next · status 가 mode 를 알려 준다', () => {
    const p = project({ only: [] })
    const r = cli(p.dir, 'scaffold', 'payment-confirm', 'requirements', '--adopt')
    assert.equal(r.status, 0)
    assert.match(r.stdout, /adopt/)
    assert.equal(next(p.dir, p.config(), 'payment-confirm').mode, 'adopt')
    assert.equal(JSON.parse(cli(p.dir, 'status', 'payment-confirm', '--json').stdout)[0].mode, 'adopt')
    const q = project()
    assert.equal(next(q.dir, q.config(), 'order').mode, 'new')
  })

  test('adopt 명세의 tasks 골격은 도입 작업 템플릿이다', () => {
    const p = project({ only: [] })
    fs.cpSync(path.join(EXAMPLES, 'order'), path.join(p.dir, 'docs/spec/legacy'), { recursive: true })
    fs.rmSync(p.file('legacy', 'tasks.md'))
    cli(p.dir, 'scaffold', 'legacy', 'requirements', '--adopt')
    cli(p.dir, 'scaffold', 'legacy', 'tasks')
    const text = fs.readFileSync(p.file('legacy', 'tasks.md'), 'utf8')
    assert.match(text, /기존 테스트 정리/)
    assert.match(text, /코드의 동작은 바꾸지 않습니다/)
  })

  test('승인해도 adopt 표시가 남는다', () => {
    const p = project()
    cli(p.dir, 'scaffold', 'order', 'requirements', '--adopt')
    assert.equal(approve(p.dir, p.config(), 'order', 'requirements', 't').ok, true)
    assert.equal(next(p.dir, p.config(), 'order').mode, 'adopt')
    assert.equal(stageStatus(path.join(p.dir, 'docs/spec/order'), 'feature', 'requirements').status, 'approved')
  })

  test('--adopt 는 버그 명세에 쓸 수 없다', () => {
    const p = project()
    assert.equal(cli(p.dir, 'scaffold', BUG, 'bugfix', '--adopt').status, 2)
  })
})
