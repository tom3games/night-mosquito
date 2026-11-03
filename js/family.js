// 寝ている家族（Kenney Mini Characters CC0 を寝かせて使う）・猫・蚊の見た目
// 体の各部の「刺せる場所」は、モデルの頂点をボーンごとに集めた箱から決める（目分量の座標を書かない）
import * as THREE from 'three'
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js'
import { clone as skClone } from '../vendor/jsm/utils/SkeletonUtils.js'

const A = { src: {}, boxes: {} }
export function loadFamily(manager) {
  const L = new GLTFLoader(manager)
  const files = ['male-d', 'female-d', 'male-f', 'male-b']
  return Promise.all(files.map(f => new Promise((ok, ng) => L.load('assets/chars/character-' + f + '.glb', ok, undefined, ng)))).then(rs => {
    files.forEach((f, i) => { A.src[f] = rs[i].scene; A.boxes[f] = boneBoxes(rs[i].scene); bareLegs(rs[i].scene, A.boxes[f]) })
  })
}

// 夏の夜なので、すねから下を素足にする（靴とズボンの裾の色を、手の肌の色に塗り替える）
function bareLegs(root, B) {
  const v = new THREE.Vector3()
  root.traverse(o => {
    if (!o.isSkinnedMesh) return
    const g = o.geometry, p = g.attributes.position, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, sk = o.skeleton
    const local = i => { let b = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; b = si.getComponent(i, k) } } v.fromBufferAttribute(p, i).applyMatrix4(o.bindMatrix).applyMatrix4(sk.boneInverses[b]); return sk.bones[b].name }
    // 手の先（腕のボーンから一番遠い頂点）の UV が肌の色
    let best = -1, bu = 0, bv = 0
    for (let i = 0; i < p.count; i++) { const n = local(i); if (n !== 'arm-left') continue; const d = v.length(); if (d > best) { best = d; bu = uv.getX(i); bv = uv.getY(i) } }
    if (best < 0) return
    for (let i = 0; i < p.count; i++) {
      const n = local(i); if (n !== 'leg-left' && n !== 'leg-right') continue
      const lb = B[n]; if (v.y < lb.min.y + (lb.max.y - lb.min.y) * 0.5) uv.setXY(i, bu, bv)
    }
    uv.needsUpdate = true
  })
}

// ボーンごとの頂点の箱（ボーンの座標系）
function boneBoxes(root) {
  root.updateMatrixWorld(true)
  const out = {}, v = new THREE.Vector3(), m = new THREE.Matrix4()
  root.traverse(o => {
    if (!o.isSkinnedMesh) return
    const p = o.geometry.attributes.position, si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, sk = o.skeleton
    for (let i = 0; i < p.count; i++) {
      let b = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; b = si.getComponent(i, k) } }
      const bone = sk.bones[b]
      v.fromBufferAttribute(p, i).applyMatrix4(o.bindMatrix); m.copy(sk.boneInverses[b]); v.applyMatrix4(m)
      const bx = out[bone.name] || (out[bone.name] = new THREE.Box3())
      bx.expandByPoint(v)
    }
  })
  return out
}

