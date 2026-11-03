// 夜の和室（8畳）。畳・土壁・障子・ふすま・天井・電灯・扇風機・蚊取り線香・布団。CC0 の家具素材が手元に無いので手続き生成で作り込む
import * as THREE from 'three'

export const ROOM = { x0: -1.8, x1: 1.8, z0: -1.8, z1: 1.8, h: 2.4 }
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647 })()

function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]) }
  return t
}
function noise(g, w, h, n, col, a) { for (let i = 0; i < n; i++) { g.fillStyle = col(); g.globalAlpha = a * (0.4 + rnd() * 0.6); g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2) } g.globalAlpha = 1 }

// 畳1枚（0.9 x 1.8）。い草の目と黒い縁
const tatamiTex = () => canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#b9b27a'; g.fillRect(0, 0, w, h)
  for (let y = 0; y < h; y += 3) { g.fillStyle = y % 6 ? '#a9a26a' : '#c4bd86'; g.fillRect(0, y, w, 1.4) }
  for (let x = 0; x < w; x += 18) { g.fillStyle = 'rgba(80,70,40,.18)'; g.fillRect(x, 0, 1, h) }
  noise(g, w, h, 3000, () => rnd() < .5 ? '#8f8a55' : '#d6d0a0', 0.25)
  g.fillStyle = '#1d2420'; g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h)
  g.fillStyle = 'rgba(255,255,255,.08)'; for (let y = 0; y < h; y += 8) { g.fillRect(3, y, 8, 3); g.fillRect(w - 11, y, 8, 3) }
})
const wallTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b8a888'; g.fillRect(0, 0, w, h)
  noise(g, w, h, 9000, () => ['#a89878', '#c6b898', '#9c8c6c', '#d0c4a6'][Math.floor(rnd() * 4)], 0.5)
}, [3, 2])
const woodTex = (base = '#6b4a2e', line = '#4e331d') => canvasTex(128, 512, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h)
  for (let i = 0; i < 40; i++) { g.strokeStyle = line; g.globalAlpha = .25 + rnd() * .3; g.lineWidth = 1 + rnd() * 2; g.beginPath(); const x = rnd() * w; g.moveTo(x, 0); g.bezierCurveTo(x + 8 - rnd() * 16, h * .3, x + 8 - rnd() * 16, h * .7, x + 4 - rnd() * 8, h); g.stroke() }
  g.globalAlpha = 1
})
const ceilTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#8a6a48'; g.fillRect(0, 0, w, h)
  for (let x = 0; x < w; x += 64) { g.fillStyle = x % 128 ? '#7d5f40' : '#94744f'; g.fillRect(x, 0, 62, h); g.fillStyle = '#4a3420'; g.fillRect(x + 62, 0, 2, h)
    for (let i = 0; i < 8; i++) { g.strokeStyle = 'rgba(60,40,20,.35)'; g.beginPath(); const xx = x + rnd() * 60; g.moveTo(xx, 0); g.bezierCurveTo(xx + 10, h * .3, xx - 10, h * .6, xx + 4, h); g.stroke() } }
}, [2, 2])
// 布団の柄（白地に紺の格子・母は花・子どもは水色）
const futonTex = (kind) => canvasTex(256, 256, (g, w, h) => {
  const base = { dad: '#e8e4da', mom: '#efe2e2', kid: '#dbe9ef', gramps: '#e6e0cc' }[kind]
  g.fillStyle = base; g.fillRect(0, 0, w, h)
  if (kind === 'dad' || kind === 'gramps') { g.strokeStyle = kind === 'dad' ? '#3b4f7a' : '#6b5a3a'; g.lineWidth = 3; for (let i = 0; i <= w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke() } }
  if (kind === 'mom') { for (let i = 0; i < 26; i++) { const x = rnd() * w, y = rnd() * h; g.fillStyle = '#c75d6a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.256) * 6, y + Math.sin(k * 1.256) * 6, 4.5, 0, 7); g.fill() } g.fillStyle = '#f4d35e'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill() } }
  if (kind === 'kid') { for (let i = 0; i < 18; i++) { g.fillStyle = '#4a8db5'; g.save(); g.translate(rnd() * w, rnd() * h); g.rotate(rnd() * 6); g.fillRect(-9, -3, 18, 6); g.fillRect(-3, -9, 6, 18); g.restore() } }
  noise(g, w, h, 1200, () => '#000', 0.04)
}, [1, 1])
// タオルケット（しま模様）
const towelTex = (c1, c2) => canvasTex(128, 128, (g, w, h) => { for (let y = 0; y < h; y += 16) { g.fillStyle = (y / 16) % 2 ? c1 : c2; g.fillRect(0, y, w, 16) } noise(g, w, h, 1500, () => '#fff', 0.08) }, [2, 3])
const shojiTex = (lit) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = lit ? '#e9eef8' : '#d8dbe0'; g.fillRect(0, 0, w, h)
  noise(g, w, h, 2500, () => '#fff', 0.15)
  g.fillStyle = '#5a4030'; for (let x = 0; x <= w; x += 64) g.fillRect(x - 3, 0, 6, h); for (let y = 0; y <= h; y += 52) g.fillRect(0, y - 3, w, 6)
})
const fusumaTex = () => canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#d9cfb4'; g.fillRect(0, 0, w, h)
  noise(g, w, h, 4000, () => rnd() < .5 ? '#cbbf9f' : '#e6dcc2', 0.4)
  g.strokeStyle = '#7a8b6a'; g.lineWidth = 3; g.globalAlpha = .55   // 山並み
  g.beginPath(); g.moveTo(0, h * .62); for (let x = 0; x <= w; x += 16) g.lineTo(x, h * .62 - Math.abs(Math.sin(x * .03)) * 60 - (x % 48 === 0 ? 20 : 0)); g.stroke()
  g.globalAlpha = 1; g.fillStyle = '#3a2a1c'; g.beginPath(); g.ellipse(w * .82, h * .5, 10, 26, 0, 0, 7); g.fill()   // 引手
  g.strokeStyle = '#2a1e14'; g.lineWidth = 10; g.strokeRect(0, 0, w, h)
})

