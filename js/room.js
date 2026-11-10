// 電気のついた夏の夜の和室。壁4面はイラストを貼り、床と天井と家具は同じ太い線で描く（紙の舞台の中を飛ぶ）
import * as THREE from 'three'

export const ROOM = { x0: -3, x1: 3, z0: -3, z1: 3, h: 2.6 }
const INK = '#1b1612'

function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]) }
  return t
}
// 手で引いた線（少し揺らす）
function wob(g, x0, y0, x1, y1, seed = 1) {
  const n = 6; g.beginPath(); g.moveTo(x0, y0)
  for (let i = 1; i <= n; i++) { const k = i / n, o = Math.sin(k * 9 + seed * 7.3) * 1.6; g.lineTo(x0 + (x1 - x0) * k + (y1 === y0 ? 0 : o), y0 + (y1 - y0) * k + (y1 === y0 ? o : 0)) }
  g.stroke()
}
const tatamiTex = () => canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#d7cf8c'; g.fillRect(0, 0, w, h)
  // い草の目はまばらな線だけ。イラストなので細かくしない
  g.strokeStyle = '#c0b873'; g.lineWidth = 3
  for (let y = 18; y < h; y += 34) { const l = 40 + (y * 7 % 90), x = (y * 13) % w; wob(g, x, y, x + l, y, y); wob(g, (x + 420) % w, y + 12, (x + 420) % w + l * .7, y + 12, y + 3) }
  // 畳のへり（1024px = 3m。縦長と横長を組む）
  const edge = (x, y, W, H) => { g.fillStyle = '#2f5c4a'; g.fillRect(x, y, W, H); g.strokeStyle = INK; g.lineWidth = 5; g.strokeRect(x, y, W, H) }
  edge(0, 0, w, 16); edge(0, h / 2 - 8, w, 16); edge(0, 0, 16, h); edge(w / 2 - 8, 0, 16, h / 2); edge(w - 16, 0, 16, h); edge(w / 3, h / 2, 16, h / 2); edge(w * 2 / 3, h / 2, 16, h / 2); edge(0, h - 16, w, 16)
}, [2, 2])
const ceilTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#b98b5a'; g.fillRect(0, 0, w, h)
  for (let x = 0; x < w; x += 128) { g.fillStyle = (x / 128) % 2 ? '#c79a68' : '#b98b5a'; g.fillRect(x, 0, 128, h); g.strokeStyle = INK; g.lineWidth = 5; wob(g, x, 0, x, h, x); g.strokeStyle = 'rgba(90,55,25,.6)'; g.lineWidth = 3; wob(g, x + 44, 40, x + 54, h - 60, x + 2); wob(g, x + 88, 120, x + 84, h - 20, x + 3) }
}, [3, 3])
const futonTex = (base, line) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h); g.strokeStyle = line; g.lineWidth = 7
  for (let i = 32; i < w; i += 64) { wob(g, i, 0, i, h, i); wob(g, 0, i, w, i, i + 1) }
})

const basic = o => new THREE.MeshBasicMaterial(o)
const inkMat = new THREE.MeshBasicMaterial({ color: 0x1b1612, side: THREE.BackSide })
// 太い線: 少し大きい裏面を黒で重ねる
function inked(geo, mat, thick = 0.02) {
  const g = new THREE.Group(), m = new THREE.Mesh(geo, mat), o = new THREE.Mesh(geo, inkMat)
  geo.computeBoundingBox(); const s = geo.boundingBox.getSize(new THREE.Vector3())
  o.scale.set(1 + thick * 2 / Math.max(s.x, .01), 1 + thick * 2 / Math.max(s.y, .01), 1 + thick * 2 / Math.max(s.z, .01))
  g.add(o, m); return g
}

