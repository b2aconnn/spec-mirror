#!/usr/bin/env node
// spec-mirror — 명세 형식 검사 · 단계 승인 · 추적 CLI
// 외부 의존성 없음. Node.js 18 이상.  사용법: node spec-mirror.mjs help

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCli } from './lib/cli.mjs'

export * from './lib/config.mjs'
export * from './lib/refs.mjs'
export { parseRequirements, checkRequirements } from './lib/requirements.mjs'
export { parseDesign, checkDesign, DESIGN_FILES } from './lib/design.mjs'
export { parseTasks, checkTasks } from './lib/tasks.mjs'
export { parseBugfix, parseSpecLink, checkBugfix, parseBugfixDesign, checkBugfixDesign, checkBugfixTasks } from './lib/bugfix.mjs'
export { checkSpec } from './lib/spec.mjs'
export { stageHash, stageStatus, allStatuses, gate, approve, next } from './lib/state.mjs'
export { trace } from './lib/trace.mjs'
export { checkMap, parseMap } from './lib/map.mjs'

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const VERSION = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version

export const main = createCli({ pluginRoot: PLUGIN_ROOT, version: VERSION })

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code },
    (e) => { console.error(`[spec-mirror] ${e.message}`); process.exitCode = 2 },
  )
}