const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o })

export function buildRoom(scene, opts = {}) {
  const R = ROOM, W = R.x1 - R.x0, D = R.z1 - R.z0
  const g = new THREE.Group(); scene.add(g)
  const solids = []   // 蚊がぶつかる箱 {min,max}
  const box = (w, h, d, mat, x, y, z, solid = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); m.castShadow = m.receiveShadow = !opts.low; if (solid) solids.push({ min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2) }); return m }

  // 畳（8枚。向きを互い違いに）
  const tt = tatamiTex()
  const tm = M({ map: tt, roughness: 0.9 })
  const lay = [[-1.35, -0.9, 0], [-1.35, 0.9, 0], [-0.45, -0.9, 0], [-0.45, 0.9, 0], [0.9, -1.35, 1], [0.9, -0.45, 1], [0.9, 0.45, 1], [0.9, 1.35, 1]]
  for (const [x, z, rot] of lay) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 1.8), tm)
    m.position.set(x, -0.02, z); if (rot) m.rotation.y = Math.PI / 2; m.receiveShadow = true; g.add(m)
  }
  // 壁・天井
  const wm = M({ map: wallTex(), roughness: 1 })
  const wall = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wm); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m); return m }
  wall(W, R.h, 0, R.h / 2, R.z0, 0)                // 奥（枕側）
  wall(D, R.h, R.x0, R.h / 2, 0, Math.PI / 2)      // 左
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M({ map: ceilTex(), roughness: 0.8 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = R.h; g.add(ceil)
  // 長押（なげし）と柱
  const wood = M({ map: woodTex(), roughness: 0.7 })
  box(W, 0.08, 0.05, wood, 0, 1.85, R.z0 + 0.025, false); box(0.05, 0.08, D, wood, R.x0 + 0.025, 1.85, 0, false)
  for (const [x, z] of [[R.x0 + 0.05, R.z0 + 0.05], [R.x1 - 0.05, R.z0 + 0.05], [R.x0 + 0.05, R.z1 - 0.05], [R.x1 - 0.05, R.z1 - 0.05]]) box(0.1, R.h, 0.1, wood, x, R.h / 2, z, false)
  // 右の壁: 障子（外は月）。障子の外から月明かり
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.2, 1.75), M({ map: shojiTex(true), emissive: 0x6b7da6, emissiveIntensity: 0.55, roughness: 1 }))
  sh.position.set(R.x1, 0.92, 0); sh.rotation.y = -Math.PI / 2; g.add(sh)
  const shTop = new THREE.Mesh(new THREE.PlaneGeometry(D, R.h - 1.8), wm); shTop.position.set(R.x1, 1.8 + (R.h - 1.8) / 2, 0); shTop.rotation.y = -Math.PI / 2; g.add(shTop)
  box(0.06, 0.06, D, wood, R.x1 - 0.03, 1.8, 0, false); box(0.06, 0.05, D, wood, R.x1 - 0.03, 0.03, 0, false)
  // 手前: ふすま4枚（カメラ側なので背を向けても破綻しないように両面）
  const fm = M({ map: fusumaTex(), roughness: 1, side: THREE.DoubleSide })
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), fm); m.position.set(R.x0 + 0.45 + i * 0.9, 0.9, R.z1 - (i % 2 ? 0.01 : 0.03)); m.rotation.y = Math.PI; g.add(m) }
  const fTop = new THREE.Mesh(new THREE.PlaneGeometry(W, R.h - 1.8), new THREE.MeshStandardMaterial({ map: wallTex(), side: THREE.DoubleSide, roughness: 1 })); fTop.position.set(0, 1.8 + (R.h - 1.8) / 2, R.z1); fTop.rotation.y = Math.PI; g.add(fTop)
  box(W, 0.06, 0.06, wood, 0, 1.8, R.z1 - 0.03, false)
  // 奥の壁: 掛け軸（夏の金魚）とカレンダー
  const scroll = canvasTex(128, 384, (c, w, h) => { c.fillStyle = '#e8e2cf'; c.fillRect(0, 0, w, h); c.fillStyle = '#3d4f6b'; c.fillRect(0, 0, w, 30); c.fillRect(0, h - 30, w, 30)
    c.fillStyle = '#d2412f'; for (const [x, y, r] of [[60, 150, 1], [80, 220, -1]]) { c.save(); c.translate(x, y); c.scale(r, 1); c.beginPath(); c.ellipse(0, 0, 18, 10, 0.3, 0, 7); c.fill(); c.beginPath(); c.moveTo(-14, 4); c.lineTo(-34, -6); c.lineTo(-30, 14); c.fill(); c.restore() }
    c.strokeStyle = 'rgba(60,90,120,.4)'; c.lineWidth = 2; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(40 + i * 12, 290 - i * 22, 4, 0, 7); c.stroke() } })
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.2), M({ map: scroll })); sc.position.set(-0.9, 1.25, R.z0 + 0.01); g.add(sc)

  // 天井の電灯（丸い蛍光灯の笠・豆電球・引きひも）
  const lamp = new THREE.Group(); lamp.position.set(0, R.h, -0.2); g.add(lamp)
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.1, 32, 1, true), M({ color: 0xf2efe6, side: THREE.DoubleSide, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0 }))
  shade.position.y = -0.32; lamp.add(shade)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 40), M({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 0.05 })); ring.rotation.x = Math.PI / 2; ring.position.y = -0.33; lamp.add(ring)
  const cordTop = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.27, 6), M({ color: 0x222222 })); cordTop.position.y = -0.135; lamp.add(cordTop)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), M({ color: 0xffb35c, emissive: 0xff9a3a, emissiveIntensity: 2.2 })); bulb.position.y = -0.36; lamp.add(bulb)
  const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.6, 4), M({ color: 0xdddddd })); pull.position.set(0.12, -0.67, 0); lamp.add(pull)
  const pullEnd = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), M({ color: 0xd94a3a })); pullEnd.position.set(0.12, -0.98, 0); lamp.add(pullEnd)
  solids.push({ min: new THREE.Vector3(-0.31, R.h - 0.38, -0.51), max: new THREE.Vector3(0.31, R.h - 0.27, 0.11) })

  // 扇風機（首振り）。手前右の隅
  const fan = new THREE.Group(); fan.position.set(1.3, 0, 1.25); g.add(fan)
  const fw = M({ color: 0xf0efe8, roughness: 0.45 }), fb = M({ color: 0x7fb7d8, roughness: 0.4, transparent: true, opacity: 0.85 })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.05, 28), fw); base.position.y = 0.025; fan.add(base)
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.02), M({ color: [0x6fcf6f, 0xf2c14e, 0xe76f51][i] })); b.position.set(-0.05 + i * 0.05, 0.055, 0.12); fan.add(b) }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.62, 12), fw); pole.position.y = 0.36; fan.add(pole)
  const neck = new THREE.Group(); neck.position.y = 0.72; fan.add(neck)
  const motor = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.09, 6, 16), fw); motor.rotation.x = Math.PI / 2; motor.position.z = -0.06; neck.add(motor)
  const guard = new THREE.Group(); guard.position.z = 0.06; neck.add(guard)
  const gm = M({ color: 0xdedede, metalness: 0.6, roughness: 0.35 })
  for (const z of [-0.03, 0.04]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.005, 6, 48), gm); r.position.z = z; guard.add(r) }
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.2, 3), gm); s.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.045); s.rotation.z = a - Math.PI / 2; guard.add(s) }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16), fb); cap.rotation.x = Math.PI / 2; cap.position.z = 0.05; guard.add(cap)
  const blades = new THREE.Group(); blades.position.z = 0.01; guard.add(blades)
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16, 0, 0.9), fb); b.rotation.z = i * Math.PI * 2 / 3; b.material.side = THREE.DoubleSide; blades.add(b) }
  solids.push({ min: new THREE.Vector3(1.05, 0, 1.0), max: new THREE.Vector3(1.55, 0.95, 1.5) })

  // 蚊取り線香（渦巻き・皿・豚の蚊遣りの代わりに金属の受け皿）
  const coil = new THREE.Group(); coil.position.set(0.55, 0, 0.7); g.add(coil)
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.012, 24), M({ color: 0x3d4a3a, metalness: 0.5, roughness: 0.5 })); dish.position.y = 0.006; coil.add(dish)
  const pts = []; for (let t = 0; t < 1; t += 0.004) { const a = t * Math.PI * 2 * 3.6, r = 0.012 + t * 0.055; pts.push(new THREE.Vector3(Math.cos(a) * r, 0.022, Math.sin(a) * r)) }
  const spiral = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 300, 0.0045, 6), M({ color: 0x3f6b3a, roughness: 0.9 })); coil.add(spiral)
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), M({ color: 0xff6a2a, emissive: 0xff4a10, emissiveIntensity: 3 })); ember.position.copy(pts[pts.length - 1]); coil.add(ember)
  const emberLight = new THREE.PointLight(0xff5a20, 0.25, 0.6, 2); emberLight.position.copy(pts[pts.length - 1]); emberLight.position.y += 0.02; coil.add(emberLight)

  // ちゃぶ台（じいちゃんがいない夜だけ）と座布団・麦茶
  const table = new THREE.Group(); table.position.set(-0.7, 0, 1.2); g.add(table)
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.035, 40), M({ map: woodTex('#7a4f2a', '#5a3518'), roughness: 0.55 })); top.position.y = 0.32; table.add(top)
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.6; const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), wood); l.position.set(Math.cos(a) * 0.28, 0.15, Math.sin(a) * 0.28); table.add(l) }
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.1, 16), M({ color: 0xc98a3a, transparent: true, opacity: 0.75, roughness: 0.1 })); glass.position.set(0.1, 0.39, 0.05); table.add(glass)
  const tableSolid = { min: new THREE.Vector3(-1.12, 0, 0.78), max: new THREE.Vector3(-0.28, 0.35, 1.62) }; solids.push(tableSolid)

  // 光: 月明かり（障子の外）・常夜灯（橙）・天井の蛍光灯（起きた時だけ）
  const hemi = new THREE.HemisphereLight(0x51608a, 0x2a2018, 0.55); scene.add(hemi)
  const moon = new THREE.DirectionalLight(0x9fb4ff, 0.9); moon.position.set(4, 3.2, 0.6); moon.target.position.set(0, 0, 0); scene.add(moon, moon.target)
  if (!opts.low) { moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); const c = moon.shadow.camera; c.left = -2.4; c.right = 2.4; c.top = 2.4; c.bottom = -2.4; c.near = 0.5; c.far = 9; moon.shadow.bias = -0.0015; moon.shadow.normalBias = 0.02 }
  const night = new THREE.PointLight(0xff9a48, 1.1, 4.5, 1.6); night.position.set(0, R.h - 0.4, -0.2); scene.add(night)
  const main = new THREE.PointLight(0xfff4e6, 0, 9, 1.2); main.position.set(0, R.h - 0.45, -0.2); scene.add(main)
  const dawn = new THREE.DirectionalLight(0xffc89a, 0); dawn.position.set(4, 1.5, 0.3); scene.add(dawn)

  return {
    group: g, solids, fan: { root: fan, neck, blades, head: new THREE.Vector3() }, coil: { root: coil, ember, pos: coil.position.clone().add(new THREE.Vector3(0, 0.03, 0)) },
    lamp: { shade, ring, bulb, pull, pullEnd }, table, tableSolid, glass,
    light: { hemi, moon, night, main, dawn, shoji: sh },
    setLight(on) { main.intensity = on ? 7 : 0; shade.material.emissiveIntensity = on ? 0.9 : 0; ring.material.emissiveIntensity = on ? 2.5 : 0.05; night.intensity = on ? 0.2 : 1.1; hemi.intensity = on ? 1.2 : 0.55 },
    setDawn(k) { dawn.intensity = k * 1.6; sh.material.emissiveIntensity = 0.55 + k * 0.9; sh.material.emissive.setRGB(0.42 + k * 0.5, 0.49 + k * 0.3, 0.65 - k * 0.2); hemi.color.setRGB(0.32 + k * 0.4, 0.38 + k * 0.3, 0.54 - k * 0.1) },
  }
}

