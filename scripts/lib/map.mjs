// 명세 지도: <specRoot>/README.md — 프로젝트의 기능 목록, 진입점, 기능 사이 관계, 진행 순서

import fs from 'node:fs'
import path from 'node:path'
import { readText, maskFences, maskInlineCode, h2List, rel, Report } from './util.mjs'
import { NAME_RE, listSpecs, specDir, specType } from './config.mjs'

export const MAP_FILE = 'README.md'
export const MAP_SECTIONS = ['Overview', 'Features', 'Out of Scope']
export const MAP_COLUMNS = ['순서', '기능', '범위', '진입점', '관련 기능']

export function mapPath(root, config) {
  return path.join(root, config.specRoot, MAP_FILE)
}

const cells = (line) => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim())

export function parseMap(file) {
  const raw = readText(file).split('\n')
  const lines = maskFences(raw)
  const doc = { file, raw, sections: h2List(lines), header: null, rows: [] }
  let section = null
  lines.forEach((line, i) => {
    const h = line.match(/^## (.+?)\s*$/)
    if (h) { section = h[1]; return }
    if (section !== 'Features' || !/^\s*\|/.test(line)) return
    const c = cells(line)
    if (!doc.header) { doc.header = { cells: c, line: i + 1 }; return }
    if (c.every((x) => /^:?-+:?$/.test(x))) return
    const link = c[1]?.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    doc.rows.push({
      line: i + 1,
      order: c[0],
      name: link ? link[1] : null,
      target: link ? link[2] : null,
      raw: c[1],
      scope: c[2],
      entry: c[3],
      related: (c[4] || '').split(/[,·]/).map((x) => x.trim().replace(/^`|`$/g, '')).filter((x) => x && !/^[—-]+$/.test(x) && x !== '없음'),
    })
  })
  return doc
}

export function checkMap(root, config, report = new Report()) {
  const file = mapPath(root, config)
  if (!fs.existsSync(file)) return { report, doc: null }
  const doc = parseMap(file)
  const f = rel(root, file)

  // MAP000 자리표시자
  maskFences(doc.raw).forEach((line, i) => {
    const found = maskInlineCode(line).match(/<(?![/!]?[a-z][a-z0-9]*\b[^<>]*>)[^<>\s=\-`][^<>`]{0,40}>/g)
    if (found) report.error('MAP000', f, i + 1, `채우지 않은 자리표시자 ${found.join(' ')} — 실제 내용으로 바꿉니다.`)
  })

  // MAP001 제목 · 섹션
  if (!/^# Spec Map\s*$/.test(doc.raw[0] || '')) report.error('MAP001', f, 1, '첫 줄은 "# Spec Map" 이어야 합니다.')
  const names = doc.sections.map((s) => s.name)
  if (names.join('|') !== MAP_SECTIONS.join('|')) report.error('MAP001', f, doc.sections[0]?.line || 1, `섹션은 ${MAP_SECTIONS.map((s) => `"## ${s}"`).join(' → ')} 이어야 합니다. (실제: ${names.join(' → ') || '없음'})`)

  // MAP002 표 머리
  if (names.includes('Features')) {
    if (!doc.header) report.error('MAP002', f, doc.sections.find((s) => s.name === 'Features').line, `"## Features" 에 | ${MAP_COLUMNS.join(' | ')} | 표가 없습니다.`)
    else if (doc.header.cells.join('|') !== MAP_COLUMNS.join('|')) report.error('MAP002', f, doc.header.line, `표의 열은 ${MAP_COLUMNS.join(' | ')} 입니다. (실제: ${doc.header.cells.join(' | ')})`)
  }

  // MAP003 행: 순서 · 기능 링크 · 중복
  const seen = new Set()
  doc.rows.forEach((r, idx) => {
    if (r.order !== String(idx + 1)) report.error('MAP003', f, r.line, `순서는 1부터 연속입니다. 기대 ${idx + 1}, 실제 ${r.order}`)
    if (!r.name) { report.error('MAP003', f, r.line, `기능 칸은 [<기능>](<기능>/) 링크로 씁니다. (실제: ${r.raw})`); return }
    if (!NAME_RE.test(r.name)) report.error('MAP003', f, r.line, `기능 이름 "${r.name}" 은 영문 소문자·숫자·하이픈으로 씁니다.`)
    if (!new RegExp(`^${r.name}/(requirements\\.md)?$`).test(r.target)) report.error('MAP003', f, r.line, `기능 링크는 ${r.name}/ 또는 ${r.name}/requirements.md 를 가리킵니다. (실제: ${r.target})`)
    if (seen.has(r.name)) report.error('MAP003', f, r.line, `기능 "${r.name}" 이 두 번 나옵니다.`)
    seen.add(r.name)
    if (specType(specDir(root, config, r.name)) === 'bugfix') report.error('MAP003', f, r.line, `"${r.name}" 은 버그 명세입니다. 지도에는 기능 명세만 씁니다.`)
  })
  if (doc.header && doc.rows.length === 0) report.error('MAP003', f, doc.header.line, '기능이 하나도 없습니다.')

  // MAP004 관련 기능
  for (const r of doc.rows) {
    for (const other of r.related) {
      if (!seen.has(other)) report.error('MAP004', f, r.line, `관련 기능 "${other}" 이 지도에 없습니다.`)
    }
  }

  // MAP005 지도에 없는 기능 명세
  for (const name of listSpecs(root, config)) {
    if (specType(specDir(root, config, name)) === 'feature' && !seen.has(name)) report.warn('MAP005', f, doc.header?.line || 1, `기능 명세 "${name}" 이 지도에 없습니다.`)
  }
  return { report, doc }
}