const V = (x, y, z) => new THREE.Vector3(x, y, z)
// 刺せる場所。bone のローカル座標と外向き（ローカル）。part は報告書の体の図の位置
function spotsFor(file, opts) {
  const B = A.boxes[file], s = []
  const hb = B.head, hs = hb.getSize(new THREE.Vector3()), hc = hb.getCenter(new THREE.Vector3())
  s.push({ key: 'forehead', bone: 'head', p: V(hc.x, hb.min.y + hs.y * 0.74, hb.max.z + 0.004), n: V(0, 0, 1), face: true })
  s.push({ key: 'cheek', bone: 'head', p: V(hc.x - hs.x * 0.3, hb.min.y + hs.y * 0.25, hb.max.z - 0.01), n: V(0, 0, 1), face: true })
  if (opts.bald) s.push({ key: 'top', bone: 'head', p: V(hc.x, hb.max.y + 0.004, hc.z), n: V(0, 1, 0), face: true })
  for (const side of ['left', 'right']) {
    const ab = B['arm-' + side]; if (!ab) continue
    // 腕はボーンから一番遠い所が手の先
    const ext = [['x', ab.min.x], ['x', ab.max.x], ['y', ab.min.y], ['y', ab.max.y]].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]
    const c = ab.getCenter(new THREE.Vector3()); const p = c.clone(); p[ext[0]] = ext[1] * 0.78; p.z = ab.max.z + 0.004
    s.push({ key: 'arm' + (side === 'left' ? 'L' : 'R'), bone: 'arm-' + side, p, n: V(0, 0, 1) })
    const lb = B['leg-' + side]; if (!lb) continue
    const lc = lb.getCenter(new THREE.Vector3())
    s.push({ key: 'foot' + (side === 'left' ? 'L' : 'R'), bone: 'leg-' + side, p: V(lc.x, lb.min.y + 0.035, lb.max.z + 0.004), n: V(0, 0, 1), hairy: !!opts.hairy })
  }
  return s
}

// 眉間のしわ・汗（起きかけの顔）。顔の前に貼る透明な板
function faceDecalTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d')
  g.strokeStyle = '#2a1a12'; g.lineWidth = 11; g.lineCap = 'round'
  g.beginPath(); g.moveTo(40, 40); g.lineTo(104, 62); g.stroke()
  g.beginPath(); g.moveTo(216, 40); g.lineTo(152, 62); g.stroke()
  g.lineWidth = 4; g.beginPath(); g.moveTo(122, 20); g.lineTo(126, 50); g.moveTo(134, 20); g.lineTo(130, 50); g.stroke()
  g.fillStyle = '#9fd3ff'; g.beginPath(); g.moveTo(236, 72); g.quadraticCurveTo(250, 100, 236, 108); g.quadraticCurveTo(222, 100, 236, 72); g.fill()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
let _decal = null
function zTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d')
  g.fillStyle = '#e8eefc'; g.font = '700 48px "Zen Kaku Gothic New",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z', 32, 34)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
let _z = null

