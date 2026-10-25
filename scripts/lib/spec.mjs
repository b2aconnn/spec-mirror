// 명세 하나(기능 또는 버그)를 종류에 맞게 검사한다

import fs from 'node:fs'
import path from 'node:path'
import { Report, rel, readText, maskFences, maskInlineCode } from './util.mjs'
import { specDir, specType } from './config.mjs'
import { checkRequirements, parseRequirements } from './requirements.mjs'
import { checkDesign, DESIGN_FILES } from './design.mjs'
import { checkTasks } from './tasks.mjs'
import { checkBugfix, checkBugfixDesign, checkBugfixTasks } from './bugfix.mjs'

export function featureLoader(root, config) {
  const cache = new Map()
  return (name) => {
    if (!cache.has(name)) {
      const file = path.join(specDir(root, config, name), 'requirements.md')
      cache.set(name, fs.existsSync(file) ? parseRequirements(file) : null)
    }
    return cache.get(name)
  }
}

/** 템플릿 자리표시자(<...>)가 남아 있는지. 코드 블록 · 인라인 코드 · HTML 태그는 보지 않는다. */
export const PLACEHOLDER_RE = /<(?![/!]?[a-z][a-z0-9]*\b[^<>]*>)[^<>\s=\-`][^<>`]{0,40}>/g
export function checkPlaceholders(file, rule, root, report) {
  if (!fs.existsSync(file)) return 0
  const lines = maskFences(readText(file).split('\n'))
  let count = 0
  lines.forEach((line, i) => {
    const found = maskInlineCode(line).match(PLACEHOLDER_RE)
    if (!found) return
    count += found.length
    report.error(rule, rel(root, file), i + 1, `채우지 않은 자리표시자 ${found.join(' ')} — 실제 내용으로 바꿉니다.`)
  })
  return count
}

function placeholderPass(root, dir, type, report) {
  const files = type === 'feature'
    ? [['requirements.md', 'REQ000'], ['design.md', 'DES000'], ...DESIGN_FILES.map((d) => [`design/${d.file}`, 'DES000']), ['tasks.md', 'TSK000']]
    : [['bugfix.md', 'BUG000'], ['design.md', 'BDS000'], ['tasks.md', 'TSK000']]
  for (const [file, rule] of files) checkPlaceholders(path.join(dir, file), rule, root, report)
}

export function checkSpec(root, config, name, { draft = false } = {}) {
  const result = checkSpecDocs(root, config, name, { draft })
  if (result.type === 'feature' || result.type === 'bugfix') placeholderPass(root, result.dir, result.type, result.report)
  return result
}

function checkSpecDocs(root, config, name, { draft = false } = {}) {
  const dir = specDir(root, config, name)
  const type = specType(dir)
  const report = new Report()
  const result = { name, dir, type, report, first: null, design: null, tasks: null }
  const tasksFile = path.join(dir, 'tasks.md')

  if (!type) {
    report.error('SPEC001', rel(root, dir), 1, `명세가 없습니다. ${rel(root, dir)}/requirements.md(기능) 또는 bugfix.md(버그) 가 있어야 합니다.`)
    return result
  }
  if (type === 'conflict') {
    report.error('SPEC001', rel(root, dir), 1, '한 폴더에 requirements.md 와 bugfix.md 가 함께 있습니다. 기능 명세와 버그 명세는 폴더를 나눕니다.')
    return result
  }

  if (type === 'feature') {
    result.first = checkRequirements(path.join(dir, 'requirements.md'), root, config, report, { loadFeature: featureLoader(root, config) })
    const hasDesign = fs.existsSync(path.join(dir, 'design.md')) || fs.existsSync(path.join(dir, 'design'))
    if (hasDesign) result.design = checkDesign(dir, result.first, root, report, { draft })
    if (fs.existsSync(tasksFile)) {
      const properties = result.design?.propertiesFile ? result.design.properties : null
      result.tasks = checkTasks(tasksFile, { refDoc: result.first, properties, root, report, draft, refLabel: 'requirements' })
    }
    return result
  }

  result.first = checkBugfix(path.join(dir, 'bugfix.md'), root, config, report, { loadFeature: featureLoader(root, config) })
  const designFile = path.join(dir, 'design.md')
  if (fs.existsSync(path.join(dir, 'design'))) report.error('BDS001', rel(root, path.join(dir, 'design')), 1, '버그 명세의 design 은 design.md 한 파일입니다. design/ 폴더를 쓰지 않습니다.')
  if (fs.existsSync(designFile)) result.design = checkBugfixDesign(designFile, result.first, root, report, { draft })
  if (fs.existsSync(tasksFile)) {
    result.tasks = checkTasks(tasksFile, { refDoc: result.first, properties: result.design?.properties || null, root, report, draft, refLabel: 'bugfix' })
    checkBugfixTasks(tasksFile, result.design, root, report)
  }
  return result
}

/** 규칙 ID 가 어느 단계 문서의 것인지 */
export function stageOfRule(rule) {
  if (/^(REQ|BUG)/.test(rule)) return 'first'
  if (/^(DES|BDS)/.test(rule)) return 'design'
  if (/^(TSK|BTK)/.test(rule)) return 'tasks'
  return 'first'
}
