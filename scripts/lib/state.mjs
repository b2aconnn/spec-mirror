// 단계 승인 상태: <specRoot>/<이름>/.spec-mirror.json 에 문서 해시로 기록한다

import fs from 'node:fs'
import path from 'node:path'
import { readText, sha256 } from './util.mjs'
import { SPEC_TYPES, specDir, specType } from './config.mjs'
import { DESIGN_FILES } from './design.mjs'
import { checkSpec, stageOfRule } from './spec.mjs'

export const STATUS_LABEL = {
  missing: '없음',
  draft: '작성 중 (미승인)',
  changed: '승인 후 변경됨 (재승인 필요)',
  stale: '앞 단계가 바뀜 (재확인 후 재승인 필요)',
  approved: '승인됨',
}

export function stagesOf(type) {
  return SPEC_TYPES[type]?.stages || []
}

export function stageFiles(dir, type, stage) {
  if (stage === 'requirements') return [path.join(dir, 'requirements.md')]
  if (stage === 'bugfix') return [path.join(dir, 'bugfix.md')]
  if (stage === 'tasks') return [path.join(dir, 'tasks.md')]
  if (type === 'bugfix') return [path.join(dir, 'design.md')]
  return [path.join(dir, 'design.md'), ...DESIGN_FILES.map((d) => path.join(dir, 'design', d.file))]
}

/**
 * tasks 의 체크 표시와 "결과:" 기록은 진행 상황이지 계획 변경이 아니므로 해시에서 뺀다.
 */
export function normalizeForHash(stage, text) {
  if (stage !== 'tasks') return text
  return text
    .replace(/^(\s*- )\[[xX-]\]/gm, '$1[ ]')
    .replace(/^\s+- 결과\s*[:：].*\n?/gm, '')
}

export function stageHash(dir, type, stage) {
  const files = stageFiles(dir, type, stage)
  if (!files.every((f) => fs.existsSync(f))) return null
  return sha256(files.map((f) => `${path.basename(f)}\n${normalizeForHash(stage, readText(f))}`).join('\n\0\n'))
}

export function stateFile(dir) {
  return path.join(dir, '.spec-mirror.json')
}

export function readState(dir) {
  const f = stateFile(dir)
  if (!fs.existsSync(f)) return {}
  try { return JSON.parse(readText(f)) } catch { return {} }
}

export function stageStatus(dir, type, stage, state = readState(dir)) {
  const saved = state[stage]
  const hash = stageHash(dir, type, stage)
  if (!hash) return { stage, status: 'missing' }
  if (!saved?.hash) return { stage, status: 'draft' }
  if (saved.hash !== hash) return { stage, status: 'changed', approvedAt: saved.approvedAt }
  const stages = stagesOf(type)
  for (const prev of stages.slice(0, stages.indexOf(stage))) {
    if ((saved.basedOn || {})[prev] !== state[prev]?.hash) return { stage, status: 'stale', approvedAt: saved.approvedAt, because: prev }
  }
  return { stage, status: 'approved', approvedAt: saved.approvedAt }
}

export function allStatuses(dir, type) {
  const state = readState(dir)
  return stagesOf(type).map((s) => stageStatus(dir, type, s, state))
}

/** 이 단계를 작성해도 되는지: 앞 단계가 모두 승인 상태여야 한다. stage 가 'implement' 면 모든 단계. */
export function gate(root, config, name, stage) {
  const dir = specDir(root, config, name)
  const type = specType(dir)
  if (!type || type === 'conflict') return { ok: false, type, blocked: [], reason: type === 'conflict' ? '기능·버그 명세가 한 폴더에 섞여 있습니다.' : '명세가 없습니다.' }
  const stages = stagesOf(type)
  if (stage !== 'implement' && !stages.includes(stage)) return { ok: false, type, blocked: [], reason: `${SPEC_TYPES[type].label} 명세의 단계는 ${stages.join(', ')} 입니다.` }
  const before = stage === 'implement' ? stages : stages.slice(0, stages.indexOf(stage))
  const statuses = allStatuses(dir, type)
  const blocked = statuses.filter((s) => before.includes(s.stage) && s.status !== 'approved')
  return { ok: blocked.length === 0, type, blocked }
}