const HP = Math.PI / 2
export class Sleeper {
  // id: dad/mom/kid/gramps。headX,headZ は枕の位置、rotY は体の向き（0 で足が +z）
  constructor(scene, id, def, headX, headZ, rotY, opts = {}) {
    this.id = id; this.def = def; this.sens = def.sens; this.alert = 0; this.state = 'sleep'; this.t = 0; this.cool = 0
    this.talkT = 4 + Math.random() * 8; this.turnT = 0; this.roll = 0; this.rollTo = 0; this.sit = 0; this.bites = []
    const S = def.scale, L = 0.72 * S
    this.L = L; this.scale = S
    this.root = new THREE.Group(); this.root.rotation.y = rotY; scene.add(this.root)
    this.root.position.set(headX + Math.sin(rotY) * L, 0, headZ + Math.cos(rotY) * L)
    this.rollG = new THREE.Group(); this.rollG.position.y = 0.085 + 0.12 * S; this.root.add(this.rollG)
    this.lie = new THREE.Group(); this.lie.rotation.x = -HP; this.lie.position.y = 0; this.rollG.add(this.lie)
    const ch = this.char = skClone(A.src[def.file]); ch.scale.setScalar(S); ch.position.y = -0.12 * S * 0   // 背中が布団に乗る高さは rollG で決める
    ch.position.z = 0; this.lie.add(ch)
    ch.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.roughness = 0.9; o.material.metalness = 0 } })
    this.lie.position.z = 0; this.lie.position.y = -0.0
    // ボーン
    this.b = {}; ch.traverse(o => { if (o.isBone || o.type === 'Object3D') this.b[o.name] = o })
    for (const k in this.b) this.b[k].userData.q0 = this.b[k].quaternion.clone()
    this.pose = opts.pose || 'side'   // 腕の置き方: side 体の横 / up ばんざい / wide 大の字
    this.spots = spotsFor(def.file, opts).map(s => ({ ...s, owner: this, stock: 0.32, w: new THREE.Vector3(), wn: new THREE.Vector3(), ok: true }))
    // 当たり判定（頭・胴・脚）
    const B = A.boxes[def.file]
    this.cols = ['head', 'torso', 'leg-left', 'leg-right'].filter(n => B[n]).map(n => { const bx = B[n], c = bx.getCenter(new THREE.Vector3()), sz = bx.getSize(new THREE.Vector3()); return { bone: n, c, r: Math.min(sz.x, sz.y, sz.z) * 0.5 * S * 0.95 + (n === 'head' ? 0.02 : 0), w: new THREE.Vector3() } })
    const hb = B.head; this.earLocal = hb.getCenter(new THREE.Vector3())
    // 顔のしわ
    _decal = _decal || faceDecalTex()
    const dm = new THREE.MeshBasicMaterial({ map: _decal, transparent: true, opacity: 0, depthWrite: false })
    this.decal = new THREE.Mesh(new THREE.PlaneGeometry(hb.getSize(new THREE.Vector3()).x * 0.9, hb.getSize(new THREE.Vector3()).x * 0.45), dm)
    this.decal.position.set(hb.getCenter(new THREE.Vector3()).x, hb.min.y + (hb.max.y - hb.min.y) * 0.5, hb.max.z + 0.003); this.b.head.add(this.decal)
    // z のつぶやき
    _z = _z || zTex(); this.zs = []
    for (let i = 0; i < 3; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _z, transparent: true, depthWrite: false, opacity: 0 })); sp.scale.setScalar(0.07); scene.add(sp); this.zs.push(sp) }
    this.zT = Math.random() * 3
    // 毛深い足（父）。すねに細い毛を植える
    if (opts.hairy) for (const side of ['left', 'right']) {
      const lb = B['leg-' + side], g = new THREE.Group(), hm = new THREE.LineBasicMaterial({ color: 0x1a120c })
      const pts = []; for (let i = 0; i < 46; i++) { const x = lb.min.x + 0.01 + Math.random() * (lb.max.x - lb.min.x - 0.02), y = lb.min.y + 0.03 + Math.random() * (lb.max.y - lb.min.y) * 0.42; pts.push(x, y, lb.max.z, x + (Math.random() - .5) * 0.012, y + 0.008, lb.max.z + 0.01) }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.add(new THREE.LineSegments(geo, hm)); this.b['leg-' + side].add(g)
    }
    this.applyPose(0)
  }
  get headPos() { return this.b.head.localToWorld(this._tmp = (this._tmp || new THREE.Vector3()).copy(this.earLocal)) }
  setRot(bone, x, y, z) { const b = this.b[bone]; if (!b) return; b.quaternion.copy(b.userData.q0).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z))) }
  // breath: 0..1 の呼吸。sit: 起き上がり（0 寝る・1 座る）。arms: 叩く時の腕の向き
  applyPose(breath) {
    const p = this.pose, sit = this.sit
    const aw = { side: [0, 0, 0.15], up: [0, 0, 2.6], wide: [0, 0, 1.1] }[p]
    if (this.armAim) {
      for (const side of ['left', 'right']) { const a = this.armAim[side]; this.setRot('arm-' + side, a[0], a[1], a[2]) }
    } else {
      this.setRot('arm-left', 0.05 * breath, 0, aw[2]); this.setRot('arm-right', 0.05 * breath, 0, -aw[2])
    }
    this.setRot('torso', sit * 1.3 + breath * 0.02, 0, 0)
    this.setRot('head', -0.15 + sit * 0.5, 0, Math.sin(this.t * 0.3) * 0.04)
    const lw = p === 'wide' ? 0.35 : p === 'up' ? 0.18 : 0.05
    this.setRot('leg-left', 0, 0, lw); this.setRot('leg-right', 0, 0, -lw)
    this.char.scale.set(this.scale * (1 + breath * 0.012), this.scale, this.scale * (1 + breath * 0.02))
  }
  updateWorld() {
    this.root.updateMatrixWorld(true)
    const q = new THREE.Quaternion()
    for (const s of this.spots) {
      const b = this.b[s.bone]; s.w.copy(s.p); b.localToWorld(s.w)
      b.getWorldQuaternion(q); s.wn.copy(s.n).applyQuaternion(q)
      s.ok = s.wn.y > 0.05 && this.sit < 0.3 && !this.covered(s)
    }
    for (const c of this.cols) { c.w.copy(c.c); this.b[c.bone].localToWorld(c.w) }
  }
  covered(s) { return this.cover && this.cover.includes(s.key) }
}

