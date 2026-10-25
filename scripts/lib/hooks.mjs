// Claude Code 훅
//   pre     PreToolUse(Write|Edit|MultiEdit)  — 단계 잠금. 앞 단계 승인 전에는 다음 단계 문서를 쓰지 못한다
//   post    PostToolUse(Write|Edit|MultiEdit) — 형식 검사. 오류가 있으면 그 자리에서 고치게 한다
//   session SessionStart                      — 진행 중인 명세와 다음 할 일을 알린다

import path from 'node:path'
import { findProjectRoot, loadConfig, hasConfig, specDir, specType, listSpecs, SPEC_TYPES } from './config.mjs'
import { rel } from './util.mjs'
import { checkSpec } from './spec.mjs'
import { gate, next, STATUS_LABEL } from './state.mjs'
import { checkMap, MAP_FILE } from './map.mjs'

async function readPayload() {
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  try { return JSON.parse(input || '{}') } catch { return null }
}

/** 편집 대상이 명세 문서인지: → { root, config, name, stage, file, abs } 또는 null */
export function classify(payload) {
  const filePath = payload?.tool_input?.file_path || payload?.tool_input?.path
  if (!filePath) return null
  const cwd = payload.cwd || process.cwd()
  const abs = path.resolve(cwd, filePath)
  const root = findProjectRoot(path.dirname(abs))
  let config
  try { config = loadConfig(root) } catch { return null }
  const relPath = path.relative(path.join(root, config.specRoot), abs)
  if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath)) return null
  if (relPath === MAP_FILE) return { root, config, name: null, stage: 'map', rest: MAP_FILE, abs, file: rel(root, abs) }
  const parts = relPath.split(path.sep)
  const [name, ...restParts] = parts
  const rest = restParts.join('/')
  let stage = null
  if (rest === 'requirements.md') stage = 'requirements'
  else if (rest === 'bugfix.md') stage = 'bugfix'
  else if (rest === 'design.md' || /^design\/[^/]+\.md$/.test(rest)) stage = 'design'
  else if (rest === 'tasks.md') stage = 'tasks'
  else if (rest === '.spec-mirror.json') stage = 'state'
  if (!name || !stage) return null
  return { root, config, name, stage, rest, abs, file: rel(root, abs) }
}

const deny = (reason) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `[spec-mirror] ${reason}` } }))
  return 0
}

export async function preHook() {
  const c = classify(await readPayload())
  if (!c) return 0
  const { root, config, name, stage, rest } = c
  if (stage === 'map') return 0
  if (stage === 'state') return deny('승인 기록(.spec-mirror.json)은 직접 고치지 않습니다. 승인은 사용자가 /spec-mirror:approve 로 합니다.')
  if (config.stageGate === false) return 0
  const type = specType(specDir(root, config, name))

  if (stage === 'requirements' && type === 'bugfix') return deny(`${name} 은(는) 버그 명세입니다. 기능 명세(requirements.md)는 다른 폴더에 씁니다.`)
  if (stage === 'bugfix' && type === 'feature') return deny(`${name} 은(는) 기능 명세입니다. 버그 명세(bugfix.md)는 /spec-mirror:bugfix <버그 이름> 으로 새 폴더에 씁니다.`)
  if (stage === 'requirements' || stage === 'bugfix') return 0

  if (!type) return deny(`${name} 에 requirements.md(기능) 또는 bugfix.md(버그)가 아직 없습니다. 첫 단계 문서부터 씁니다.`)
  if (type === 'bugfix' && stage === 'design' && rest !== 'design.md') return deny('버그 명세의 design 은 design.md 한 파일입니다. design/ 폴더를 만들지 않습니다.')
  const g = gate(root, config, name, stage)
  if (g.ok) return 0
  const lines = g.blocked.map((b) => `${b.stage}: ${STATUS_LABEL[b.status]}`).join(', ')
  return deny(`${name} 의 ${stage} 단계 문서는 앞 단계가 승인된 뒤에 씁니다. (${lines}) 앞 단계 문서를 사용자에게 보여 주고 승인을 받으세요. 사용자가 분명하게 승인하면 approve 명령으로 기록합니다.`)
}

