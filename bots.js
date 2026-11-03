// 検証用の bot（ページ内で動かす）。window.__bot(kind) で nm.dbg.input に渡す入力関数を返す
window.__bot = function (kind) {
  const nm = window.nm, M = nm.M
  const aim = (p) => { const d = { x: p.x - M.pos.x, y: p.y - M.pos.y, z: p.z - M.pos.z }; const h = Math.hypot(d.x, d.z); nm.dbg.setCam(Math.atan2(-d.x, -d.z), Math.atan2(d.y, h)); return Math.hypot(h, d.y) }
  const st = { target: null, phase: 'go', t: 0, sucked: 0, wait: 0 }
  if (kind === 'idle') return () => ({ sx: 0, sy: 0, v: 0, bite: false })
  if (kind === 'reckless') {
    // 顔（おでこ・ほっぺ）にまっすぐ行って、お腹いっぱいまで吸い続ける
    return () => {
      const people = nm.people()
      if (M.state === 'suck' || M.state === 'land') return { sx: 0, sy: 0, v: 0, bite: M.full >= 0.999 }
      let best = null, bd = 9
      for (const p of people) for (const s of p.spots) if (s.ok && s.face && s.stock > 0 && p.state === 'sleep') { const d = s.w.distanceTo(M.pos); if (d < bd) { bd = d; best = s } }
      if (!best) return { sx: 0, sy: 0, v: 0, bite: false }
      const d = aim(best.w)
      const g = nm.glow()
      return { sx: 0, sy: d > 0.05 ? 1 : 0.2, v: 0, bite: !!g }
    }
  }
  // 上手: 顔と毛深い足を避け、足元から近づく。起きかけたら離れる。重くなったら天井で消化
  return () => {
    const people = nm.people(), W = nm.W
    st.t += 1 / 60
    const heads = people.map(p => p.headPos)
    const nearHead = Math.min(...heads.map(h => h.distanceTo(M.pos)))
    if (M.state === 'suck' || M.state === 'land') {
      const o = M.perch && M.perch.owner
      st.sucked += 1 / 60
      const leave = !o || o.alert > 0.42 || M.full > 0.9 || (M.perch && M.perch.stock <= 0)
      if (leave) { st.target = null; st.phase = 'flee'; st.t = 0; st.sucked = 0; return { sx: 0, sy: 0, v: 0, bite: true } }
      return { sx: 0, sy: 0, v: 0, bite: false }
    }
    if (M.state === 'rest') {
      st.wait += 1 / 60
      const go = M.full < 0.15 || (W.light > 0 && st.wait > 1.5)
      if (go) { st.wait = 0; st.phase = 'go'; return { sx: 0, sy: 0, v: 1, bite: true } }
      return { sx: 0, sy: 0, v: 0, bite: false }
    }
    // 重い → 天井へ（人から遠い所）
    if (M.full > 0.85 || st.phase === 'rest') {
      st.phase = 'rest'
      const c = { x: -0.2, y: 2.36, z: 0.9 }
      const d = aim(c)
      return { sx: 0, sy: 1, v: 0, bite: d < 0.12 }
    }
    if (st.phase === 'flee') {
      const c = { x: M.pos.x, y: 1.1, z: 0.6 }
      if (aim(c) < 0.2 || st.t > 3) st.phase = 'go'
      return { sx: 0, sy: 1, v: 0, bite: false }
    }
    // 目標: 起きかけていない人の、顔でも毛深くもない、まだ出る所
    if (!st.target || !st.target.ok || st.target.stock <= 0.02 || st.target.owner.alert > 0.3 || st.target.owner.state !== 'sleep') {
      let best = null, bd = 99
      for (const p of people) { if (p.state !== 'sleep' || p.alert > 0.25) continue; for (const s of p.spots) { if (!s.ok || s.face || s.hairy || s.stock <= 0.02) continue; const d = s.w.distanceTo(M.pos) + s.w.distanceTo(p.headPos) * -0.3; if (d < bd) { bd = d; best = s } } }
      st.target = best
    }
    if (!st.target) { aim({ x: 0, y: 1.2, z: 0.8 }); return { sx: 0, sy: 0.6, v: 0, bite: false } }
    const s = st.target
    // 足元側の上から近づく（頭から遠いほう）
    const hp = s.owner.headPos
    const away = { x: s.w.x - hp.x, z: s.w.z - hp.z }; const al = Math.hypot(away.x, away.z) || 1
    const ap = { x: s.w.x + away.x / al * 0.18, y: s.w.y + 0.22, z: s.w.z + away.z / al * 0.18 }
    const dAp = Math.hypot(ap.x - M.pos.x, ap.y - M.pos.y, ap.z - M.pos.z)
    const dS = s.w.distanceTo(M.pos)
    const tgt = dAp > 0.08 && dS > 0.25 ? ap : s.w
    const d = aim(tgt)
    if (nearHead < 0.5 && tgt === ap) { return { sx: 0, sy: 1, v: 1, bite: false } }
    const g = nm.glow()
    return { sx: 0, sy: d > 0.04 ? 1 : 0.3, v: 0, bite: !!(g && g === s) || !!(g && !g.face && !g.hairy && dS < 0.15) }
  }
}
