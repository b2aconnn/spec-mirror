// 도메인 언어 검사: requirements.md 와 bugfix.md 가 함께 쓴다

import { maskInlineCode, maskQuotes } from './util.mjs'

export const BASE_ITEM_LABELS = [
  '요청 정보', '시점', '조건', '판단', '경계', '에러', '메시지', '응답', '로그', '이유', '예', '형식', '요약',
]
export const BUGFIX_ITEM_LABELS = ['재현', '명세']

export const FORBIDDEN_PHRASES = ['예외 처리', '적절한', '필요 시', '등을 처리', '검증해야 한다', '에러 응답']

export const TECH_TERMS = [
  { re: /\b(GET|POST|PUT|PATCH|DELETE)\s+\//, label: 'HTTP 메서드 + 경로' },
  { re: /(^|[\s(`])\/api\//, label: 'API 경로' },
  { re: /https?:\/\//, label: 'URL' },
  { re: /트랜잭션/, label: '트랜잭션' },
  { re: /조건부\s*UPDATE|\bUPDATE\b|\bINSERT\b|\bSELECT\b|\bDELETE FROM\b/, label: 'SQL' },
  { re: /테이블|컬럼|인덱스/, label: '저장소 구조' },
  { re: /컨트롤러|클래스|엔티티|레포지토리|Repository|Controller|Service\b/, label: '코드 구조' },
  { re: /비동기|메시지\s*큐|\bKafka\b|\bRabbitMQ\b|\bSQS\b|\bRedis\b/, label: '처리 방식·인프라' },
]

const IDENTIFIER_RE = /\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+\b|\b[a-z]+(?:[A-Z][a-z0-9]+)+\(\)/

/** Glossary 항목 "**용어 (English)**: 정의" 에서 용어를 뽑는다. "**A / B**" 는 둘로 나눈다. */
export function glossaryTerms(glossary) {
  return glossary
    .map((g) => g.text.match(/^\*\*([^*]+?)\*\*/))
    .filter(Boolean)
    .flatMap((m) => m[1].replace(/\s*\([^)]*\)\s*$/, '').split('/'))
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Glossary 본문에 나오는 영문 대문자 약어 (예: PG) */
export function glossaryAcronyms(glossary) {
  const text = glossary.flatMap((g) => [g.text, ...g.children.map((c) => c.text)]).join('\n')
  return [...new Set(maskInlineCode(text).match(/\b[A-Z][A-Z0-9]{1,9}\b/g) || [])]
}

export function labelSet({ glossaries = [], config, extra = [] }) {
  const set = new Set([...BASE_ITEM_LABELS, ...extra, ...(config.extraItemLabels || [])])
  for (const g of glossaries) {
    glossaryTerms(g).forEach((t) => set.add(t))
    glossaryAcronyms(g).forEach((t) => set.add(t))
  }
  return set
}

/** 세부 항목 "<이름>: <내용>" 을 { label, value } 로. 이름이 없는 줄은 보충 설명이므로 null. */
export function parseItem(text) {
  const m = text.match(/^([^:：`"→]{1,20}?)\s*[:：]\s*(.*)$/)
  return m ? { label: m[1].trim(), value: m[2] } : null
}

/**
 * 기준(항목) 하나의 세부 항목을 검사한다.
 * ids: { label, error, response, message }
 */
export function checkItems({ items, id, labels, file, report, ids, config }) {
  for (const it of items) {
    const p = parseItem(it.text)
    if (!p) continue
    const { label, value } = p
    if (!labels.has(label)) {
      report.warn(ids.label, file, it.line, `${id}: 허용되지 않은 항목 이름 "${label}". 허용: ${[...BASE_ITEM_LABELS, ...(ids.extraLabels || [])].join(', ')}, Glossary 용어·약어${config.extraItemLabels?.length ? ', extraItemLabels' : ''}`)
    }
    if (label === '에러' && !/^`[^`]+`\s+`[A-Z][A-Z0-9_]*`/.test(value)) {
      report.error(ids.error, file, it.line, `${id}: 에러 항목은 \`<상태>\` \`<에러 코드>\` 형식으로 씁니다. (예: \`400\` \`INVALID_ORDER_QUANTITY\`)`)
    }
    if (label === '응답' && !/`[^`]+`/.test(value)) {
      report.warn(ids.response, file, it.line, `${id}: 응답 항목에 \`<상태>\` 가 없습니다. (예: \`200\` — 주문 정보)`)
    }
    if (label === '메시지' && !/"[^"]+"|그대로/.test(value)) {
      report.warn(ids.message, file, it.line, `${id}: 메시지는 큰따옴표로 쓰거나, 외부 문구면 출처를 씁니다. (예: PG가 준 거절 사유 그대로)`)
    }
  }
  const has = (name) => items.some((it) => parseItem(it.text)?.label === name)
  if (has('에러') && !has('메시지')) report.warn(ids.message, file, items.find((it) => parseItem(it.text)?.label === '에러').line, `${id}: 에러 항목이 있으면 회원에게 보여줄 메시지도 씁니다.`)
}

/**
 * 금지 표현 · 기술 용어 · 코드 식별자.
 * 큰따옴표 문구(회원에게 보이는 안내 문구)는 검사하지 않는다.
 * 기술 용어는 인라인 코드 안도 검사한다 (`POST /api/orders` 도 기술 용어다).
 * ids: { forbidden, tech, ident }
 */
export function checkLanguage({ lines, file, report, ids }) {
  for (const { line, ln } of lines) {
    const quoted = maskQuotes(line)
    const text = maskInlineCode(quoted)
    for (const p of FORBIDDEN_PHRASES) {
      if (text.includes(p)) report.error(ids.forbidden, file, ln, `금지 표현 "${p}" — 결과를 말하는 비즈니스 문장으로 바꿉니다.`)
    }
    for (const t of TECH_TERMS) {
      if (t.re.test(quoted)) report.error(ids.tech, file, ln, `기술 용어(${t.label})는 쓰지 않습니다. 구현 정보는 design 에 둡니다.`)
    }
    const im = text.match(IDENTIFIER_RE)
    if (im) report.warn(ids.ident, file, ln, `코드 식별자로 보이는 "${im[0]}" — 도메인 용어로 바꾸고 코드 대응은 design 에 둡니다.`)
  }
}
