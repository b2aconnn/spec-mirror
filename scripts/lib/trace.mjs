// 명세 ↔ 테스트 ↔ 코드 추적

import fs from 'node:fs'
import path from 'node:path'
import { readText, rel, normalizeTitle } from './util.mjs'
import { refExists } from './refs.mjs'
import { checkSpec } from './spec.mjs'
import { FLOW, RULES } from './requirements.mjs'

const COMMENT_RE = /(\/\/|#|--|\/\*|\*|<!--|;)\s*[RB]\d+-\d+/

function walk(root, config, out = [], dir = root) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  const specAbs = path.join(root, config.specRoot)
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (config.ignoreDirs.includes(e.name) || p === specAbs || e.name === '.spec-mirror') continue
      walk(root, config, out, p)
    } else if (e.isFile()) {
      if (!config.sourceExtensions.includes(e.name.split('.').pop())) continue
      try { if (fs.statSync(p).size > 1_000_000) continue } catch { continue }
      out.push(p)
    }
  }
  return out
}

/** 소스 트리를 한 번 읽어 { relPath, isTest, text, lines } 목록으로 */
export function loadSources(root, config) {
  const testRes = config.testPathPatterns.map((s) => new RegExp(s))
  return walk(root, config).flatMap((file) => {
    const relPath = rel(root, file)
    try {
      const text = readText(file)
      return [{ relPath, isTest: testRes.some((re) => re.test(relPath)), text, lines: text.split('\n') }]
    } catch { return [] }
  })
}

/** 파일들에서 토큰(R 또는 B)을 찾는다. → [{ n, k, suffix, where, isTest, isComment, file, line }] */
function findTokens(sources, letter, filter = () => true) {
  const re = new RegExp(`\\b${letter}(\\d+)-(\\d+)([a-z])?\\b`, 'g')
  const out = []
  for (const s of sources) {
    if (!filter(s)) continue
    s.lines.forEach((line, i) => {
      re.lastIndex = 0
      let m
      while ((m = re.exec(line))) {
        out.push({ n: Number(m[1]), k: Number(m[2]), suffix: m[3] || '', where: `${s.relPath}:${i + 1}`, isTest: s.isTest, isComment: COMMENT_RE.test(line), file: s.relPath, line: i + 1 })
      }
    })
  }
  return out
}

