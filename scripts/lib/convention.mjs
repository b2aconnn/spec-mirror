// 프로젝트 convention 문서 찾기

import fs from 'node:fs'
import path from 'node:path'
import { rel } from './util.mjs'
import { DEFAULT_CONFIG } from './config.mjs'

/** 파일 이름 패턴(* 만 씀, 대소문자 무시) → 정규식 */
function nameRe(pattern) {
  const body = pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${body}$`, 'i')
}

function walk(dir, visit, skipDir) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!skipDir(e.name, p)) walk(p, visit, skipDir) }
    else if (e.isFile()) visit(p, e.name)
  }
}

/**
 * convention 문서 목록.
 * - conventionDir(기본 docs/convention) 안의 모든 파일
 * - 프로젝트 어디서든 conventionFiles 패턴(기본 convention.md, *-convention.md)에 맞는 파일
 * → { dir, patterns, files }
 */
export function findConventions(root, config) {
  const dir = config.conventionDir ?? DEFAULT_CONFIG.conventionDir
  const patterns = config.conventionFiles ?? DEFAULT_CONFIG.conventionFiles
  const ignore = config.ignoreDirs ?? DEFAULT_CONFIG.ignoreDirs
  const found = new Set()

  const abs = dir ? path.resolve(root, dir) : null
  if (abs && fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    walk(abs, (p) => found.add(rel(root, p)), () => false)
  }

  const res = patterns.map(nameRe)
  if (res.length) {
    walk(root, (p, name) => { if (res.some((re) => re.test(name))) found.add(rel(root, p)) },
      (name, p) => ignore.includes(name) || p === abs)
  }

  return { dir, patterns, files: [...found].sort() }
}
