// 버그 명세: bugfix.md (1단계) · design.md (2단계) · tasks.md 구조 (3단계)

import fs from 'node:fs'
import path from 'node:path'
import { readText, maskFences, maskInlineCode, fenceBlocks, sectionLines, h2List, rel } from './util.mjs'
import { expandRefs, refExists } from './refs.mjs'
import { labelSet, checkItems, checkLanguage, parseItem, BUGFIX_ITEM_LABELS } from './language.mjs'
import { parseProperties, checkProperties, PROPERTY_PREAMBLE } from './design.mjs'
import { parseTasks, waveOf } from './tasks.mjs'

export const BUGFIX_SECTIONS = ['Introduction', 'Bug Analysis', 'Open Questions']
export const BUG_GROUPS = [
  { number: 1, heading: 'Current Behavior (Defect)', label: '현재 동작' },
  { number: 2, heading: 'Expected Behavior (Correct)', label: '기대 동작' },
  { number: 3, heading: 'Unchanged Behavior (Regression Prevention)', label: '유지할 동작' },
]
export const KEEP_WORD = '지금처럼'

export const BUGFIX_DESIGN_SECTIONS = [
  'Overview', 'Glossary', 'Bug Details', 'Expected Behavior', 'Hypothesized Root Cause',
  'Correctness Properties', 'Fix Implementation', 'Testing Strategy',
]
const BUGFIX_DESIGN_SUBSECTIONS = {
  'Bug Details': ['Bug Condition', 'Examples'],
  'Expected Behavior': ['Preservation Requirements'],
  'Fix Implementation': ['Changes Required'],
  'Testing Strategy': ['Validation Approach', 'Exploratory Bug Condition Checking', 'Fix Checking', 'Preservation Checking'],
}
export const PROPERTY_KINDS = { bug: 'Bug Condition', keep: 'Preservation' }

export const BUGFIX_TASK_FLOW = [
  { key: 'explore', prefix: '버그 조건 탐색 테스트', label: '버그 조건 탐색 테스트 작성' },
  { key: 'preserve', prefix: '보존 테스트', label: '보존 테스트 작성' },
  { key: 'fix', prefix: '버그 수정', label: '버그 수정: <무엇을 고치는지>' },
  { key: 'spec', prefix: '명세 반영', label: '명세 반영' },
  { key: 'checkpoint', prefix: 'Checkpoint', label: 'Checkpoint - <확인할 범위>' },
]

// ─────────────────────────────── bugfix.md ───────────────────────────────