export async function postHook() {
  const c = classify(await readPayload())
  if (!c || c.stage === 'state') return 0
  if (c.stage === 'map') {
    const { report } = checkMap(c.root, c.config)
    const errors = report.errors
    const fmtMap = (i) => `- ${i.rule} ${i.file}:${i.line} ${i.message}`
    if (errors.length && !errors.some((i) => i.rule === 'MAP000')) {
      process.stderr.write(`[spec-mirror] ${c.file} 형식 오류 ${errors.length}건 — 규칙에 맞게 고치세요.\n${errors.slice(0, 25).map(fmtMap).join('\n')}\n`)
      return 2
    }
    const notes = [...errors, ...report.warnings]
    if (notes.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `[spec-mirror] ${c.file} 확인할 것 ${notes.length}건:\n${notes.slice(0, 25).map(fmtMap).join('\n')}` } }))
    return 0
  }
  const { root, config, name, file } = c
  const dir = specDir(root, config, name)
  const type = specType(dir)
  if (!type) return 0
  const { report } = checkSpec(root, config, name, { draft: true })
  const mine = report.issues.filter((i) => i.file === file && i.severity !== 'info')
  const errors = mine.filter((i) => i.severity === 'error')
  const warnings = mine.filter((i) => i.severity === 'warning')
  const others = report.errors.filter((i) => i.file !== file)
  const fmt = (i) => `- ${i.rule} ${i.file}:${i.line} ${i.message}`
  const limit = (list) => list.slice(0, 25).map(fmt).join('\n') + (list.length > 25 ? `\n- ... 외 ${list.length - 25}건 (/spec-mirror:check ${name})` : '')

  const notes = []
  const placeholders = errors.filter((i) => /000$/.test(i.rule))
  if (placeholders.length) {
    // 템플릿을 채우는 중: 막지 않고 남은 일만 알린다. 자리표시자를 다 채우면 그때부터 오류가 수정을 막는다
    notes.push(`[spec-mirror] ${file} 작성 중 — 자리표시자 ${placeholders.length}개가 남았습니다. 다 채운 뒤 아래 형식 오류도 0건이어야 합니다.\n${limit(errors)}`)
  } else if (errors.length) {
    process.stderr.write(`[spec-mirror] ${file} 형식 오류 ${errors.length}건 — 규칙에 맞게 고치세요.\n${limit(errors)}\n`)
    return 2
  }
  if (warnings.length) notes.push(`[spec-mirror] ${file} 경고 ${warnings.length}건:\n${limit(warnings)}`)
  if (others.length) notes.push(`[spec-mirror] 같은 명세의 다른 문서에 오류 ${others.length}건 (이번 수정과 관련 있는지 확인):\n${limit(others)}`)
  if (notes.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: notes.join('\n\n') } }))
  return 0
}

export async function sessionHook() {
  const payload = await readPayload()
  const root = findProjectRoot(payload?.cwd || process.cwd())
  if (!hasConfig(root)) return 0
  let config
  try { config = loadConfig(root) } catch { return 0 }
  const lines = []
  for (const name of listSpecs(root, config)) {
    const n = next(root, config, name)
    if (n.action === 'sync' && n.progress && n.progress.required.done === n.progress.required.total) continue
    const kind = `${SPEC_TYPES[n.type]?.label || '?'}${n.mode === 'adopt' ? ' · 기존 코드' : ''}`
    const prog = n.progress ? ` · 필수 태스크 ${n.progress.required.done}/${n.progress.required.total}` : ''
    lines.push(`- ${name} (${kind})${prog}: ${n.message}`)
    if (lines.length >= 10) break
  }
  if (lines.length === 0) return 0
  const text = `[spec-mirror] 진행 중인 명세 (${config.specRoot}/)\n${lines.join('\n')}\n이어서 하려면 /spec-mirror:spec <이름>, /spec-mirror:bugfix <이름>, /spec-mirror:adopt <이름> (기존 코드), 상태는 /spec-mirror:status`
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }))
  return 0
}
