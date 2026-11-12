// requirements.md (기능 명세 1단계)

import fs from 'node:fs'
import path from 'node:path'
import { readText, maskFences, maskInlineCode, sectionLines, h2List, rel } from './util.mjs'
import { refExists, expandRefs } from './refs.mjs'
import { labelSet, checkItems, checkLanguage, glossaryTerms } from './language.mjs'

export const REQUIREMENT_SECTIONS = ['Introduction', 'Glossary', 'Requirements', 'Open Questions']
/** 한국어 틀의 제목 → 영어 틀의 이름. 두 틀을 모두 받고, 읽을 때 영어 이름으로 맞춘다 */
export const KO_SECTIONS = { 개요: 'Introduction', 용어: 'Glossary', '기능별 요구사항': 'Requirements', '확인이 필요한 사항': 'Open Questions' }
const SECTION_KO = Object.fromEntries(Object.entries(KO_SECTIONS).map(([ko, en]) => [en, ko]))
/** 오류 메시지용: "## Open Questions"(또는 "## 확인이 필요한 사항") */
export const sectionLabel = (en) => `"## ${en}"(또는 "## ${SECTION_KO[en]}")`

/** 한국어 제목 줄을 영어 틀 이름으로 바꾼다. → [줄, 'ko' | 'en' | null] */
function normalizeHeading(line) {
  let m
  if ((m = line.match(/^## (.+?)\s*$/))) {
    if (KO_SECTIONS[m[1]]) return [`## ${KO_SECTIONS[m[1]]}`, 'ko']
    return [line, REQUIREMENT_SECTIONS.includes(m[1]) ? 'en' : null]
  }
  if ((m = line.match(/^### 요구사항 (\d+):(.*)$/))) return [`### Requirement ${m[1]}:${m[2]}`, 'ko']
  if (/^### Requirement \d+:/.test(line)) return [line, 'en']
  if (/^#### 인수 조건\s*$/.test(line)) return ['#### Acceptance Criteria', 'ko']
  if (/^#### Acceptance Criteria\s*$/.test(line)) return [line, 'en']
  return [line, null]
}

const TITLE_RE = /^# (Requirements Document|요구사항)\s*$/
const STORY_RE = /^\*\*(User Story|사용자 이야기):\*\*/
const STORY_EN_RE = /^\*\*User Story:\*\* As an? .+, I want to .+, so that .+/
const STORY_KO_RE = /^\*\*사용자 이야기:\*\*\s*\S.*싶다\.\s*\S.*위해서(다|입니다)\.?\s*$/
export const CRITERIA_GROUPS = ['처리 흐름', '항상 지켜야 할 규칙']
export const FLOW = CRITERIA_GROUPS[0]
export const RULES = CRITERIA_GROUPS[1]
/** 처리 흐름 기준의 색 표시: "🟠 **…**" (Cockburn 의 단계 종류) */
export const STEP_ICONS = { '🟢': '기능 흐름 (요청 · 동작 · 응답)', '🟠': '검증', '🟣': '외부 요청' }
/** 문서 맨 위(제목과 Introduction 사이)에 두는 한 줄 범례 */
export const STEP_LEGEND = `| ${Object.entries(STEP_ICONS).map(([i, n]) => `${i} ${n}`).join(' | ')} |\n|${'---|'.repeat(Object.keys(STEP_ICONS).length)}`
const STEP_ICON_LIST = Object.keys(STEP_ICONS).join(' ')
const STEP_MARK_RE = /^(\p{Extended_Pictographic}\uFE0F?)\s*(`[^`]+`\s*)?(?=\*\*)/u

/** Glossary 줄 묶음: "- **용어**: 정의" 와 그 아래 들여쓴 "  - 하위 항목" */
export function parseGlossary(masked, section = 'Glossary') {
  const out = []
  let current = null
  masked.forEach((line, i) => {
    const h = line.match(/^## (.+?)\s*$/)
    if (h) { current = h[1]; return }
    if (current !== section) return
    let m
    if ((m = line.match(/^- (.*)$/))) out.push({ line: i + 1, text: m[1], children: [] })
    else if ((m = line.match(/^\s+- (.*)$/)) && out.length) out.at(-1).children.push({ line: i + 1, text: m[1] })
  })
  return out
}

export function parseRequirements(file) {
  const raw = readText(file).split('\n')
  const frames = { ko: 0, en: 0 }
  const lines = maskFences(raw).map((line, i) => {
    if (i === 0) { if (/^# 요구사항\s*$/.test(line)) frames.ko++; else if (/^# Requirements Document\s*$/.test(line)) frames.en++; return line }
    const [out, frame] = normalizeHeading(line)
    if (frame) frames[frame]++
    if (/^\*\*사용자 이야기:\*\*/.test(line)) frames.ko++
    if (/^\*\*User Story:\*\*/.test(line)) frames.en++
    return out
  })
  const doc = { file, kind: 'requirements', raw, lines, frames, sections: h2List(lines), requirements: [] }
  doc.glossary = parseGlossary(lines)

  let section = null
  let req = null
  let group = null
  let crit = null
  lines.forEach((line, i) => {
    const ln = i + 1
    let m
    if ((m = line.match(/^## (.+?)\s*$/))) { section = m[1]; req = null; group = null; crit = null; return }
    if (section !== 'Requirements') return
    if ((m = line.match(/^### Requirement (\d+):\s*(.*)$/))) {
      req = { number: Number(m[1]), title: m[2].trim(), line: ln, userStory: null, hasAC: false, groups: [], criteria: [], badHeadings: [] }
      doc.requirements.push(req)
      group = null; crit = null
      return
    }
    if (!req) return
    if (/^#{3,4} /.test(line) && !/^#### Acceptance Criteria\s*$/.test(line)) { req.badHeadings.push({ line: ln, text: line }); return }
    if (STORY_RE.test(line)) { req.userStory = { line: ln, text: line }; return }
    if (/^#### Acceptance Criteria\s*$/.test(line)) { req.hasAC = true; return }
    if ((m = line.match(/^##### (.+?)\s*$/))) { group = m[1]; req.groups.push({ name: group, line: ln }); crit = null; return }
    if ((m = line.match(/^(\d+)\.\s+(.*)$/))) {
      const mark = m[2].match(STEP_MARK_RE)
      const step = mark ? { icon: mark[1], label: mark[2]?.trim() ?? null } : null
      crit = { number: Number(m[1]), text: mark ? m[2].slice(mark[0].length) : m[2], step, line: ln, group, items: [] }
      req.criteria.push(crit)
      return
    }
    if (crit && (m = line.match(/^ {2,5}- (.*)$/))) crit.items.push({ line: ln, text: m[1] })
  })
  for (const r of doc.requirements) {
    for (const c of r.criteria) c.rule = c.text.match(/^\*\*(.+?)\*\*/)?.[1] ?? null
  }
  doc.terms = glossaryTerms(doc.glossary)
  return doc
}

/** loadFeature(name) 이 있으면 "<기능> N.M" 참조를 그 기능 명세에서 확인한다. */
export function checkRequirements(file, root, config, report, { loadFeature } = {}) {
  const doc = parseRequirements(file)
  const f = rel(root, file)

  // REQ001 제목 · 섹션 구성과 순서
  if (!TITLE_RE.test(doc.raw[0] || '')) report.error('REQ001', f, 1, '첫 줄은 "# 요구사항" 또는 "# Requirements Document" 여야 합니다.')
  if (doc.frames.ko && doc.frames.en) report.warn('REQ021', f, 1, '한국어 틀(요구사항 · 개요 · 사용자 이야기 …)과 영어 틀(Requirements Document · Introduction · User Story …)이 섞여 있습니다. 한쪽으로 맞춥니다.')
  const names = doc.sections.map((s) => s.name)
  REQUIREMENT_SECTIONS.forEach((s) => { if (!names.includes(s)) report.error('REQ001', f, 1, `${sectionLabel(s)} 섹션이 없습니다.`) })
  const known = names.filter((n) => REQUIREMENT_SECTIONS.includes(n))
  if (known.join('|') !== REQUIREMENT_SECTIONS.filter((n) => known.includes(n)).join('|')) {
    report.error('REQ001', f, 1, `섹션 순서가 다릅니다. 기대: ${REQUIREMENT_SECTIONS.join(' → ')}, 실제: ${known.join(' → ')}`)
  }
  doc.sections.filter((s) => !REQUIREMENT_SECTIONS.includes(s.name)).forEach((s) => report.error('REQ001', f, s.line, `허용되지 않은 섹션 "## ${s.name}" 입니다.`))

  // REQ017 Glossary 형식
  for (const g of doc.glossary) {
    if (!/^\*\*[^*]+\*\*/.test(g.text)) report.warn('REQ017', f, g.line, 'Glossary 항목은 "**도메인 용어 (English)**: 정의" 형식으로 씁니다.')
    for (const ch of g.children) {
      // 상태를 정의하는 줄만 본다. 상태 묶음에 대한 설명 줄(예: "결제 대기 외에는 모두 종결 상태")은 그대로 둔다
      if (/\(`/.test(ch.text) && !/^.+?\s*\(`[A-Z0-9_]+`\)\s*:/.test(ch.text)) {
        report.warn('REQ017', f, ch.line, '상태는 "한글 상태명 (`ENUM_VALUE`): 의미" 형식으로 씁니다.')
      }
    }
  }

  // REQ002 Requirement 번호
  doc.requirements.forEach((r, idx) => {
    if (r.number !== idx + 1) report.error('REQ002', f, r.line, `Requirement 번호가 연속되지 않습니다. 기대 ${idx + 1}, 실제 ${r.number}`)
  })
  if (names.includes('Requirements') && doc.requirements.length === 0) report.error('REQ002', f, 1, '"### 요구사항 N: <기능 이름>" (또는 "### Requirement N:") 이 하나도 없습니다.')

  const labels = labelSet({ glossaries: [doc.glossary], config })
  const ids = { label: 'REQ008', error: 'REQ010', response: 'REQ011', message: 'REQ012' }

  for (const r of doc.requirements) {
    const where = `Requirement ${r.number}`
    // REQ003 User Story
    if (!r.userStory) report.error('REQ003', f, r.line, `${where}: "**사용자 이야기:** <누가>는 <무엇을> 하고 싶다. <왜> 위해서다." 가 없습니다.`)
    else if (!STORY_EN_RE.test(r.userStory.text) && !STORY_KO_RE.test(r.userStory.text)) {
      report.error('REQ003', f, r.userStory.line, `${where}: 사용자 이야기는 "<누가>는 <무엇을> 하고 싶다. <왜> 위해서다." 형식으로 씁니다. (영어 틀: "As a <역할>, I want to <행동>, so that <가치>")`)
    }
    // REQ004 Acceptance Criteria
    if (!r.hasAC) report.error('REQ004', f, r.line, `${where}: "#### 인수 조건" (또는 "#### Acceptance Criteria") 이 없습니다.`)
    r.badHeadings.forEach((h) => report.error('REQ005', f, h.line, `${where}: 허용되지 않은 제목입니다: ${h.text}`))

    // REQ005 처리 흐름 → 항상 지켜야 할 규칙
    const groupNames = r.groups.map((g) => g.name)
    r.groups.forEach((g) => {
      if (!CRITERIA_GROUPS.includes(g.name)) report.error('REQ005', f, g.line, `${where}: 기준 묶음은 "##### ${FLOW}" 과 "##### ${RULES}" 만 씁니다. (실제: ${g.name})`)
    })
    if (r.hasAC && groupNames.length === 0) report.error('REQ005', f, r.line, `${where}: "##### ${FLOW}" 또는 "##### ${RULES}" 이 없습니다.`)
    if (groupNames.includes(RULES) && groupNames.includes(FLOW) && groupNames.indexOf(FLOW) > groupNames.indexOf(RULES)) {
      report.error('REQ005', f, r.groups[0].line, `${where}: "${FLOW}" 이 "${RULES}" 보다 먼저 와야 합니다.`)
    }
    if (new Set(groupNames).size !== groupNames.length) report.error('REQ005', f, r.line, `${where}: 같은 기준 묶음이 두 번 나옵니다.`)

    // REQ006 기준 번호 (두 묶음에 걸쳐 1부터 연속)
    r.criteria.forEach((c, idx) => {
      if (c.number !== idx + 1) report.error('REQ006', f, c.line, `${where}: 기준 번호가 연속되지 않습니다. 기대 ${idx + 1}, 실제 ${c.number} (처리 흐름과 항상 지켜야 할 규칙은 이어서 번호를 매깁니다)`)
      if (!c.group) report.error('REQ006', f, c.line, `${where}.${c.number}: 기준이 "${FLOW}" / "${RULES}" 묶음 밖에 있습니다.`)
    })
    if (r.hasAC && r.criteria.length === 0) report.error('REQ006', f, r.line, `${where}: 기준이 하나도 없습니다.`)

    for (const c of r.criteria) {
      const id = `${r.number}.${c.number}`
      // REQ007 굵은 규칙 한 줄
      if (!c.rule) report.error('REQ007', f, c.line, `${id}: 첫 줄은 굵은 글씨의 비즈니스 규칙(**...**)으로 시작해야 합니다.`)
      // REQ008 · REQ010 · REQ011 · REQ012 세부 항목
      checkItems({ items: c.items, id, labels, file: f, report, ids, config })
      // REQ019 처리 흐름 기준에는 색 표시, 항상 지켜야 할 규칙에는 표시 없음
      checkStepMark(c, id, f, report)
    }
  }

  checkLegend(doc, f, report)

  // REQ013 금지 표현 · REQ014 기술 용어 · REQ015 코드 식별자 (Glossary · Requirements 본문)
  checkLanguage({ lines: sectionLines(doc.lines, ['Glossary', 'Requirements']), file: f, report, ids: { forbidden: 'REQ013', tech: 'REQ014', ident: 'REQ015' } })

  // REQ016 참조 (N.M, Requirement N). REQ018 다른 기능 명세 참조 (<기능> N.M)
  const self = path.basename(path.dirname(file))
  for (const { line, ln } of sectionLines(doc.lines, ['Requirements', 'Open Questions'])) {
    let text = maskInlineCode(line).replace(/\d{1,3}(,\d{3})+/g, '#')
    // "<기능> N.M" 은 다른 기능 명세의 기준이다. 확인한 뒤 같은 문서 참조 검사에서 뺀다
    text = text.replace(/\b([a-z][a-z0-9-]*)\s+(\d+\.\d+(?:\s*~\s*\d+\.\d+)?(?:\s*,\s*\d+\.\d+)*)/g, (all, name, refs) => {
      if (name === self || !loadFeature || !fs.existsSync(path.join(root, config.specRoot, name))) return all
      const other = loadFeature(name)
      if (!other) report.error('REQ018', f, ln, `참조한 기능 명세 "${name}" 에 requirements.md 가 없습니다.`)
      else for (const [n, k] of expandRefs(refs)) {
        if (!refExists(other, n, k)) report.error('REQ018', f, ln, `참조 ${name} ${n}.${k} 이(가) ${name} requirements 에 없습니다.`)
      }
      return ' '.repeat(all.length)
    })
    const re = /(?<![\d.,#])(\d+)\.(\d+)(?![\d.,%])/g
    let m
    while ((m = re.exec(text))) {
      const n = Number(m[1]); const k = Number(m[2])
      if (k === 0) continue
      if (n >= 1 && n <= doc.requirements.length) {
        if (!refExists(doc, n, k)) report.error('REQ016', f, ln, `참조 ${n}.${k} 가 없습니다. (Requirement ${n} 의 기준은 ${doc.requirements[n - 1].criteria.length}개)`)
      } else if (n <= 99 && /에 따라|참조|참고/.test(text.slice(m.index, m.index + 12))) {
        report.error('REQ016', f, ln, `참조 ${n}.${k} 의 Requirement ${n} 이 없습니다.`)
      }
    }
    if (/^### Requirement/.test(line)) continue
    const rr = /(?:Requirement|요구사항) (\d+)(?!\.\d)/g
    while ((m = rr.exec(text))) {
      const n = Number(m[1])
      if (n < 1 || n > doc.requirements.length) report.error('REQ016', f, ln, `참조한 Requirement ${n} 이 없습니다.`)
    }
  }
  return doc
}

function checkStepMark(c, id, f, report) {
  const st = c.step
  if (c.group === RULES) {
    if (st) report.error('REQ019', f, c.line, `${id}: 항상 지켜야 할 규칙에는 색 표시를 붙이지 않습니다.`)
    return
  }
  if (c.group !== FLOW) return
  if (!st) { report.error('REQ019', f, c.line, `${id}: 처리 흐름 기준 맨 앞에 색을 표시합니다: ${STEP_ICON_LIST}`); return }
  if (!(st.icon in STEP_ICONS)) report.error('REQ019', f, c.line, `${id}: 표시 ${st.icon} 는 없습니다. ${STEP_ICON_LIST} 중 하나입니다.`)
  if (st.label) report.error('REQ019', f, c.line, `${id}: 색 뒤에 종류 글자(${st.label})를 쓰지 않습니다. 뜻은 문서 맨 위 범례에 있습니다.`)
}

/** REQ020 처리 흐름이 있으면 "## Requirements" 바로 아래(첫 Requirement 앞)에 색 범례 한 줄 */
function checkLegend(doc, f, report) {
  if (!doc.requirements.some((r) => r.criteria.some((c) => c.group === FLOW))) return
  const start = doc.sections.find((s) => s.name === 'Requirements')?.line
  if (!start) return
  const end = doc.requirements[0]?.line ?? doc.lines.length + 1
  const head = doc.raw.slice(start, end - 1).join('\n')
  const missing = Object.keys(STEP_ICONS).filter((i) => !new RegExp(`\\|\\s*${i}`, 'u').test(head))
  if (missing.length) report.warn('REQ020', f, start, `${sectionLabel('Requirements')} 바로 아래(첫 요구사항 앞)에 색 범례 표를 둡니다: ${STEP_LEGEND.split('\n')[0]}`)
}