/** "명세:" 값을 해석한다. → { kind: 'none' | 'new' | 'refs' | 'invalid', refs: [{ feature, n, m, raw }] } */
export function parseSpecLink(value) {
  const v = value.trim()
  if (/^없음(?![가-힣A-Za-z0-9])/.test(v)) return { kind: 'none', refs: [] }
  if (/^새 기준(?![가-힣A-Za-z0-9])/.test(v)) {
    const feature = v.match(/\(([a-z0-9][a-z0-9-]*)\b/)?.[1] || null
    return { kind: 'new', feature, refs: [] }
  }
  const refs = []
  const re = /([a-z0-9][a-z0-9-]*)\s+(\d+\.\d+(?:\s*~\s*\d+\.\d+)?(?:\s*,\s*\d+\.\d+(?:\s*~\s*\d+\.\d+)?)*)/g
  let m
  while ((m = re.exec(v))) for (const [n, k, raw] of expandRefs(m[2])) refs.push({ feature: m[1], n, m: k, raw: `${m[1]} ${raw}` })
  return refs.length ? { kind: 'refs', refs } : { kind: 'invalid', refs: [] }
}

export function parseBugfix(file) {
  const raw = readText(file).split('\n')
  const lines = maskFences(raw)
  const doc = { file, kind: 'bugfix', raw, lines, sections: h2List(lines), h3: [], badHeadings: [], stray: [], requirements: BUG_GROUPS.map((g) => ({ number: g.number, title: g.heading, line: null, criteria: [] })) }
  let section = null
  let group = null
  let item = null
  lines.forEach((line, i) => {
    const ln = i + 1
    let m
    if ((m = line.match(/^## (.+?)\s*$/))) { section = m[1]; group = null; item = null; return }
    if (section !== 'Bug Analysis') return
    if ((m = line.match(/^### (.+?)\s*$/))) {
      doc.h3.push({ name: m[1], line: ln })
      group = BUG_GROUPS.find((g) => g.heading === m[1]) || null
      if (group) doc.requirements[group.number - 1].line = ln
      item = null
      return
    }
    if (/^#{4,} /.test(line)) { doc.badHeadings.push({ line: ln, text: line }); return }
    if ((m = line.match(/^(\d+)\.(\d+)\s+(.*)$/))) {
      item = { n: Number(m[1]), number: Number(m[2]), text: m[3], line: ln, group: group?.number ?? null, items: [] }
      item.rule = item.text.match(/^\*\*(.+?)\*\*/)?.[1] ?? null
      if (group) doc.requirements[group.number - 1].criteria.push(item)
      else doc.stray.push(item)
      return
    }
    if (item && (m = line.match(/^ {2,5}- (.*)$/))) item.items.push({ line: ln, text: m[1] })
  })
  // 명세 연결
  doc.links = []
  for (const r of doc.requirements) {
    for (const c of r.criteria) {
      c.specLinks = []
      for (const it of c.items) {
        const p = parseItem(it.text)
        if (p?.label !== '명세') continue
        const link = { ...parseSpecLink(p.value), line: it.line, value: p.value }
        c.specLinks.push(link)
        doc.links.push({ item: `${r.number}.${c.number}`, ...link })
      }
    }
  }
  const linked = new Set(doc.links.flatMap((l) => [...l.refs.map((x) => x.feature), ...(l.feature ? [l.feature] : [])]))
  sectionLines(lines, ['Introduction']).forEach(({ line }) => {
    for (const mm of line.matchAll(/\.\.\/([a-z0-9][a-z0-9-]*)\/requirements\.md/g)) linked.add(mm[1])
  })
  doc.linkedFeatures = [...linked]
  return doc
}

/** loadFeature(name) → 기능의 requirements 문서 (parseRequirements 결과) 또는 null */
export function checkBugfix(file, root, config, report, { loadFeature }) {
  const doc = parseBugfix(file)
  const f = rel(root, file)

  // BUG001 제목 · 섹션
  if (!/^# Bugfix Requirements Document\s*$/.test(doc.raw[0] || '')) report.error('BUG001', f, 1, '첫 줄은 "# Bugfix Requirements Document" 여야 합니다.')
  const names = doc.sections.map((s) => s.name)
  if (names.join('|') !== BUGFIX_SECTIONS.join('|')) report.error('BUG001', f, doc.sections[0]?.line || 1, `섹션은 ${BUGFIX_SECTIONS.map((s) => `"## ${s}"`).join(' → ')} 이어야 합니다. (실제: ${names.join(' → ') || '없음'})`)

  // BUG002 Bug Analysis 하위 제목
  const h3 = doc.h3.map((h) => h.name)
  if (h3.join('|') !== BUG_GROUPS.map((g) => g.heading).join('|')) {
    report.error('BUG002', f, doc.h3[0]?.line || doc.sections.find((s) => s.name === 'Bug Analysis')?.line || 1, `"## Bug Analysis" 아래는 ${BUG_GROUPS.map((g) => `"### ${g.heading}"`).join(' → ')} 이어야 합니다. (실제: ${h3.join(' → ') || '없음'})`)
  }
  doc.badHeadings.forEach((h) => report.error('BUG002', f, h.line, `Bug Analysis 안에는 다른 제목을 쓰지 않습니다: ${h.text}`))

  // BUG003 항목 번호 · BUG004 짝
  doc.stray.forEach((s) => report.error('BUG003', f, s.line, `${s.n}.${s.number}: 항목이 세 묶음(### ${BUG_GROUPS.map((g) => g.label).join(' / ')}) 밖에 있습니다.`))
  for (const r of doc.requirements) {
    const g = BUG_GROUPS[r.number - 1]
    if (r.line && r.criteria.length === 0) report.error('BUG003', f, r.line, `"${g.heading}" 에 항목이 없습니다. "${r.number}.1 **...**" 로 씁니다.`)
    r.criteria.forEach((c, idx) => {
      if (c.n !== r.number) report.error('BUG003', f, c.line, `${c.n}.${c.number}: "${g.heading}" 의 항목 번호는 ${r.number}.M 입니다.`)
      if (c.number !== idx + 1) report.error('BUG003', f, c.line, `${g.label} 항목 번호가 연속되지 않습니다. 기대 ${r.number}.${idx + 1}, 실제 ${c.n}.${c.number}`)
    })
  }
  const [defects, expected, keep] = doc.requirements
  if (defects.criteria.length && expected.criteria.length !== defects.criteria.length) {
    report.error('BUG004', f, expected.line || 1, `기대 동작은 현재 동작과 같은 수여야 합니다. 2.N 은 1.N 을 고친 모습입니다. (현재 ${defects.criteria.length}개, 기대 ${expected.criteria.length}개)`)
  }

  // 링크된 기능의 Glossary 를 항목 이름으로 허용
  const features = new Map(doc.linkedFeatures.map((name) => [name, loadFeature(name)]))
  const labels = labelSet({ glossaries: [...features.values()].filter(Boolean).map((d) => d.glossary), config, extra: BUGFIX_ITEM_LABELS })
  const ids = { label: 'BUG008', error: 'BUG009', response: 'BUG010', message: 'BUG011', extraLabels: BUGFIX_ITEM_LABELS }

  for (const r of doc.requirements) {
    for (const c of r.criteria) {
      const id = `${r.number}.${c.number}`
      // BUG005 굵은 문장
      if (!c.rule) { report.error('BUG005', f, c.line, `${id}: 항목은 굵은 글씨의 한 문장(**...**)으로 시작해야 합니다.`) }
      // BUG007 유지할 동작은 "지금처럼"
      else if (r.number === 3 && !c.rule.includes(KEEP_WORD)) report.error('BUG007', f, c.line, `${id}: 유지할 동작은 "**<조건>이면 ${KEEP_WORD} <기존 동작>.**" 으로 씁니다.`)
      else if (r.number !== 3 && c.rule.includes(KEEP_WORD)) report.warn('BUG007', f, c.line, `${id}: "${KEEP_WORD}" 는 유지할 동작(3.M)에만 씁니다.`)
      // BUG006 현재 동작은 재현 방법
      if (r.number === 1 && !c.items.some((it) => parseItem(it.text)?.label === '재현')) report.error('BUG006', f, c.line, `${id}: 현재 동작에는 "재현: <어떤 요청·상태에서>" 항목이 있어야 합니다.`)
      checkItems({ items: c.items, id, labels, file: f, report, ids, config })

      // BUG015 명세 연결 · BUG016 명세 없음
      if (r.number !== 1 && c.specLinks.length === 0) report.warn('BUG016', f, c.line, `${id}: "명세: <기능> N.M" 으로 이 동작을 정한 기능 명세 기준을 씁니다. 없으면 "명세: 새 기준 (<기능>)" 또는 "명세: 없음".`)
      for (const link of c.specLinks) {
        if (link.kind === 'invalid') { report.error('BUG015', f, link.line, `${id}: 명세는 "<기능> N.M", "새 기준 (<기능>)", "없음" 중 하나로 씁니다. (실제: ${link.value})`); continue }
        if (link.kind === 'new' && link.feature && !features.get(link.feature)) report.error('BUG015', f, link.line, `${id}: 기능 명세 "${link.feature}" 가 없습니다.`)
        for (const ref of link.refs) {
          const feat = features.get(ref.feature)
          if (!feat) report.error('BUG015', f, link.line, `${id}: 기능 명세 "${ref.feature}" 가 없습니다. (${config.specRoot}/${ref.feature}/requirements.md)`)
          else if (!refExists(feat, ref.n, ref.m)) report.error('BUG015', f, link.line, `${id}: ${ref.raw} 기준이 ${ref.feature} requirements 에 없습니다.`)
        }
      }
    }
  }

  // BUG012 금지 표현 · BUG013 기술 용어 · BUG014 코드 식별자 (Bug Analysis 본문)
  checkLanguage({ lines: sectionLines(doc.lines, ['Bug Analysis']), file: f, report, ids: { forbidden: 'BUG012', tech: 'BUG013', ident: 'BUG014' } })

  // BUG017 참조: "<기능> N.M" 은 기능 명세, 숫자만 쓴 N.M 은 이 문서의 항목
  for (const { line, ln } of sectionLines(doc.lines, ['Bug Analysis', 'Open Questions'])) {
    if (/^\s+- 명세\s*[:：]/.test(line)) continue
    const text = maskInlineCode(line).replace(/\d{1,3}(,\d{3})+/g, '#')
    const re = /(?:\b([a-z][a-z0-9-]*)\s+)?(?<![\d.,#])(\d+)\.(\d+)(?![\d.,%])/g
    let m
    while ((m = re.exec(text))) {
      if (m.index === 0 && /^\d+\.\d+\s/.test(text)) continue // 항목 번호 자체
      const n = Number(m[2]); const k = Number(m[3])
      if (m[1] && features.has(m[1])) {
        const feat = features.get(m[1])
        if (feat && !refExists(feat, n, k)) report.error('BUG017', f, ln, `참조 ${m[1]} ${n}.${k} 이(가) ${m[1]} requirements 에 없습니다.`)
      } else if (m[1] && fs.existsSync(path.join(root, config.specRoot, m[1]))) {
        const feat = loadFeature(m[1])
        if (feat && !refExists(feat, n, k)) report.error('BUG017', f, ln, `참조 ${m[1]} ${n}.${k} 이(가) ${m[1]} requirements 에 없습니다.`)
      } else if (n >= 1 && n <= 3 && !refExists(doc, n, k)) {
        report.error('BUG017', f, ln, `참조 ${n}.${k} 이(가) 이 문서에 없습니다. 기능 명세 기준이면 "<기능> ${n}.${k}" 로 씁니다.`)
      }
    }
  }
  return doc
}

// ─────────────────────────────── bugfix design.md ───────────────────────────────

export function parseBugfixDesign(file) {
  const raw = readText(file).split('\n')
  const lines = maskFences(raw)
  const doc = { file, kind: 'bugfix-design', raw, lines, sections: h2List(lines), sub: {}, properties: parseProperties(lines), blocks: fenceBlocks(raw) }
  let section = null
  lines.forEach((line, i) => {
    let m
    if ((m = line.match(/^## (.+?)\s*$/))) { section = m[1]; doc.sub[section] = doc.sub[section] || []; return }
    if (section && (m = line.match(/^### (.+?)\s*$/))) doc.sub[section].push({ name: m[1], line: i + 1 })
  })
  for (const p of doc.properties) {
    const m = p.title.match(/^(Bug Condition|Preservation) - (.+)$/)
    p.kind = m ? (m[1] === PROPERTY_KINDS.bug ? 'bug' : 'keep') : null
    p.refs = p.validates ? expandRefs(p.validates.text).map(([n, k]) => `${n}.${k}`) : []
  }
  return doc
}

export function checkBugfixDesign(file, bug, root, report, { draft = false } = {}) {
  const doc = parseBugfixDesign(file)
  const f = rel(root, file)
  const missing = report.missing(draft)

  // BDS001 제목 · 섹션
  if (!/^# Bugfix Design Document\s*$/.test(doc.raw[0] || '')) report.error('BDS001', f, 1, '첫 줄은 "# Bugfix Design Document" 여야 합니다.')
  const names = doc.sections.map((s) => s.name)
  if (names.join('|') !== BUGFIX_DESIGN_SECTIONS.join('|')) report.error('BDS001', f, doc.sections[0]?.line || 1, `섹션은 ${BUGFIX_DESIGN_SECTIONS.join(' → ')} 이어야 합니다. (실제: ${names.join(' → ') || '없음'})`)

  // BDS002 필수 하위 섹션 (순서 고정)
  for (const [section, subs] of Object.entries(BUGFIX_DESIGN_SUBSECTIONS)) {
    if (!names.includes(section)) continue
    const actual = (doc.sub[section] || []).map((s) => s.name).filter((n) => subs.includes(n))
    if (actual.join('|') !== subs.join('|')) {
      report.error('BDS002', f, doc.sections.find((s) => s.name === section).line, `"## ${section}" 아래에 ${subs.map((s) => `"### ${s}"`).join(' → ')} 이 있어야 합니다. (실제: ${actual.join(' → ') || '없음'})`)
    }
  }

  // BDS003 버그 조건 의사 코드
  const cond = doc.sub['Bug Details']?.find((s) => s.name === 'Bug Condition')
  if (cond) {
    const next = doc.sub['Bug Details'].find((s) => s.line > cond.line)?.line ?? Infinity
    const ok = doc.blocks.some((b) => b.start > cond.line && b.start < next && b.body.some((l) => /FUNCTION isBugCondition\s*\(/.test(l)))
    if (!ok) report.error('BDS003', f, cond.line, '"### Bug Condition" 에 "FUNCTION isBugCondition(input)" 의사 코드 블록이 있어야 합니다.')
  }

  // BDS010 원인
  const rc = doc.sections.find((s) => s.name === 'Hypothesized Root Cause')
  if (rc) {
    const end = doc.sections.find((s) => s.line > rc.line)?.line ?? doc.lines.length + 1
    const causes = doc.lines.slice(rc.line, end - 1).filter((l) => /^\d+\.\s+\*\*.+\*\*/.test(l))
    if (causes.length === 0) report.error('BDS010', f, rc.line, '원인은 "1. **<원인>** (확인됨 | 가설)" 처럼 번호와 굵은 제목으로 씁니다.')
  }

  // BDS004 · BDS005 · BDS006 Correctness Properties
  if (names.includes('Correctness Properties') && !doc.lines.some((l) => PROPERTY_PREAMBLE.test(l))) report.error('BDS004', f, 1, 'Correctness Properties 머리말 (*A property is ...*) 이 없습니다.')
  checkProperties({ properties: doc.properties, refDoc: bug, file: f, report, ids: { format: 'BDS005', ref: 'BDS006' }, refLabel: 'bugfix' })

  // BDS007 종류 · BDS008 검증 범위 · BDS009 포함
  for (const p of doc.properties) {
    if (!p.kind) { report.error('BDS007', f, p.line, `Property ${p.number}: 이름은 "Bug Condition - <이름>" 또는 "Preservation - <이름>" 입니다.`); continue }
    const want = p.kind === 'bug' ? 2 : 3
    const wrong = p.refs.filter((r) => Number(r.split('.')[0]) !== want)
    if (wrong.length) report.error('BDS008', f, p.validates?.line || p.line, `Property ${p.number}: ${p.kind === 'bug' ? 'Bug Condition 은 기대 동작(2.M)' : 'Preservation 은 유지할 동작(3.M)'} 만 검증합니다. (${wrong.join(', ')})`)
  }
  if (bug && names.includes('Correctness Properties')) {
    const covered = { bug: new Set(), keep: new Set() }
    doc.properties.forEach((p) => p.kind && p.refs.forEach((r) => covered[p.kind].add(r)))
    for (const [n, kind] of [[2, 'bug'], [3, 'keep']]) {
      for (const c of bug.requirements[n - 1].criteria) {
        if (!covered[kind].has(`${n}.${c.number}`)) missing('BDS009', f, 1, `${n}.${c.number} 을(를) 검증하는 ${PROPERTY_KINDS[kind]} Property 가 없습니다.`)
      }
    }
    if (!doc.properties.some((p) => p.kind === 'bug')) missing('BDS009', f, 1, 'Bug Condition Property 가 하나도 없습니다.')
    if (!doc.properties.some((p) => p.kind === 'keep')) missing('BDS009', f, 1, 'Preservation Property 가 하나도 없습니다.')
  }
  return doc
}

// ─────────────────────────────── bugfix tasks.md 구조 ───────────────────────────────

/** 공통 tasks 검사(checkTasks) 뒤에 버그 명세 고유의 순서를 검사한다. */
export function checkBugfixTasks(file, design, root, report) {
  const doc = parseTasks(file)
  const f = rel(root, file)
  const tops = doc.tasks.filter((t) => !t.parent)
  const props = design?.properties || []
  const bugProps = props.filter((p) => p.kind === 'bug').map((p) => p.number)
  const keepProps = props.filter((p) => p.kind === 'keep').map((p) => p.number)

  // BTK001 상위 태스크 다섯 개의 순서
  const found = {}
  BUGFIX_TASK_FLOW.forEach((step, idx) => {
    const t = tops[idx]
    if (!t || !t.title.startsWith(step.prefix)) {
      report.error('BTK001', f, t?.line || doc.sections.find((s) => s.name === 'Tasks')?.line || 1, `${idx + 1}번째 상위 태스크는 "${idx + 1}. ${step.label}" 입니다. 버그 명세의 태스크 순서: ${BUGFIX_TASK_FLOW.map((s) => s.prefix).join(' → ')}`)
    } else found[step.key] = t
  })
  if (tops.length > BUGFIX_TASK_FLOW.length) report.error('BTK001', f, tops[BUGFIX_TASK_FLOW.length].line, `버그 명세의 상위 태스크는 ${BUGFIX_TASK_FLOW.length}개입니다. 고칠 곳이 여럿이면 "버그 수정" 아래 하위 태스크로 나눕니다.`)
  if (tops[0] && tops[0].number !== 1) report.error('BTK001', f, tops[0].line, '버그 명세의 태스크는 1번부터 시작합니다.')

  const has = (t, nums) => nums.every((n) => t.properties.some((p) => p.number === n))
  // BTK002 탐색 · 보존 테스트는 필수이고 해당 Property 를 모두 담는다
  for (const [key, nums, kind] of [['explore', bugProps, 'Bug Condition'], ['preserve', keepProps, 'Preservation']]) {
    const t = found[key]
    if (!t) continue
    if (t.optional) report.error('BTK002', f, t.line, `태스크 ${t.id}: ${t.title} 은(는) 선택(*) 태스크가 될 수 없습니다.`)
    if (design && !has(t, nums)) report.error('BTK002', f, t.line, `태스크 ${t.id}: ${kind} Property ${nums.join(', ')} 을(를) "**Property N: ...**" 으로 모두 적습니다.`)
  }

  // BTK003 버그 수정: 구현 하위 태스크 → 탐색 테스트 통과 확인 → 보존 테스트 통과 확인
  const fix = found.fix
  if (fix) {
    const kids = fix.children
    const n = kids.length
    const verifyExplore = kids[n - 2]
    const verifyKeep = kids[n - 1]
    if (n < 3) report.error('BTK003', f, fix.line, `태스크 ${fix.id}: 하위 태스크는 "<고치는 일>" → "탐색 테스트 통과 확인" → "보존 테스트 통과 확인" 입니다.`)
    else {
      if (!verifyExplore.title.startsWith('탐색 테스트 통과 확인')) report.error('BTK003', f, verifyExplore.line, `태스크 ${verifyExplore.id}: 끝에서 두 번째 하위 태스크는 "탐색 테스트 통과 확인" 입니다.`)
      else if (design && !has(verifyExplore, bugProps)) report.error('BTK003', f, verifyExplore.line, `태스크 ${verifyExplore.id}: Bug Condition Property ${bugProps.join(', ')} 을(를) 적습니다.`)
      if (!verifyKeep.title.startsWith('보존 테스트 통과 확인')) report.error('BTK003', f, verifyKeep.line, `태스크 ${verifyKeep.id}: 마지막 하위 태스크는 "보존 테스트 통과 확인" 입니다.`)
      else if (design && !has(verifyKeep, keepProps)) report.error('BTK003', f, verifyKeep.line, `태스크 ${verifyKeep.id}: Preservation Property ${keepProps.join(', ')} 을(를) 적습니다.`)
    }
    kids.forEach((k) => { if (k.optional) report.error('BTK003', f, k.line, `태스크 ${k.id}: 버그 수정의 하위 태스크는 선택(*)이 될 수 없습니다.`) })

    // BTK004 그래프: 탐색·보존 테스트 → 고치는 일 → 통과 확인
    if (doc.graph?.waves && found.explore && found.preserve && n >= 3) {
      const before = Math.max(waveOf(doc, found.explore.id) ?? -1, waveOf(doc, found.preserve.id) ?? -1)
      for (const k of kids.slice(0, n - 2)) {
        const w = waveOf(doc, k.id)
        if (w !== null && w <= before) report.error('BTK004', f, doc.graphLine, `Dependency Graph: "${k.id}" 는 탐색·보존 테스트(wave ${before})보다 뒤 wave 여야 합니다. 고치기 전에 테스트를 먼저 씁니다.`)
      }
      const lastFix = Math.max(...kids.slice(0, n - 2).map((k) => waveOf(doc, k.id) ?? -1))
      for (const k of kids.slice(n - 2)) {
        const w = waveOf(doc, k.id)
        if (w !== null && w <= lastFix) report.error('BTK004', f, doc.graphLine, `Dependency Graph: "${k.id}" 는 고치는 일(wave ${lastFix})보다 뒤 wave 여야 합니다.`)
      }
    }
  }

  // BTK005 탐색 테스트 결과 기록
  const ex = found.explore
  if (ex && ex.checked && !ex.body.some((b) => /^\s+- 결과\s*[:：]/.test(b.text))) {
    report.warn('BTK005', f, ex.line, `태스크 ${ex.id}: 고치기 전 실패를 확인했다면 "  - 결과: <실패 내용·반례>" 를 남깁니다.`)
  }
  return doc
}
