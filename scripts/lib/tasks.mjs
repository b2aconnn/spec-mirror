// tasks.md (기능 · 버그 명세 3단계 공통)

import { readText, maskFences, h2List, rel } from './util.mjs'
import { expandRefs, refExists, allRefs } from './refs.mjs'

export const TASK_SECTIONS = ['Overview', 'Tasks', 'Notes', 'Task Dependency Graph']

export function parseTasks(file) {
  const raw = readText(file).split('\n')
  const lines = maskFences(raw)
  const doc = { file, kind: 'tasks', raw, sections: h2List(lines), tasks: [], badLines: [], graph: null, graphLine: null }
  let section = null
  let current = null
  lines.forEach((line, i) => {
    const ln = i + 1
    let m
    if ((m = line.match(/^## (.+?)\s*$/))) { section = m[1]; current = null; return }
    if (section !== 'Tasks') return
    if ((m = line.match(/^- \[([ xX-])\](\*)? (\d+)\. (.+)$/))) {
      current = { id: m[3], parent: null, number: Number(m[3]), mark: m[1], checked: /[xX]/.test(m[1]), optional: Boolean(m[2]), title: m[4], line: ln, body: [], children: [] }
      doc.tasks.push(current)
      return
    }
    if ((m = line.match(/^ {2}- \[([ xX-])\](\*)? (\d+)\.(\d+) (.+)$/))) {
      const parent = doc.tasks.filter((t) => !t.parent).at(-1)
      current = { id: `${m[3]}.${m[4]}`, parent: m[3], parentTask: parent, number: Number(m[4]), mark: m[1], checked: /[xX]/.test(m[1]), optional: Boolean(m[2]), title: m[5], line: ln, body: [], children: [] }
      doc.tasks.push(current)
      if (parent) parent.children.push(current)
      return
    }
    if (/^\s*- \[/.test(line)) { doc.badLines.push({ line: ln, text: line }); return }
    if (current && line.trim()) current.body.push({ line: ln, text: line })
  })
  for (const t of doc.tasks) {
    t.refs = []
    t.properties = []
    for (const b of t.body) {
      let m
      if ((m = b.text.match(/^\s+- _Requirements: (.+?)_\s*$/))) t.refs.push(...expandRefs(m[1]).map(([n, k, r]) => ({ n, k, raw: r, line: b.line, kind: 'requirements' })))
      if ((m = b.text.match(/^\s+- \*\*Validates: Requirements (.+?)\*\*\s*$/))) t.refs.push(...expandRefs(m[1]).map(([n, k, r]) => ({ n, k, raw: r, line: b.line, kind: 'validates' })))
      if ((m = b.text.match(/^\s+- \*\*Property (\d+): (.+?)\*\*\s*$/))) t.properties.push({ number: Number(m[1]), title: m[2], line: b.line })
    }
  }
  // 그래프: "## Task Dependency Graph" 아래 첫 json 코드 블록
  const gi = raw.findIndex((l) => /^## Task Dependency Graph\s*$/.test(l))
  if (gi !== -1) {
    const start = raw.findIndex((l, i) => i > gi && /^```json\s*$/.test(l))
    const end = start === -1 ? -1 : raw.findIndex((l, i) => i > start && /^```\s*$/.test(l))
    if (start !== -1 && end !== -1) {
      doc.graphLine = start + 1
      try { doc.graph = JSON.parse(raw.slice(start + 1, end).join('\n')) } catch (e) { doc.graph = { error: e.message } }
    }
  }
  doc.leaves = doc.tasks.filter((t) => t.children.length === 0)
  return doc
}

/** 그래프에서 태스크가 속한 wave 번호 */
export function waveOf(doc, id) {
  const w = doc.graph?.waves?.find((x) => Array.isArray(x.tasks) && x.tasks.includes(id))
  return w ? w.id : null
}

/**
 * 기능 · 버그 공통 검사.
 * refDoc: requirements 또는 bugfix 문서. properties: design 의 Property 목록 (design 이 없으면 null)
 */
export function checkTasks(file, { refDoc, properties, root, report, draft = false, refLabel }) {
  const doc = parseTasks(file)
  const f = rel(root, file)
  const missing = report.missing(draft)

  // TSK001 제목 · 섹션
  if (!/^# Implementation Plan: .+/.test(doc.raw[0] || '')) report.error('TSK001', f, 1, '첫 줄은 "# Implementation Plan: <이름>" 이어야 합니다.')
  const names = doc.sections.map((s) => s.name)
  if (names.join('|') !== TASK_SECTIONS.join('|')) report.error('TSK001', f, doc.sections[0]?.line || 1, `섹션은 ${TASK_SECTIONS.join(' → ')} 이어야 합니다. (실제: ${names.join(' → ') || '없음'})`)

  // TSK002 줄 형식
  doc.badLines.forEach((b) => report.error('TSK002', f, b.line, `태스크 줄 형식이 아닙니다. "- [ ] N. 제목" 또는 "  - [ ]* N.M 제목" 으로 씁니다: ${b.text.trim().slice(0, 40)}`))
  for (const t of doc.tasks) {
    for (const b of t.body) {
      if (/_Requirements/.test(b.text) && !/^\s+- _Requirements: .+_\s*$/.test(b.text)) report.error('TSK004', f, b.line, `태스크 ${t.id}: "  - _Requirements: 1.2, 1.3_" 형식으로 씁니다.`)
    }
  }

  // TSK003 번호 · TSK010 상위 완료 / 하위 미완료
  const tops = doc.tasks.filter((t) => !t.parent)
  const first = tops[0]?.number
  if (tops.length === 0) report.error('TSK003', f, 1, '태스크가 하나도 없습니다.')
  else if (first !== 0 && first !== 1) report.error('TSK003', f, tops[0].line, `첫 태스크 번호는 0 또는 1 이어야 합니다. (실제 ${first})`)
  tops.forEach((t, idx) => {
    if (t.number !== first + idx) report.error('TSK003', f, t.line, `태스크 번호가 연속되지 않습니다. 기대 ${first + idx}, 실제 ${t.number}`)
    t.children.forEach((c, j) => {
      if (c.parent !== t.id) report.error('TSK003', f, c.line, `하위 태스크 ${c.id} 가 상위 태스크 ${t.id} 아래에 있습니다.`)
      if (c.number !== j + 1) report.error('TSK003', f, c.line, `하위 태스크 번호가 연속되지 않습니다. 기대 ${t.id}.${j + 1}, 실제 ${c.id}`)
    })
    if (t.checked && t.children.some((c) => !c.checked && !c.optional)) report.warn('TSK010', f, t.line, `태스크 ${t.id} 는 완료로 표시됐지만 끝나지 않은 필수 하위 태스크가 있습니다.`)
  })

  // TSK004 · TSK006 참조 · TSK005 Property
  const propTitles = properties ? new Map(properties.map((p) => [p.number, p.title])) : null
  for (const t of doc.tasks) {
    for (const r of t.refs) {
      if (refDoc && !refExists(refDoc, r.n, r.k)) report.error(r.kind === 'validates' ? 'TSK006' : 'TSK004', f, r.line, `태스크 ${t.id}: 참조 ${r.n}.${r.k} 이(가) ${refLabel} 에 없습니다. (${r.raw})`)
    }
    if (!propTitles) continue
    for (const p of t.properties) {
      if (!propTitles.has(p.number)) report.error('TSK005', f, p.line, `태스크 ${t.id}: Property ${p.number} 이(가) design 에 없습니다.`)
      else if (propTitles.get(p.number) !== p.title) report.warn('TSK005', f, p.line, `태스크 ${t.id}: Property ${p.number} 이름이 design 과 다릅니다. design: "${propTitles.get(p.number)}"`)
    }
  }

  // TSK007 · TSK008 Dependency Graph
  if (names.includes('Task Dependency Graph')) {
    if (!doc.graph) report.error('TSK007', f, 1, '"## Task Dependency Graph" 아래에 ```json 코드 블록이 없습니다.')
    else if (doc.graph.error) report.error('TSK007', f, doc.graphLine, `Dependency Graph JSON 을 읽을 수 없습니다: ${doc.graph.error}`)
    else if (!Array.isArray(doc.graph.waves)) report.error('TSK007', f, doc.graphLine, 'Dependency Graph 는 { "waves": [ { "id": 0, "tasks": [...] } ] } 형식입니다.')
    else {
      const leaves = new Set(doc.leaves.map((t) => t.id))
      const all = new Set(doc.tasks.map((t) => t.id))
      const count = new Map()
      doc.graph.waves.forEach((w, idx) => {
        if (w.id !== idx) report.error('TSK007', f, doc.graphLine, `wave id 가 연속되지 않습니다. 기대 ${idx}, 실제 ${w.id}`)
        if (!Array.isArray(w.tasks)) { report.error('TSK007', f, doc.graphLine, `wave ${w.id} 에 tasks 배열이 없습니다.`); return }
        w.tasks.forEach((id) => {
          count.set(id, (count.get(id) || 0) + 1)
          if (!all.has(id)) report.error('TSK008', f, doc.graphLine, `Dependency Graph 의 "${id}" 는 없는 태스크입니다.`)
          else if (!leaves.has(id)) report.error('TSK008', f, doc.graphLine, `Dependency Graph 에는 하위 태스크가 있는 "${id}" 대신 하위 태스크를 넣습니다.`)
        })
      })
      leaves.forEach((id) => {
        if (!count.has(id)) report.error('TSK008', f, doc.graphLine, `태스크 "${id}" 가 Dependency Graph 에 없습니다.`)
        else if (count.get(id) > 1) report.error('TSK008', f, doc.graphLine, `태스크 "${id}" 가 Dependency Graph 에 ${count.get(id)}번 나옵니다.`)
      })
    }
  }

  // TSK009 모든 기준(항목)이 어떤 태스크에 포함
  if (refDoc) {
    const covered = new Set(doc.tasks.flatMap((t) => t.refs.map((r) => `${r.n}.${r.k}`)))
    for (const ref of allRefs(refDoc)) {
      if (!covered.has(ref)) missing('TSK009', f, 1, `${refLabel} ${ref} 이(가) 어떤 태스크의 _Requirements_ 에도 없습니다.`)
    }
  }
  return doc
}