// 猫（レア）。CC0 の動物モデルが手元に無いので、毛の色と形を作り込んだ置物にして、首と目で蚊を追わせる
export class Cat {
  constructor(scene, x, z) {
    this.root = new THREE.Group(); this.root.position.set(x, 0, z); this.root.rotation.y = -2.4; scene.add(this.root)
    const fur = new THREE.MeshStandardMaterial({ color: 0x3a3330, roughness: 1 }), belly = new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 1 })
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: 0x8a2f3a, roughness: 1 })); cushion.position.y = 0.03; this.root.add(cushion)
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), fur); body.scale.set(1, 0.85, 1.35); body.position.set(0, 0.17, 0); this.root.add(body)
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), belly); chest.scale.set(1, 1, 0.6); chest.position.set(0, 0.16, -0.15); this.root.add(chest)
    for (const s of [-1, 1]) { const paw = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), belly); paw.scale.set(1, 0.6, 1.4); paw.position.set(s * 0.05, 0.075, -0.2); this.root.add(paw); if (s > 0) this.paw = paw }
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 8, 24, 2.4), fur); tail.rotation.set(HP, 0, 0.6); tail.position.set(0, 0.08, 0.06); this.root.add(tail)
    this.neck = new THREE.Group(); this.neck.position.set(0, 0.3, -0.13); this.root.add(this.neck)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 16), fur); head.scale.set(1.1, 0.95, 1); this.neck.add(head)
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), belly); muzzle.scale.set(1.2, 0.8, 0.8); muzzle.position.set(0, -0.025, -0.075); this.neck.add(muzzle)
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), fur); ear.position.set(s * 0.055, 0.08, -0.01); ear.rotation.set(-0.15, 0, -s * 0.3); this.neck.add(ear)
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd6c23a, emissive: 0x8a7a10, emissiveIntensity: 0.8, roughness: 0.2 })); eye.position.set(s * 0.038, 0.012, -0.075); this.neck.add(eye)
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.026, 0.006), new THREE.MeshBasicMaterial({ color: 0x050505 })); pupil.position.set(s * 0.038, 0.012, -0.093); this.neck.add(pupil)
      for (const k of [-1, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.09, 3), new THREE.MeshBasicMaterial({ color: 0xdddddd })); wh.rotation.z = HP + k * 0.15; wh.position.set(s * 0.06, -0.03 + k * 0.006, -0.09); this.neck.add(wh) }
    }
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
    this.swipe = 0; this.cool = 0; this.wind = 0
  }
  get headPos() { return this.neck.getWorldPosition(this._v = (this._v || new THREE.Vector3())) }
}

