// 프로젝트 루트 · 설정 · 명세 폴더

import fs from 'node:fs'
import path from 'node:path'
import { readText } from './util.mjs'

export const SPEC_TYPES = {
  feature: { label: '기능', stages: ['requirements', 'design', 'tasks'], firstFile: 'requirements.md' },
  bugfix: { label: '버그', stages: ['bugfix', 'design', 'tasks'], firstFile: 'bugfix.md' },
}

export const DEFAULT_CONFIG = {
  specRoot: 'docs/spec',
  stageGate: true,
  techContext: ['CLAUDE.md', 'README.md'],
  extraItemLabels: [],
  testPathPatterns: [
    '(^|/)(test|tests|__tests__|spec|specs)/',
    '(Test|Tests|Spec|IT)\\.[A-Za-z]+$',
    '[._-](test|spec)\\.[A-Za-z]+$',
    '_test\\.[A-Za-z]+$',
  ],
  ignoreDirs: [
    '.git', 'node_modules', 'build', 'dist', 'out', 'target', '.gradle', '.idea', '.vscode',
    'vendor', '.next', 'coverage', '.venv', 'venv', '__pycache__',
  ],
  sourceExtensions: [
    'kt', 'kts', 'java', 'scala', 'groovy', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go',
    'rs', 'rb', 'php', 'cs', 'swift', 'm', 'c', 'cc', 'cpp', 'h', 'hpp', 'dart', 'ex', 'exs',
    'sql', 'sh', 'yml', 'yaml', 'xml', 'vue', 'svelte',
  ],
}

export const NAME_RE = /^[a-z0-9][a-z0-9-]*$/

export function configFile(root) {
  return path.join(root, '.spec-mirror', 'config.json')
}

/** .spec-mirror/config.json 이 있는 가장 가까운 상위 폴더, 없으면 Git 루트, 그것도 없으면 시작 폴더. */
export function findProjectRoot(start = process.cwd()) {
  let dir = path.resolve(start)
  let gitRoot = null
  for (;;) {
    if (fs.existsSync(configFile(dir))) return dir
    if (!gitRoot && fs.existsSync(path.join(dir, '.git'))) gitRoot = dir
    const parent = path.dirname(dir)
    if (parent === dir) return gitRoot || path.resolve(start)
    dir = parent
  }
}

export function hasConfig(root) {
  return fs.existsSync(configFile(root))
}

export function loadConfig(root) {
  const file = configFile(root)
  if (!fs.existsSync(file)) return { ...DEFAULT_CONFIG }
  let user
  try {
    user = JSON.parse(readText(file))
  } catch (e) {
    throw new Error(`.spec-mirror/config.json 을 읽을 수 없습니다: ${e.message}`)
  }
  return { ...DEFAULT_CONFIG, ...user }
}

export function specDir(root, config, name) {
  return path.join(root, config.specRoot, name)
}

/** 명세 종류: requirements.md → feature, bugfix.md → bugfix, 둘 다 → conflict, 없음 → null */
export function specType(dir) {
  const feature = fs.existsSync(path.join(dir, SPEC_TYPES.feature.firstFile))
  const bugfix = fs.existsSync(path.join(dir, SPEC_TYPES.bugfix.firstFile))
  if (feature && bugfix) return 'conflict'
  if (feature) return 'feature'
  if (bugfix) return 'bugfix'
  return null
}

export function listSpecs(root, config) {
  const base = path.join(root, config.specRoot)
  if (!fs.existsSync(base)) return []
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .filter((d) => specType(path.join(base, d.name)))
    .map((d) => d.name)
    .sort()
}