// 布団一式（敷き布団・枕・タオルケット）。cx,cz は頭の位置、dir は足の向き（+z なら 0）
export function futon(scene, kind, cx, cz, rotY, len = 2.0, wid = 1.0) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = rotY; scene.add(g)
  const mat = new THREE.MeshStandardMaterial({ map: futonTex(kind), roughness: 0.95 })
  const mat2 = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.95 })
  const shiki = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.08, len, 1, 1, 1), [mat2, mat2, mat, mat2, mat2, mat2]); shiki.position.set(0, 0.04, len / 2 - 0.2); shiki.receiveShadow = true; g.add(shiki)
  const pil = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.28, 6, 12), new THREE.MeshStandardMaterial({ color: kind === 'kid' ? 0x9cc9e0 : 0xd9c8a4, roughness: 1 }))
  pil.rotation.z = Math.PI / 2; pil.scale.set(1, 1, 0.55); pil.position.set(0, 0.12, -0.08); pil.castShadow = pil.receiveShadow = true; g.add(pil)
  return g
}
// タオルケット。h は体にかかる高さ（真ん中が盛り上がり、端は布団に落ちる）
export function towel(c1, c2, w, l, h = 0.25) {
  const geo = new THREE.BoxGeometry(w, 0.02, l, 12, 1, 8)
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), z = p.getZ(i); const k = Math.max(0, 1 - Math.pow(Math.abs(x) * 1.15, 2.2)); p.setY(i, p.getY(i) + h * Math.pow(k, 0.6) + Math.sin(z * 9 + x * 2) * 0.008) } geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: towelTex(c1, c2), roughness: 1 })); m.castShadow = m.receiveShadow = true
  return m
}