export function approve(root, config, name, stage, version) {
  const dir = specDir(root, config, name)
  const type = specType(dir)
  if (!type || type === 'conflict') return { ok: false, message: '명세가 없거나 기능·버그 명세가 섞여 있습니다.' }
  const stages = stagesOf(type)
  if (!stages.includes(stage)) return { ok: false, message: `${SPEC_TYPES[type].label} 명세의 단계는 ${stages.join(', ')} 입니다.` }
  const g = gate(root, config, name, stage)
  if (!g.ok) return { ok: false, message: `${g.blocked[0].stage} 이(가) ${STATUS_LABEL[g.blocked[0].status]} 상태라 ${stage} 를 승인할 수 없습니다.` }
  const hash = stageHash(dir, type, stage)
  if (!hash) return { ok: false, message: `${stage} 문서가 모두 있어야 승인할 수 있습니다.` }
  const { report } = checkSpec(root, config, name)
  const key = stage === stages[0] ? 'first' : stage
  const errs = report.errors.filter((i) => stageOfRule(i.rule) === key || i.rule === 'SPEC001')
  if (errs.length) return { ok: false, message: `${stage} 에 형식 오류가 ${errs.length}건 있어 승인할 수 없습니다. /spec-mirror:check ${name} 로 확인하세요.`, errors: errs }
  const state = readState(dir)
  const basedOn = Object.fromEntries(stages.slice(0, stages.indexOf(stage)).map((s) => [s, state[s]?.hash]))
  state[stage] = { hash, approvedAt: new Date().toISOString(), version, basedOn }
  state.type = type
  fs.writeFileSync(stateFile(dir), JSON.stringify(state, null, 2) + '\n')
  return { ok: true, approvedAt: state[stage].approvedAt, message: `${name}: ${stage} 승인 완료` }
}

/** 명세를 만든 방식: new(새로 만들거나 바꾸는 기능 · 버그) 또는 adopt(기존 코드에서 옮긴 기능) */
export function modeOf(dir) {
  return readState(dir).mode === 'adopt' ? 'adopt' : 'new'
}

export function markAdopt(dir) {
  const state = readState(dir)
  if (state.mode === 'adopt') return false
  state.mode = 'adopt'
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(stateFile(dir), JSON.stringify(state, null, 2) + '\n')
  return true
}

/** 다음에 할 태스크: 그래프 wave 순서로 첫 번째 미완료 필수 태스크 */
export function nextTask(tasks) {
  if (!tasks) return null
  const leaves = new Map(tasks.leaves.map((t) => [t.id, t]))
  const order = Array.isArray(tasks.graph?.waves) ? tasks.graph.waves.flatMap((w) => (Array.isArray(w.tasks) ? w.tasks : [])) : tasks.leaves.map((t) => t.id)
  for (const id of order) {
    const t = leaves.get(id)
    if (t && !t.checked && !t.optional) return t
  }
  return null
}

export function progress(tasks) {
  if (!tasks) return null
  const required = tasks.leaves.filter((t) => !t.optional)
  const optional = tasks.leaves.filter((t) => t.optional)
  const next = nextTask(tasks)
  return {
    required: { done: required.filter((t) => t.checked).length, total: required.length },
    optional: { done: optional.filter((t) => t.checked).length, total: optional.length },
    next: next ? { id: next.id, title: next.title } : null,
  }
}

/** 지금 할 일 하나를 고른다: write(작성·수정) → approve(사용자 승인 대기) → implement → sync */
export function next(root, config, name) {
  const dir = specDir(root, config, name)
  const type = specType(dir)
  if (!type) return { name, type: null, action: 'start', message: '명세가 없습니다. 기능이면 /spec-mirror:spec, 버그면 /spec-mirror:bugfix 로 시작합니다.' }
  if (type === 'conflict') return { name, type, action: 'fix', message: '한 폴더에 requirements.md 와 bugfix.md 가 함께 있습니다.' }
  const { report, tasks } = checkSpec(root, config, name, { draft: true })
  const stages = stagesOf(type)
  const statuses = allStatuses(dir, type)
  const errorsBy = (stage) => report.errors.filter((i) => stageOfRule(i.rule) === (stage === stages[0] ? 'first' : stage)).length
  const base = { name, type, mode: modeOf(dir), stages: statuses.map((s) => ({ ...s, errors: errorsBy(s.stage) })), progress: progress(tasks) }
  for (const s of statuses) {
    if (s.status === 'missing') return { ...base, action: 'write', stage: s.stage, message: `${s.stage} 를 작성합니다.` }
    if (s.status !== 'approved') {
      if (errorsBy(s.stage)) return { ...base, action: 'write', stage: s.stage, message: `${s.stage} 의 형식 오류 ${errorsBy(s.stage)}건을 고칩니다.` }
      return { ...base, action: 'approve', stage: s.stage, message: `${s.stage} 가 ${STATUS_LABEL[s.status]} 상태입니다. 사용자 리뷰와 승인이 필요합니다.` }
    }
  }
  const t = nextTask(tasks)
  if (t) return { ...base, action: 'implement', task: { id: t.id, title: t.title }, message: `다음 태스크: ${t.id}. ${t.title}` }
  return { ...base, action: 'sync', message: '필수 태스크를 모두 마쳤습니다. 명세 동기화로 마무리합니다.' }
}
