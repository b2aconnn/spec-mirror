// 공통 유틸: 파일 읽기, 마크다운 마스킹, 보고서

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n')
}

/** 코드 펜스 안의 줄을 빈 줄로 바꾼다. 줄 번호는 그대로 유지된다. */
export function maskFences(lines) {
  let inFence = false
  let fence = ''
  return lines.map((line) => {
    const m = line.match(/^\s*(```+|~~~+)/)
    if (m) {
      if (!inFence) { inFence = true; fence = m[1][0]; return '' }
      if (m[1][0] === fence) { inFence = false; return '' }
    }
    return inFence ? '' : line
  })
}

/** 코드 펜스 블록을 { start, end, info, body } 목록으로 돌려준다. start/end 는 1부터 센 줄 번호. */
export function fenceBlocks(lines) {
  const blocks = []
  let open = null
  lines.forEach((line, i) => {
    const m = line.match(/^\s*(```+|~~~+)\s*(\S*)/)
    if (!m) { if (open) open.body.push(line); return }
    if (!open) open = { start: i + 1, fence: m[1][0], info: m[2], body: [] }
    else if (m[1][0] === open.fence) { blocks.push({ ...open, end: i + 1 }); open = null }
    else open.body.push(line)
  })
  return blocks
}

/** 인라인 코드(`...`)를 같은 길이의 공백으로 바꾼다. */
export function maskInlineCode(line) {
  return line.replace(/`[^`]*`/g, (s) => ' '.repeat(s.length))
}

/** 큰따옴표 문자열("...")을 같은 길이의 공백으로 바꾼다. */
export function maskQuotes(line) {
  return line.replace(/"[^"]*"/g, (s) => ' '.repeat(s.length))
}

export function stripBold(s) {
  return s.replace(/\*\*/g, '')
}

export function normalizeTitle(s) {
  return stripBold(s).replace(/[.。]\s*$/, '').replace(/\s+/g, ' ').trim()
}

/** 비교용 단어 목록: 문장 부호를 빼고 공백으로 나눈다. */
export function words(s) {
  return normalizeTitle(s).replace(/[,.·:;()'"`]/g, ' ').split(/\s+/).filter(Boolean)
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

export function rel(root, file) {
  return (path.relative(root, file) || file).split(path.sep).join('/')
}

/** "## 제목" 기준으로 줄을 섹션별로 모은다. 펜스 안은 제외된 masked 줄을 쓴다. */
export function sectionLines(masked, sections) {
  const out = []
  let current = null
  masked.forEach((line, i) => {
    const m = line.match(/^## (.+?)\s*$/)
    if (m) { current = m[1]; return }
    if (sections.includes(current) && line.trim()) out.push({ line, ln: i + 1, section: current })
  })
  return out
}

/** "## " 제목 목록 [{ name, line }] */
export function h2List(masked) {
  return masked.map((l, i) => ({ name: l.match(/^## (.+?)\s*$/)?.[1], line: i + 1 })).filter((x) => x.name)
}

export class Report {
  constructor() { this.issues = [] }
  add(severity, rule, file, line, message) {
    this.issues.push({ severity, rule, file, line, message })
  }
  error(rule, file, line, message) { this.add('error', rule, file, line, message) }
  warn(rule, file, line, message) { this.add('warning', rule, file, line, message) }
  info(rule, file, line, message) { this.add('info', rule, file, line, message) }
  /** draft 이면 "아직 없음" 류의 문제를 정보로 낮춘다. */
  missing(draft) { return draft ? this.info.bind(this) : this.error.bind(this) }
  get errors() { return this.issues.filter((i) => i.severity === 'error') }
  get warnings() { return this.issues.filter((i) => i.severity === 'warning') }
}