export function traceFeature(root, config, name, sources = loadSources(root, config)) {
  const { first: req, report, type } = checkSpec(root, config, name)
  if (type !== 'feature' || !req) return { name, type, error: type === 'bugfix' ? null : 'requirements.md 가 없습니다.', rows: [], orphans: [], orderIssues: [], messages: [] }
  const hits = new Map()
  const hit = (key) => hits.get(key) || hits.set(key, { tests: [], code: [] }).get(key)
  const orphans = []
  const orderIssues = []
  const flowSeen = new Map() // 파일별 Requirement 별 직전 기준 번호

  for (const t of findTokens(sources, 'R')) {
    const key = `${t.n}.${t.k}`
    const known = refExists(req, t.n, t.k)
    if (t.isTest) {
      if (!known) orphans.push({ kind: 'test', id: `R${t.n}-${t.k}${t.suffix}`, where: t.where })
      else hit(key).tests.push(t.where)
      continue
    }
    if (!t.isComment) continue
    if (!known) { orphans.push({ kind: 'code', id: `R${t.n}-${t.k}`, where: t.where }); continue }
    hit(key).code.push(t.where)
    const crit = req.requirements[t.n - 1].criteria.find((c) => c.number === t.k)
    if (crit.group !== FLOW) continue
    const fk = `${t.file}#${t.n}`
    const prev = flowSeen.get(fk)
    if (prev !== undefined && t.k < prev) orderIssues.push({ where: t.where, message: `R${t.n}-${t.k} 가 R${t.n}-${prev} 보다 아래에 있습니다. 처리 흐름 순서와 다릅니다.` })
    flowSeen.set(fk, Math.max(prev ?? 0, t.k))
  }

  const rows = []
  for (const r of req.requirements) {
    for (const c of r.criteria) {
      const h = hits.get(`${r.number}.${c.number}`) || { tests: [], code: [] }
      const issues = []
      if (h.tests.length === 0) issues.push('테스트 없음')
      if (h.code.length === 0) issues.push(c.group === RULES ? '보장 위치 주석 없음 (확인 필요)' : '코드 주석 없음')
      rows.push({ id: `R${r.number}-${c.number}`, ref: `${r.number}.${c.number}`, group: c.group, rule: c.rule ? normalizeTitle(c.rule) : c.text, tests: h.tests, code: h.code, issues })
    }
  }

  // 메시지 문구가 코드에 그대로 있는지
  const code = sources.filter((s) => !s.isTest)
  const messages = []
  for (const r of req.requirements) {
    for (const c of r.criteria) {
      for (const it of c.items) {
        const mm = it.text.match(/^메시지\s*[:：]\s*"(.+)"\s*$/)
        if (!mm) continue
        const literal = mm[1].split('{')[0].replace(/\s*\($/, '').trim()
        if (literal && !code.some((s) => s.text.includes(literal))) messages.push({ id: `R${r.number}-${c.number}`, message: mm[1], issue: '코드에서 같은 문구를 찾지 못함' })
      }
    }
  }
  return { name, type, rows, orphans, orderIssues, messages, formatErrors: report.errors.length }
}

/**
 * 버그 명세: 기대 동작(2.M)과 유지할 동작(3.M)마다 테스트를 찾는다.
 * - "명세: <기능> N.M" 이 있으면 그 기능의 R{N}-{M} 테스트 (접미사 a, b … 포함)
 * - 없으면 버그 이름을 담은 테스트 파일의 B{N}-{M} 테스트
 * 기대 동작은 고친 코드 위치의 주석(R 또는 B)도 찾는다.
 */
export function traceBugfix(root, config, name, sources = loadSources(root, config)) {
  const { first: bug, report, type } = checkSpec(root, config, name)
  if (type !== 'bugfix' || !bug) return { name, type, error: 'bugfix.md 가 없습니다.', rows: [] }
  const rTokens = findTokens(sources, 'R')
  const bTokens = findTokens(sources, 'B', (s) => s.text.includes(name))
  const rows = []
  for (const group of [2, 3]) {
    for (const c of bug.requirements[group - 1].criteria) {
      const refs = c.specLinks.flatMap((l) => l.refs)
      const match = (t) => refs.some((r) => r.n === t.n && r.m === t.k)
      const tests = [
        ...rTokens.filter((t) => t.isTest && match(t)).map((t) => t.where),
        ...bTokens.filter((t) => t.isTest && t.n === group && t.k === c.number).map((t) => t.where),
      ]
      const code = [
        ...rTokens.filter((t) => !t.isTest && t.isComment && match(t)).map((t) => t.where),
        ...bTokens.filter((t) => !t.isTest && t.isComment && t.n === group && t.k === c.number).map((t) => t.where),
      ]
      const issues = []
      if (tests.length === 0) issues.push(group === 2 ? '테스트 없음' : '보존 테스트 없음')
      if (group === 2 && code.length === 0) issues.push('코드 주석 없음')
      rows.push({ id: `${group}.${c.number}`, ref: refs.map((r) => r.raw).join(', ') || (c.specLinks[0]?.kind === 'new' ? '새 기준' : '—'), rule: c.rule ? normalizeTitle(c.rule) : c.text, tests, code, issues })
    }
  }
  return { name, type, rows, orphans: [], orderIssues: [], messages: [], formatErrors: report.errors.length }
}

export function trace(root, config, name) {
  const sources = loadSources(root, config)
  const feature = traceFeature(root, config, name, sources)
  if (feature.type === 'bugfix') return traceBugfix(root, config, name, sources)
  return feature
}
