// 기준 참조 (N.M)

/** "1.2, 1.3", "1.1 ~ 1.17", "6.1~6.25" 를 [N, M, 원문] 목록으로 펼친다. */
export function expandRefs(text) {
  const refs = []
  const re = /(\d+)\.(\d+)(?:\s*~\s*(\d+)\.(\d+))?/g
  let m
  while ((m = re.exec(text))) {
    const n = Number(m[1])
    const a = Number(m[2])
    if (m[3]) {
      const n2 = Number(m[3])
      const b = Number(m[4])
      if (n2 === n && b >= a) for (let k = a; k <= b; k++) refs.push([n, k, m[0]])
      else refs.push([n, a, m[0]], [n2, b, m[0]])
    } else refs.push([n, a, m[0]])
  }
  return refs
}

/**
 * doc.requirements = [{ number, criteria: [{ number }] }] 형태면 무엇이든 받는다.
 * requirements.md 는 Requirement N / 기준 M, bugfix.md 는 1·2·3 묶음 / 항목 M 이다.
 */
export function refExists(doc, n, m) {
  const r = doc?.requirements.find((x) => x.number === n)
  return Boolean(r && r.criteria.some((c) => c.number === m))
}

export function allRefs(doc) {
  return doc.requirements.flatMap((r) => r.criteria.map((c) => `${r.number}.${c.number}`))
}
