// 명령줄

import fs from 'node:fs'
import path from 'node:path'
import { readText, rel } from './util.mjs'
import { DEFAULT_CONFIG, NAME_RE, SPEC_TYPES, configFile, findProjectRoot, loadConfig, listSpecs, specDir, specType } from './config.mjs'
import { DESIGN_FILES } from './design.mjs'
import { checkSpec } from './spec.mjs'
import { trace } from './trace.mjs'
import { STATUS_LABEL, allStatuses, approve, gate, next, progress, markAdopt, modeOf } from './state.mjs'
import { checkMap, mapPath, MAP_FILE } from './map.mjs'
import { preHook, postHook, sessionHook } from './hooks.mjs'

export function createCli({ pluginRoot, version }) {
  const ctx = () => {
    const root = findProjectRoot()
    return { root, config: loadConfig(root) }
  }
  const names = (args) => args.filter((a) => !a.startsWith('--'))
  const json = (args) => args.includes('--json')
  const out = (v) => process.stdout.write(JSON.stringify(v, null, 2) + '\n')

  function resolveSpecs(root, config, args) {
    const given = names(args)
    return given.length ? given : listSpecs(root, config)
  }

  function cmdCheck(args) {
    const { root, config } = ctx()
    const specs = resolveSpecs(root, config, args)
    const withMap = names(args).length === 0 && fs.existsSync(mapPath(root, config))
    if (specs.length === 0 && !withMap) { console.error(`검사할 명세가 없습니다. ${config.specRoot}/<이름>/requirements.md 또는 bugfix.md 를 먼저 만드세요.`); return 1 }
    const results = specs.map((n) => checkSpec(root, config, n, { draft: args.includes('--draft') }))
    if (withMap) results.unshift({ name: MAP_FILE, type: 'map', report: checkMap(root, config).report })
    if (json(args)) out(results.map((r) => ({ name: r.name, type: r.type, issues: r.report.issues })))
    else {
      for (const r of results) {
        const errs = r.report.errors.length
        const warns = r.report.warnings.length
        console.log(`\n■ ${r.name} (${r.type === 'map' ? '명세 지도' : SPEC_TYPES[r.type]?.label || '?'})  — 오류 ${errs}, 경고 ${warns}`)
        for (const i of r.report.issues.filter((x) => x.severity !== 'info')) console.log(`  ${i.severity === 'error' ? '오류' : '경고'} ${i.rule}  ${i.file}:${i.line}  ${i.message}`)
        if (errs === 0 && warns === 0) console.log('  형식 검사를 모두 통과했습니다.')
      }
    }
    return results.some((r) => r.report.errors.length) ? 1 : 0
  }

  function cmdTrace(args) {
    const { root, config } = ctx()
    const [name] = names(args)
    if (!name) { console.error('사용법: spec-mirror trace <이름>'); return 2 }
    const t = trace(root, config, name)
    if (json(args)) out(t)
    else if (t.error) console.log(t.error)
    else {
      const bug = t.type === 'bugfix'
      console.log(`\n■ ${t.name} 추적 결과${t.formatErrors ? ` (형식 오류 ${t.formatErrors}건 — check 먼저 확인)` : ''}\n`)
      console.log(bug ? '| 항목 | 명세 | 테스트 | 코드 | 불일치 내용 |\n|---|---|---|---|---|' : '| 기준 | 테스트 | 코드 | 불일치 내용 |\n|---|---|---|---|')
      for (const r of t.rows) {
        const cells = [r.id, ...(bug ? [r.ref] : []), r.tests.join('<br>') || '—', r.code.join('<br>') || '—', r.issues.join(', ') || '—']
        console.log(`| ${cells.join(' | ')} |`)
      }
      if (t.orphans.length) { console.log('\n코드에만 있는 번호 (문서에 없는 기준):'); t.orphans.forEach((o) => console.log(`  - ${o.id} (${o.kind === 'test' ? '테스트' : '코드'}) ${o.where}`)) }
      if (t.orderIssues.length) { console.log('\n처리 흐름 순서와 다른 주석:'); t.orderIssues.forEach((o) => console.log(`  - ${o.where} ${o.message}`)) }
      if (t.messages.length) { console.log('\n코드에서 찾지 못한 메시지:'); t.messages.forEach((m) => console.log(`  - ${m.id} "${m.message}"`)) }
    }
    const bad = t.error || t.orphans.length || t.orderIssues.length || t.messages.length || t.rows.some((r) => r.issues.some((i) => !i.includes('확인 필요')))
    return bad ? 1 : 0
  }

  function cmdStatus(args) {
    const { root, config } = ctx()
    const specs = resolveSpecs(root, config, args)
    const rows = specs.map((name) => {
      const dir = specDir(root, config, name)
      const type = specType(dir)
      const { report, tasks } = checkSpec(root, config, name, { draft: true })
      return { name, type, mode: modeOf(dir), stages: type && type !== 'conflict' ? allStatuses(dir, type) : [], errors: report.errors.length, warnings: report.warnings.length, tasks: progress(tasks), next: next(root, config, name) }
    })
    if (json(args)) { out(rows); return 0 }
    if (rows.length === 0) { console.log(`명세가 없습니다. (${config.specRoot}/<이름>/)`); return 0 }
    for (const o of rows) {
      console.log(`\n■ ${o.name} (${SPEC_TYPES[o.type]?.label || '?'}${o.mode === 'adopt' ? ' · 기존 코드에서 옮김' : ''})  형식 오류 ${o.errors}, 경고 ${o.warnings}`)
      for (const s of o.stages) console.log(`  ${s.stage.padEnd(12)} ${STATUS_LABEL[s.status]}${s.approvedAt ? `  · ${s.approvedAt}` : ''}`)
      if (o.tasks) console.log(`  ${'구현'.padEnd(11)} 필수 ${o.tasks.required.done}/${o.tasks.required.total}, 선택 ${o.tasks.optional.done}/${o.tasks.optional.total}`)
      console.log(`  → ${o.next.message}`)
    }
    return 0
  }

  function cmdNext(args) {
    const { root, config } = ctx()
    const [name] = names(args)
    if (!name) { console.error('사용법: spec-mirror next <이름>'); return 2 }
    const n = next(root, config, name)
    if (json(args)) out(n)
    else console.log(n.message)
    return 0
  }

  function cmdGate(args) {
    const [name, stage] = names(args)
    if (!name || !stage) { console.error('사용법: spec-mirror gate <이름> <단계|implement>'); return 2 }
    const { root, config } = ctx()
    const g = gate(root, config, name, stage)
    if (g.ok) { console.log(`${name}: ${stage} 을(를) 진행할 수 있습니다.`); return 0 }
    if (g.reason) { console.log(`${name}: ${g.reason}`); return 1 }
    for (const b of g.blocked) console.log(`${name}: ${b.stage} 이(가) ${STATUS_LABEL[b.status]} 상태입니다.`)
    console.log(`→ 앞 단계를 사용자에게 보여 주고 승인받은 뒤 진행합니다: /spec-mirror:approve ${name} ${g.blocked[0].stage}`)
    return 1
  }

  function cmdApprove(args) {
    const [name, stage] = names(args)
    if (!name || !stage) { console.error('사용법: spec-mirror approve <이름> <단계>'); return 2 }
    const { root, config } = ctx()
    const r = approve(root, config, name, stage, version)
    if (!r.ok) {
      console.error(r.message)
      for (const e of (r.errors || []).slice(0, 20)) console.error(`  ${e.rule} ${e.file}:${e.line} ${e.message}`)
      return 1
    }
    console.log(`${r.message} (${r.approvedAt})`)
    return 0
  }

  function copyTemplate(src, dest, vars) {
    if (fs.existsSync(dest)) return false
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    let text = readText(src)
    for (const [k, v] of Object.entries(vars)) text = text.split(`{{${k}}}`).join(v)
    fs.writeFileSync(dest, text)
    return true
  }

  function cmdScaffold(args) {
    const [name, stage] = names(args)
    if (name === 'map' && !stage) return scaffoldMap()
    if (!name || !stage) { console.error('사용법: spec-mirror scaffold <이름> <requirements|bugfix|design|tasks> [--adopt] | scaffold map'); return 2 }
    if (!NAME_RE.test(name)) { console.error('이름은 영문 소문자·숫자·하이픈으로 씁니다. (예: order, confirm-recheck-mismatch)'); return 2 }
    const { root, config } = ctx()
    const dir = specDir(root, config, name)
    let type = specType(dir)
    if (type === 'conflict') { console.error('한 폴더에 requirements.md 와 bugfix.md 가 함께 있습니다.'); return 1 }
    if (stage === 'requirements' || stage === 'bugfix') {
      const want = stage === 'requirements' ? 'feature' : 'bugfix'
      if (type && type !== want) { console.error(`${name} 은(는) 이미 ${SPEC_TYPES[type].label} 명세입니다.`); return 1 }
      type = want
    } else if (!type) { console.error(`${name} 에 첫 단계 문서가 없습니다. requirements 또는 bugfix 부터 만듭니다.`); return 1 }
    if (!SPEC_TYPES[type].stages.includes(stage)) { console.error(`${SPEC_TYPES[type].label} 명세의 단계는 ${SPEC_TYPES[type].stages.join(', ')} 입니다.`); return 2 }
    if (args.includes('--adopt')) {
      if (type !== 'feature') { console.error('--adopt 는 기능 명세에만 씁니다.'); return 2 }
      if (markAdopt(dir)) console.log(`${name}: 기존 코드에서 옮기는 명세(adopt)로 표시했습니다.`)
    }
    const tpl = path.join(pluginRoot, 'templates', type)
    const pairs = stage === 'design' && type === 'feature'
      ? ['design.md', ...DESIGN_FILES.map((d) => `design/${d.file}`)]
      : [`${stage}.md`]
    const source = (p) => (stage === 'tasks' && type === 'feature' && modeOf(dir) === 'adopt' ? path.join(pluginRoot, 'templates', 'adopt', 'tasks.md') : path.join(tpl, p))
    const created = pairs.filter((p) => copyTemplate(source(p), path.join(dir, p), { NAME: name }))
    console.log(created.length ? `만든 파일:\n${created.map((p) => `  ${rel(root, path.join(dir, p))}`).join('\n')}` : '이미 모든 파일이 있습니다. 덮어쓰지 않았습니다.')
    return 0
  }

  function scaffoldMap() {
    const { root, config } = ctx()
    const dest = mapPath(root, config)
    if (!copyTemplate(path.join(pluginRoot, 'templates', 'map.md'), dest, {})) { console.log(`이미 있습니다: ${rel(root, dest)}`); return 0 }
    console.log(`만든 파일: ${rel(root, dest)}`)
    return 0
  }

  function cmdMap(args) {
    const { root, config } = ctx()
    const { report, doc } = checkMap(root, config)
    if (!doc) { console.error(`명세 지도가 없습니다. spec-mirror scaffold map 으로 ${rel(root, mapPath(root, config))} 를 만듭니다.`); return 1 }
    const rows = doc.rows.map((r) => {
      const n = r.name ? next(root, config, r.name) : null
      return { order: r.order, name: r.name, scope: r.scope, related: r.related, type: n?.type || null, mode: n?.mode || null, action: n?.action || null, message: n?.message || null, progress: n?.progress || null }
    })
    if (json(args)) { out({ rows, issues: report.issues }); return report.errors.length ? 1 : 0 }
    console.log(`\n■ 명세 지도 ${rel(root, mapPath(root, config))}  — 오류 ${report.errors.length}, 경고 ${report.warnings.length}`)
    for (const i of report.issues.filter((x) => x.severity !== 'info')) console.log(`  ${i.severity === 'error' ? '오류' : '경고'} ${i.rule}  ${i.file}:${i.line}  ${i.message}`)
    console.log('\n| 순서 | 기능 | 범위 | 상태 |\n|---|---|---|---|')
    for (const r of rows) console.log(`| ${r.order} | ${r.name || '?'} | ${r.scope || ''} | ${r.type ? r.message : '명세 없음'} |`)
    return report.errors.length ? 1 : 0
  }

  function cmdInit() {
    const root = findProjectRoot()
    const file = configFile(root)
    if (fs.existsSync(file)) { console.log(`이미 설정되어 있습니다: ${rel(root, file)}`); return 0 }
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const { specRoot, techContext, extraItemLabels, testPathPatterns } = DEFAULT_CONFIG
    fs.writeFileSync(file, JSON.stringify({ specRoot, techContext, extraItemLabels, testPathPatterns }, null, 2) + '\n')
    fs.mkdirSync(path.join(root, specRoot), { recursive: true })
    console.log(`만든 파일: ${rel(root, file)}\n명세 위치: ${specRoot}/`)
    return 0
  }

  function cmdList(args) {
    const { root, config } = ctx()
    const rows = listSpecs(root, config).map((name) => ({ name, type: specType(specDir(root, config, name)) }))
    if (json(args)) out(rows)
    else rows.forEach((r) => console.log(`${r.name}\t${SPEC_TYPES[r.type]?.label || r.type}`))
    return 0
  }

  function help() {
    console.log(`spec-mirror ${version}

  check    [이름...] [--json] [--draft]  명세 형식 검사 (오류가 있으면 종료 코드 1)
  trace    <이름> [--json]               명세 ↔ 테스트 ↔ 코드 추적표
  status   [이름...] [--json]            단계별 승인 상태, 태스크 진행률, 다음 할 일
  next     <이름> [--json]               지금 할 일 하나 (write / approve / implement / sync)
  gate     <이름> <단계|implement>       앞 단계가 승인되어 있는지 확인
  approve  <이름> <단계>                 단계 승인 기록 (형식 오류가 없어야 함)
  scaffold <이름> <단계> [--adopt]       빈 템플릿 생성 (기존 파일은 덮어쓰지 않음). --adopt 는 기존 코드에서 옮기는 명세
  scaffold map                           명세 지도(<specRoot>/README.md) 템플릿 생성
  map      [--json]                      명세 지도 검사와 기능별 진행 상황
  list     [--json]                      명세 목록
  init                                   .spec-mirror/config.json 생성
  hook     <pre|post|session>            Claude Code 훅 진입점

  기능 명세 단계: requirements → design → tasks
  버그 명세 단계: bugfix → design → tasks`)
  }

  return async function main(argv) {
    const [cmd, ...args] = argv
    switch (cmd) {
      case 'check': return cmdCheck(args)
      case 'trace': return cmdTrace(args)
      case 'status': return cmdStatus(args)
      case 'next': return cmdNext(args)
      case 'gate': return cmdGate(args)
      case 'approve': return cmdApprove(args)
      case 'scaffold': return cmdScaffold(args)
      case 'list': return cmdList(args)
      case 'map': return cmdMap(args)
      case 'init': return cmdInit()
      case 'hook':
        if (args[0] === 'pre') return preHook()
        if (args[0] === 'post' || args[0] === undefined) return postHook()
        if (args[0] === 'session') return sessionHook()
        console.error('사용법: spec-mirror hook <pre|post|session>')
        return 2
      case '--version': case '-v': console.log(version); return 0
      default: help(); return cmd && cmd !== 'help' && cmd !== '--help' ? 2 : 0
    }
  }
}
