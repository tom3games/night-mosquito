// 検証用の bot（ページ内で動かす）。window.__bot(kind) で nm.dbg.input に渡す入力関数を返す
// idle: 何もしない / wander: 適当に飛ぶ（見ない）/ circle: 全速で部屋を周回 / ceil: 天井に張り付く / corner: 隅に隠れる
// human: 人間の速さで見てよける（反応0.4秒・カメラに入っている物だけ見る・0.12秒ごとに判断）/ pro: よく見える上手い人（反応0.15秒・全部見える）
window.__bot = function (kind) {
  const nm = window.nm, M = nm.M, R = nm.ROOM
  let s = 987654 ^ (nm.W ? nm.W.seed : 1); const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  // 世界の方向の速度を、今のカメラ向きのスティックに直す
  const toStick = (vx, vy, vz) => {
    const yaw = nm.camYaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw)
    let sx = vx * rx + vz * rz, sy = vx * fx + vz * fz; const m = Math.hypot(sx, sy); if (m > 1) { sx /= m; sy /= m }
    return { sx, sy, v: Math.max(-1, Math.min(1, vy)) }
  }
  if (kind === 'idle') return () => ({ sx: 0, sy: 0, v: 0 })
  if (kind === 'wander') { let t = 0, c = { sx: 0, sy: 0, v: 0 }; return () => { t -= 1 / 60; if (t <= 0) { t = 0.5 + rnd() * 1.2; const a = rnd() * 6.283; c = { sx: Math.cos(a), sy: Math.sin(a), v: rnd() < .3 ? (rnd() < .5 ? 1 : -1) : 0 } } return c } }
  if (kind === 'circle') return () => { const a = Math.atan2(M.pos.z, M.pos.x) + 1.4, r = Math.hypot(M.pos.x, M.pos.z), out = r < 2.3 ? 0.5 : r > 2.6 ? -0.5 : 0; return toStick(-Math.sin(a - 1.4) * 1 + Math.cos(a - 1.4) * out, 1.25 - M.pos.y, Math.cos(a - 1.4) * 1 + Math.sin(a - 1.4) * out) }
  if (kind === 'ceil') return () => toStick(0, 1, 0)
  if (kind === 'corner') return () => toStick(2.85 - M.pos.x, 2.48 - M.pos.y, 2.85 - M.pos.z)
  const human = kind === 'human'
  const react = human ? 0.4 : 0.15, every = human ? 0.12 : 0.05, fov = human ? 1.0 : 9, horizon = human ? 0.36 : 0.42
  let cool = 0, c = { x: 1, y: 0, z: 0 }
  const danger = (x, y, z, th) => {
    let d = 0
    for (const t of th) {
      if (t.type === 'point') { const dd = Math.hypot(x - t.pos.x, y - t.pos.y, z - t.pos.z); if (dd < t.r + 0.32) d += 60 * (1 - dd / (t.r + 0.32)) + 40 }
      else if (t.type === 'cone') { const ax = x - t.o.x, ay = y - t.o.y, az = z - t.o.z, al = ax * t.dir.x + ay * t.dir.y + az * t.dir.z; if (al > 0 && al < t.L + 0.2) { const rr = Math.hypot(ax - t.dir.x * al, ay - t.dir.y * al, az - t.dir.z * al); if (rr < al * Math.tan(t.half) + 0.3) d += 45 } }
      else if (t.type === 'sector') { const hd = Math.hypot(x - t.c.x, z - t.c.z); if (hd < t.r1 + 0.3 && Math.abs(y - t.h) < t.dy + 0.2) { const a = Math.atan2(x - t.c.x, z - t.c.z) - Math.atan2(t.dir.x, t.dir.z), w = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); if (w < t.half + 0.3) d += 45 } }
      else if (t.type === 'ball') { for (const k of [0, 0.15, 0.3, 0.45]) { const bx = t.pos.x + t.vel.x * k, by = t.pos.y + t.vel.y * k, bz = t.pos.z + t.vel.z * k; const dd = Math.hypot(x - bx, y - by, z - bz); if (dd < t.r + 0.32) d += 30 } }
      else if (t.type === 'column') { if (Math.hypot(x - t.x, z - t.z) < t.r + 0.25 && y < t.h + 0.15) d += 40 }
    }
    return d
  }
  return () => {
    cool -= 1 / 60
    if (cool <= 0) {
      cool = every
      const yaw = nm.camYaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw)
      const th = nm.threats().filter(t => {
        if ((t.age ?? 9) < react) return false
        if (!human) return true
        // カメラの視野（横にかなり狭い）に入っている物だけ見える。ただし赤い輪が自分のすぐ近くなら気づく
        const p = t.pos || t.o || t.c; if (!p) return true
        const dx = (p.x ?? t.x) - M.pos.x, dz = (p.z ?? t.z) - M.pos.z, dd = Math.hypot(dx, dz)
        if (dd < 1.2) return true
        return (dx * fx + dz * fz) / (dd || 1) > Math.cos(fov)
      })
      const fog = nm.W.fogY || 0
      let best = 1e9, bx = 0, by = 0, bz = 0
      const nearest = nm.people().reduce((a, p) => { const d = Math.hypot(p.pos.x - M.pos.x, p.pos.z - M.pos.z); return d < a.d ? { d, p } : a }, { d: 99, p: null })
      for (let i = 0; i < 16; i++) for (const vy of [-1, 0, 1]) {
        const a = i / 16 * 6.283, vx = Math.cos(a), vz = Math.sin(a)
        const x = M.pos.x + vx * 2.35 * horizon, y = M.pos.y + vy * 1.75 * horizon, z = M.pos.z + vz * 2.35 * horizon
        let cost = danger(x, y, z, th) + danger(M.pos.x + vx * 0.5, M.pos.y + vy * 0.4, M.pos.z + vz * 0.5, th) * 0.6
        // 今の向きを保つ（迷うと止まって当たる）
        cost += (1 - (vx * c.x + vz * c.z)) * 2.2 + (vy !== c.y ? 0.8 : 0)
        // 壁際・隅は逃げ場がない。部屋の真ん中寄りが楽
        const wall = Math.min(R.x1 - Math.abs(x), R.z1 - Math.abs(z))
        if (wall < 1.0) cost += (1.0 - wall) * 16
        if (nearest.p) { const pd = Math.hypot(nearest.p.pos.x - x, nearest.p.pos.z - z); if (pd < 1.7) cost += (1.7 - pd) * 7 }
        if (y < fog + 0.35) cost += 50
        cost += Math.abs(y - Math.max(1.2, fog + 0.6)) * 2
        if (human) cost += rnd() * 1.5
        if (cost < best) { best = cost; bx = vx; by = vy; bz = vz }
      }
      c = { x: bx, y: by, z: bz }
    }
    return toStick(c.x, c.y, c.z)
  }
}