export function buildRoom(scene, tex) {
  const R = ROOM, W = R.x1 - R.x0, D = R.z1 - R.z0
  const g = new THREE.Group(); scene.add(g)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), basic({ map: tatamiTex() })); floor.rotation.x = -Math.PI / 2; g.add(floor)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), basic({ map: ceilTex() })); ceil.rotation.x = Math.PI / 2; ceil.position.y = R.h; g.add(ceil)
  const wall = (name, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(W, R.h), basic({ map: tex[name] })); m.position.set(x, R.h / 2, z); m.rotation.y = ry; g.add(m); return m }
  wall('wall_n', 0, R.z0, 0); wall('wall_e', R.x1, 0, -Math.PI / 2); wall('wall_s', 0, R.z1, Math.PI); wall('wall_w', R.x0, 0, Math.PI / 2)
  // 壁と床・天井の境の太い線
  const edge = (w, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), basic({ color: 0x4a3423 })); m.position.set(x, y, z); g.add(m) }
  for (const y of [0.025, R.h - 0.025]) { edge(W, 0.06, 0, y, R.z0 + 0.03); edge(W, 0.06, 0, y, R.z1 - 0.03); edge(0.06, D, R.x0 + 0.03, y, 0); edge(0.06, D, R.x1 - 0.03, y, 0) }

  const solids = []
  // ちゃぶ台
  const table = new THREE.Group(); table.position.set(-1.9, 0, 1.75); g.add(table)
  const top = inked(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 28), basic({ color: 0x9a6233 }), 0.025); top.position.y = 0.36; table.add(top)
  const legM = basic({ color: 0x74471f })
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.6, l = inked(new THREE.BoxGeometry(0.07, 0.34, 0.07), legM, 0.012); l.position.set(Math.cos(a) * 0.42, 0.17, Math.sin(a) * 0.42); table.add(l) }
  const cup = inked(new THREE.CylinderGeometry(0.06, 0.05, 0.13, 12), basic({ color: 0xd98d3a }), 0.012); cup.position.set(0.16, 0.46, -0.1); table.add(cup)
  const melon = inked(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), basic({ color: 0xf0603f }), 0.012); melon.rotation.x = -0.4; melon.position.set(-0.2, 0.42, 0.14); table.add(melon)
  solids.push({ min: new THREE.Vector3(-2.52, 0, 1.13), max: new THREE.Vector3(-1.28, 0.42, 2.37) })
  // めくれた布団2枚（起きて飛び出したあと）
  const futon = (x, z, ry, base, line) => {
    const f = new THREE.Group(); f.position.set(x, 0, z); f.rotation.y = ry; g.add(f)
    const side = basic({ color: 0xf6f0e3 }), top = basic({ map: futonTex(base, line) })
    const s = inked(new THREE.BoxGeometry(1.05, 0.1, 2.0), [side, side, top, side, side, side], 0.018); s.position.y = 0.05; f.add(s)
    const pil = inked(new THREE.CapsuleGeometry(0.11, 0.34, 3, 10), basic({ color: 0xf1d9a5 }), 0.014); pil.rotation.z = Math.PI / 2; pil.position.set(0, 0.17, -0.82); pil.scale.z = 0.7; f.add(pil)
    // 蹴飛ばして足元に丸まったタオルケット
    const blanket = inked(new THREE.CapsuleGeometry(0.15, 0.62, 4, 12), basic({ color: 0x7fb5d5 }), 0.016); blanket.rotation.set(0, 0.25, Math.PI / 2); blanket.scale.set(0.8, 1, 1); blanket.position.set(0.04, 0.2, 0.72); f.add(blanket)
  }
  futon(1.55, -1.3, 0.08, '#f6efe0', '#4a6aa8'); futon(-1.55, -1.35, -0.1, '#fbe8e4', '#d07d7d')
  // 天井の丸い電灯（ひもが揺れる）
  const lamp = new THREE.Group(); lamp.position.set(0, R.h, 0); g.add(lamp)
  const shade = inked(new THREE.CylinderGeometry(0.36, 0.42, 0.13, 24), basic({ color: 0xfff6d8 }), 0.02); shade.position.y = -0.32; lamp.add(shade)
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 5), basic({ color: 0x1b1612 })); cord.position.y = -0.13; lamp.add(cord)
  const pull = new THREE.Group(); pull.position.y = -0.38; lamp.add(pull)
  const pStr = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4), basic({ color: 0x1b1612 })); pStr.position.y = -0.25; pull.add(pStr)
  const pEnd = inked(new THREE.SphereGeometry(0.03, 8, 6), basic({ color: 0xe4503a }), 0.008); pEnd.position.y = -0.52; pull.add(pEnd)
  // 扇風機（イラストの板）
  const fanMat = basic({ map: tex.p_fan, transparent: true, alphaTest: 0.3 })
  const fan = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), fanMat); fan.scale.set(0.95 * tex.p_fan.image.width / tex.p_fan.image.height, 0.95, 1); fan.position.set(2.35, 0, 2.35); g.add(fan)
  return { group: g, solids, pull, fan }
}
