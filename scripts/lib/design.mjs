// design.md + design/01~08 (기능 명세 2단계)

import fs from 'node:fs'
import path from 'node:path'
import { readText, maskFences, h2List, rel, normalizeTitle, words } from './util.mjs'
import { expandRefs, refExists } from './refs.mjs'

export const DESIGN_FILES = [
  { file: '01-architecture.md', title: '아키텍처', sections: ['Architecture'] },
  { file: '02-components.md', title: '컴포넌트와 인터페이스', sections: ['Components and Interfaces'] },
  { file: '03-data-models.md', title: '데이터 모델 · API', sections: ['Data Models'] },
  { file: '04-error-handling.md', title: '에러 처리', sections: ['Error Handling'] },
  { file: '05-testing.md', title: '테스트 전략', sections: ['Testing Strategy'] },
  { file: '06-security-performance.md', title: '보안 · 성능', sections: ['Security', 'Performance Optimization'] },
  { file: '07-correctness-properties.md', title: '정확성 속성', sections: ['Property-Based Testing Analysis', 'Correctness Properties'] },
  { file: '08-deployment-configuration.md', title: '배포 · 설정', sections: ['Deployment', 'Configuration'] },
]
export const PROPERTY_PREAMBLE = /^\*A property is a characteristic or behavior that should hold true across all valid executions of a system/