// 蚊（ヒトスジシマカ。黒地に白いしま）。前は -z。体長は見やすいよう実物の約6倍
export function makeMosquito() {
  const g = new THREE.Group()
  const black = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.5, metalness: 0.1 })
  const stripeTex = (() => { const c = document.createElement('canvas'); c.width = 16; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#141416'; x.fillRect(0, 0, 16, 128); x.fillStyle = '#e8e8e0'; for (let y = 6; y < 128; y += 22) x.fillRect(0, y, 16, 6); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t })()
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 16, 12), black); thorax.scale.set(1, 1.05, 1.3); g.add(thorax)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.0006, 0.007), new THREE.MeshBasicMaterial({ color: 0xf0f0e8 })); stripe.position.set(0, 0.0047, 0); g.add(stripe)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 12, 10), black); head.position.set(0, 0.0005, -0.0068); g.add(head)
  for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0017, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2b1a12, roughness: 0.25, metalness: 0.3 })); eye.position.set(s * 0.0017, 0.0009, -0.0075); g.add(eye) }
  const prob = new THREE.Mesh(new THREE.CylinderGeometry(0.00035, 0.0002, 0.012, 5), black); prob.rotation.x = HP + 0.35; prob.position.set(0, -0.0018, -0.0125); g.add(prob)
  for (const s of [-1, 1]) { const an = new THREE.Mesh(new THREE.CylinderGeometry(0.00025, 0.00012, 0.008, 4), black); an.rotation.set(HP - 0.5, 0, s * 0.35); an.position.set(s * 0.0013, 0.0022, -0.0105); g.add(an) }
  // おなか（吸うとふくらんで赤くなる）
  const abdG = new THREE.Group(); abdG.position.set(0, -0.0006, 0.0052); abdG.rotation.x = -0.12; g.add(abdG)
  const abdMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: stripeTex, roughness: 0.35, metalness: 0, emissive: 0x000000 })
  const abdGeo = new THREE.SphereGeometry(0.003, 16, 14); abdGeo.rotateX(HP)
  const abd = new THREE.Mesh(abdGeo, abdMat); abd.scale.set(1, 0.9, 3.1); abd.position.z = 0.0085; abdG.add(abd)
  const blood = new THREE.Mesh(new THREE.SphereGeometry(0.0031, 14, 10), new THREE.MeshStandardMaterial({ color: 0xb0101e, roughness: 0.25, emissive: 0x5a0008, emissiveIntensity: 0.6, transparent: true, opacity: 0 })); blood.scale.set(1, 0.9, 3.0); blood.position.z = 0.0085; abdG.add(blood)
  // 脚6本（2節）
  const legs = []
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const L = new THREE.Group(); L.position.set(s * 0.002, -0.0025, -0.003 + i * 0.003); g.add(L)
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.00028, 0.01, 5), black); up.position.set(s * 0.004, 0.0015, 0); up.rotation.z = s * 1.2; L.add(up)
    const dn = new THREE.Mesh(new THREE.CylinderGeometry(0.00026, 0.00014, 0.016, 5), black); dn.position.set(s * 0.0085, -0.0055, (i - 1) * 0.006); dn.rotation.set((i - 1) * 0.45, 0, s * 0.18); L.add(dn)
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0003, 0.0003, 0.0012, 5), new THREE.MeshStandardMaterial({ color: 0x8c8a84, roughness: 0.6 })); band.position.copy(dn.position); band.rotation.copy(dn.rotation); L.add(band)
    legs.push(L)
  }
  // 羽（透明・はばたきでぶれる）
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xdfe8ff, emissive: 0x405070, emissiveIntensity: 0.6, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false })
  const wingGeo = new THREE.CircleGeometry(0.0105, 16); wingGeo.scale(0.34, 1, 1); wingGeo.rotateX(-HP); wingGeo.rotateY(HP); wingGeo.translate(0.0085, 0, 0.002)
  const wings = []
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.0022, 0.0035, -0.001); const m = new THREE.Mesh(wingGeo, wingMat); m.scale.x = s; w.add(m); g.add(w); wings.push(w) }
  g.traverse(o => { if (o.isMesh) o.castShadow = false })
  return { root: g, abd, abdMat, blood, wings, legs, prob, wingMat,
    setFull(f) {
      const k = 1 + f * 0.9; abd.scale.set(k, 0.9 * k, 3.1 + f * 0.6); blood.scale.set(k * 0.97, 0.88 * k, 3.0 + f * 0.6)
      blood.material.opacity = Math.min(0.9, f * 1.8); abdMat.color.setRGB(1, 1 - f * 0.75, 1 - f * 0.75); abdMat.emissive.setRGB(f * 0.35, 0, f * 0.02); abdG.rotation.x = -0.12 + f * 0.2
    },
  }
}