/** "## Correctness Properties" 아래의 Property 목록. 기능 design 과 bugfix design 이 함께 쓴다. */
export function parseProperties(lines, section = 'Correctness Properties') {
  const out = []
  let current = null
  let inSection = false
  lines.forEach((line, i) => {
    const ln = i + 1
    let m
    if ((m = line.match(/^## (.+?)\s*$/))) { inSection = m[1] === section; current = null; return }
    if (!inSection) return
    if ((m = line.match(/^### Property (\d+):\s*(.+?)\s*$/))) {
      current = { number: Number(m[1]), title: m[2], line: ln, forAny: false, validates: null }
      out.push(current)
      return
    }
    if (!current) return
    if (/^\*For any\*/.test(line)) current.forAny = true
    if ((m = line.match(/^\*\*Validates: Requirements (.+?)\*\*\s*$/))) current.validates = { line: ln, text: m[1] }
  })
  return out
}

/** Property 공통 검사: 번호 연속, *For any*, Validates 와 참조 유효성. ids: { format, ref } */
export function checkProperties({ properties, refDoc, file, report, ids, refLabel = 'requirements' }) {
  properties.forEach((p, idx) => {
    if (p.number !== idx + 1) report.error(ids.format, file, p.line, `Property 번호가 연속되지 않습니다. 기대 ${idx + 1}, 실제 ${p.number}`)
    if (!p.forAny) report.error(ids.format, file, p.line, `Property ${p.number}: "*For any* ..." 문장이 없습니다.`)
    if (!p.validates) { report.error(ids.format, file, p.line, `Property ${p.number}: "**Validates: Requirements N.M**" 이 없습니다.`); return }
    if (!refDoc) return
    for (const [n, m, raw] of expandRefs(p.validates.text)) {
      if (!refExists(refDoc, n, m)) report.error(ids.ref, file, p.validates.line, `Property ${p.number}: 참조 ${n}.${m} 이(가) ${refLabel} 에 없습니다. (${raw})`)
    }
  })
}

export function parseDesign(dir) {
  const index = path.join(dir, 'design.md')
  const out = { kind: 'design', index, exists: fs.existsSync(index), files: [], properties: [], prework: [], components: [] }
  for (const spec of DESIGN_FILES) {
    const file = path.join(dir, 'design', spec.file)
    const exists = fs.existsSync(file)
    const raw = exists ? readText(file).split('\n') : []
    out.files.push({ ...spec, path: file, exists, raw, lines: maskFences(raw) })
  }
  const props = out.files[6]
  if (props.exists) {
    out.properties = parseProperties(props.lines)
    let section = null
    let pre = null
    props.lines.forEach((line, i) => {
      let m
      if ((m = line.match(/^## (.+?)\s*$/))) { section = m[1]; pre = null; return }
      if (section !== 'Property-Based Testing Analysis') return
      if ((m = line.match(/^(\d+)\.(\d+)\s+(.+?)\s*$/))) {
        pre = { n: Number(m[1]), m: Number(m[2]), title: m[3], line: i + 1, thoughts: false, classification: null, strategy: false }
        out.prework.push(pre)
        return
      }
      if (!pre) return
      if (/^\s+Thoughts:/.test(line)) pre.thoughts = true
      if ((m = line.match(/^\s+Classification:\s*(\S+)/))) pre.classification = m[1]
      if (/^\s+Test Strategy:/.test(line)) pre.strategy = true
      if (/^\*\*Property Reflection:\*\*/.test(line)) pre = null
    })
  }
  const comps = out.files[1]
  if (comps.exists) {
    comps.lines.forEach((line, i) => {
      const m = line.match(/^### (\d+)\.\s+(.+?)\s*$/)
      if (m) out.components.push({ number: Number(m[1]), title: m[2], line: i + 1 })
    })
  }
  return out
}

/** Prework 제목은 기준의 굵은 문장이거나, 그 문장의 단어만으로 줄인 것이어야 한다. */
function titleMatches(rule, title) {
  if (normalizeTitle(rule) === normalizeTitle(title)) return true
  const ruleWords = new Set(words(rule))
  const titleWords = words(title)
  return titleWords.length > 0 && titleWords.every((w) => ruleWords.has(w))
}

export function checkDesign(dir, req, root, report, { draft = false } = {}) {
  const design = parseDesign(dir)
  const missing = report.missing(draft)
  const fi = rel(root, design.index)

  // DES001 design.md (Overview + 문서 구성)
  if (!design.exists) missing('DES001', fi, 1, 'design.md 가 없습니다.')
  else {
    const raw = readText(design.index).split('\n')
    const lines = maskFences(raw)
    if (!/^# Technical Design Document\s*$/.test(raw[0] || '')) report.error('DES001', fi, 1, '첫 줄은 "# Technical Design Document" 여야 합니다.')
    const h2 = h2List(lines)
    if (h2.map((h) => h.name).join('|') !== 'Overview|문서 구성') {
      report.error('DES001', fi, h2[0]?.line || 1, `design.md 의 섹션은 "## Overview" → "## 문서 구성" 이어야 합니다. (실제: ${h2.map((h) => h.name).join(' → ') || '없음'})`)
    }
    if (!lines.some((l) => /^### 설계 목표\s*$/.test(l))) report.error('DES001', fi, 1, 'Overview 에 "### 설계 목표" 가 없습니다.')

    // DES002 문서 구성 표
    const links = []
    lines.forEach((l, i) => {
      const m = l.match(/^\|\s*\[([^\]]+)\]\(design\/([^)]+)\)\s*\|/)
      if (m) links.push({ title: m[1], file: m[2], line: i + 1 })
    })
    DESIGN_FILES.forEach((spec, idx) => {
      const link = links[idx]
      if (!link || link.file !== spec.file) report.error('DES002', fi, link?.line || 1, `"문서 구성" 표 ${idx + 1}번째 행은 [${spec.title}](design/${spec.file}) 이어야 합니다.`)
    })
    if (links.length > DESIGN_FILES.length) report.error('DES002', fi, links.at(-1).line, `"문서 구성" 표에 정해진 ${DESIGN_FILES.length}개 외의 문서가 있습니다.`)
  }

  // DES002 · DES003 · DES004 본문 파일
  for (const spec of design.files) {
    const f = rel(root, spec.path)
    if (!spec.exists) { missing('DES002', f, 1, `design/${spec.file} 이 없습니다.`); continue }
    if (spec.raw[0] !== `# Technical Design Document — ${spec.title}`) report.error('DES003', f, 1, `첫 줄은 "# Technical Design Document — ${spec.title}" 여야 합니다.`)
    if (!spec.raw.slice(1, 5).some((l) => l.trim() === '> [design.md](../design.md)로 돌아가기')) report.error('DES003', f, 2, '제목 아래에 "> [design.md](../design.md)로 돌아가기" 가 없습니다.')
    const h2 = h2List(spec.lines)
    const actual = h2.map((h) => h.name)
    if (actual.join('|') !== spec.sections.join('|')) {
      report.error('DES004', f, h2[0]?.line || 1, `섹션은 ${spec.sections.map((s) => `"## ${s}"`).join(' → ')} 이어야 합니다. (실제: ${actual.join(' → ') || '없음'})`)
    }
  }

  // DES005 컴포넌트 번호
  design.components.forEach((c, idx) => {
    if (c.number !== idx + 1) report.error('DES005', rel(root, design.files[1].path), c.line, `컴포넌트 번호가 연속되지 않습니다. 기대 ${idx + 1}, 실제 ${c.number}`)
  })

  // DES006 필수 하위 섹션
  const need = [
    ['03-data-models.md', /^### 도메인 용어 ↔ 코드\s*$/, '"### 도메인 용어 ↔ 코드"'],
    ['05-testing.md', /^#{3,4} (\d+\.\s*)?테스트 기준 데이터\s*$/, '"테스트 기준 데이터"'],
    ['07-correctness-properties.md', /^### PBT Applicability Assessment\s*$/, '"### PBT Applicability Assessment"'],
    ['07-correctness-properties.md', /^### Acceptance Criteria Testing Prework\s*$/, '"### Acceptance Criteria Testing Prework"'],
    ['07-correctness-properties.md', /^\*\*Property Reflection:\*\*\s*$/, '"**Property Reflection:**"'],
    ['07-correctness-properties.md', PROPERTY_PREAMBLE, 'Correctness Properties 머리말 (*A property is ...*)'],
  ]
  for (const [file, re, label] of need) {
    const spec = design.files.find((x) => x.file === file)
    if (spec.exists && !spec.lines.some((l) => re.test(l))) report.error('DES006', rel(root, spec.path), 1, `${label} 이(가) 없습니다.`)
  }

  const fp = rel(root, design.files[6].path)
  // DES007 · DES008 · DES010 Prework
  for (const p of design.prework) {
    const id = `${p.n}.${p.m}`
    if (!p.thoughts || !p.classification || !p.strategy) report.error('DES007', fp, p.line, `Prework ${id}: Thoughts / Classification / Test Strategy 세 줄이 모두 있어야 합니다.`)
    if (p.classification && !/^(PROPERTY|EXAMPLE|EDGE_CASE)$/.test(p.classification)) report.error('DES007', fp, p.line, `Prework ${id}: Classification 은 PROPERTY / EXAMPLE / EDGE_CASE 중 하나입니다. (실제: ${p.classification})`)
    if (!req) continue
    const c = req.requirements.find((x) => x.number === p.n)?.criteria.find((x) => x.number === p.m)
    if (!c) report.error('DES010', fp, p.line, `Prework ${id}: requirements 에 없는 기준입니다.`)
    else if (c.rule && !titleMatches(c.rule, p.title)) report.warn('DES008', fp, p.line, `Prework ${id}: 제목이 기준 문장과 다릅니다. 기준: "${normalizeTitle(c.rule)}"`)
  }

  // DES009 · DES010 Properties
  checkProperties({ properties: design.properties, refDoc: req, file: fp, report, ids: { format: 'DES009', ref: 'DES010' } })
  if (design.files[6].exists && design.properties.length === 0) report.error('DES009', fp, 1, '"### Property N: <이름>" 이 하나도 없습니다.')

  // DES011 PROPERTY 로 분류한 기준은 어떤 Property 가 검증해야 한다
  const validated = new Set(design.properties.flatMap((p) => (p.validates ? expandRefs(p.validates.text).map(([n, m]) => `${n}.${m}`) : [])))
  for (const p of design.prework) {
    if (p.classification === 'PROPERTY' && !validated.has(`${p.n}.${p.m}`)) report.warn('DES011', fp, p.line, `Prework ${p.n}.${p.m} 은 PROPERTY 인데 어떤 Property 의 Validates 에도 없습니다.`)
  }
  design.propertiesFile = design.files[6].exists
  return design
}
