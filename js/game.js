// 夏の夜の蚊。自分が蚊になって、起きた家族の攻撃を飛び回ってかわす。スコアは生きのびた秒数
// 3D の部屋に、切り絵のように立つイラストの人物。カメラは蚊の斜め後ろ。物理と判定は固定60Hz（performance.now で数える）
import * as THREE from 'three'
import { buildRoom, ROOM } from './room.js?v=4'

window.__jsUp = true
const $ = id => document.getElementById(id)
const TX = window.NM_TEXT, FAM = window.NM_FAMILY
const STEP = 1 / 60
const FOG_T = 150, FOG_DUR = 44       // くん煙: 150秒から床→天井へ上がり、44秒で部屋が埋まる（必ず終わる）
const M_R = 0.07                      // 蚊の当たり半径
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, k) => a + (b - a) * k
const fmt = s => s.toFixed(1)

let lang = /^ja/.test(navigator.language || 'ja') ? 'ja' : 'en'
try { const l = localStorage.getItem('nm_lang'); if (l) lang = l } catch (e) {}
let muted = false
try { muted = localStorage.getItem('nm_mute') === '1' } catch (e) {}
let tutDone = false
try { tutDone = localStorage.getItem('nm_tut2') === '1' } catch (e) {}
let best = 0
try { best = parseFloat(localStorage.getItem('nm_best')) || 0 } catch (e) {}
const T = () => TX[lang]

// ---------------------------------------------------------------- 描画の土台
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
$('view').appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xe9d9ac)
const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 30)
camera.rotation.order = 'YXZ'

const manager = new THREE.LoadingManager()
manager.onProgress = (u, a, b) => { const el = $('boot'); if (el) el.style.setProperty('--p', (a / Math.max(1, b)).toFixed(3)) }
const TEX = {}
let SPR = {}
function loadAll() {
  return fetch('img/sprites.json?v=4').then(r => r.json()).then(man => {
    SPR = man
    const loader = new THREE.TextureLoader(manager)
    return Promise.all(Object.keys(man).map(n => new Promise((ok, ng) => loader.load(`img/${n}.webp?v=4`, t => { t.colorSpace = THREE.SRGBColorSpace; TEX[n] = t; ok() }, undefined, ng))))
  })
}

// ---------------------------------------------------------------- 音（録音素材だけ）
Snd.def({
  slap: ['snd/slap1.mp3', 'snd/slap2.mp3', 'snd/slap3.mp3'], thwack: ['snd/thwack1.mp3', 'snd/thwack2.mp3', 'snd/thwack3.mp3'], squish: ['snd/squish1.mp3', 'snd/squish2.mp3'],
  swish: ['snd/swish1.mp3', 'snd/swish2.mp3', 'snd/swish3.mp3'], cloth: ['snd/cloth1.mp3', 'snd/cloth2.mp3', 'snd/cloth3.mp3'],
  grunt: ['snd/grunt1.mp3', 'snd/grunt2.mp3', 'snd/grunt3.mp3'], click: 'snd/click.mp3', spray: 'snd/spray.mp3', shake: ['snd/shake1.mp3', 'snd/shake2.mp3'], zap: ['snd/zap1.mp3', 'snd/zap2.mp3'],
  meow: 'snd/meow.mp3', pop: ['snd/pop1.mp3', 'snd/pop2.mp3'], thud: 'snd/thud.mp3', win: 'snd/win.mp3', lose: 'snd/lose.mp3', rank: 'snd/rank.mp3', chime: 'snd/chime.mp3', squeak: 'snd/squeak.mp3',
})
Snd.setMute(muted)
const sfx = (n, o) => Snd.play(n, o)
let ambOn = false
function audioOn() { Snd.init(); if (!ambOn && Snd.ctx) { ambOn = true; Snd.loop('amb', 'snd/crickets.mp3', 0.16); Snd.loop('buzz', 'snd/buzz.mp3', 0.0001) } }
function loopVol(slot, v, rate) { const l = Snd.loops[slot]; if (!l || !l.g || !Snd.ctx) return; const t = Snd.ctx.currentTime; l.g.gain.setTargetAtTime(Math.max(0.0001, v), t, 0.08); if (rate && l.node) l.node.playbackRate.setTargetAtTime(rate, t, 0.1) }

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// ---------------------------------------------------------------- 切り絵の部品
const GEO_B = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0)   // 足元が原点
const GEO_C = new THREE.PlaneGeometry(1, 1)
const cutMat = (name, o = {}) => new THREE.MeshBasicMaterial({ map: name ? TEX[name] : null, transparent: true, depthWrite: false, side: THREE.DoubleSide, ...o })
const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgba(40,28,14,.55)'; g.beginPath(); g.ellipse(32, 32, 30, 30, 0, 0, 7); g.fill(); return new THREE.CanvasTexture(c) })()
function shadowMesh(s) { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.015; m.renderOrder = 1; scene.add(m); return m }
// 赤い輪: 落ちてくる場所の予告
const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(128, 128, 104, 0, 7); g.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t })()
const RING_K = 2 * 128 / 112
const rings = []
function getRing() { let r = rings.find(x => !x.busy); if (!r) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, depthTest: false, depthWrite: false })); s.renderOrder = 22; const f = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 28), new THREE.MeshBasicMaterial({ color: 0xe02a1c, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide })); f.rotation.x = -Math.PI / 2; f.position.y = 0.02; f.renderOrder = 2; scene.add(s, f); r = { s, f, busy: false }; rings.push(r) } r.busy = true; r.s.visible = r.f.visible = true; return r }
function freeRing(r) { if (!r) return; r.busy = false; r.s.visible = r.f.visible = false }
function placeRing(r, pos, rad, k, locked) { const sc = rad * RING_K * (1 + (1 - k) * 0.7); r.s.position.copy(pos); r.s.scale.set(sc, sc, 1); r.s.material.color.set(locked ? 0xff2412 : 0xffb400); r.f.position.set(pos.x, 0.02, pos.z); r.f.scale.setScalar(rad); r.f.material.color.set(locked ? 0xe02a1c : 0xd98a00) }

// ---------------------------------------------------------------- 状態
let room, mos, cone, sector, swatter, netProp, fog
const bursts = [], puffs = [], teethPool = [], columns = []
const M = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), cough: 0, alive: true, death: null, frame: null, panic: 0, flip: 1 }
let W = null
let mode = 'loading', paused = false, simAcc = 0, lastT = 0, frozen = false
let camYaw = 0, camPitch = -0.12, shake = 0, flash = 0, hitStop = 0, deathT = 0, lastLook = -9, noAuto = false
const say = { el: $('say'), who: null, t: 0 }
let testInput = null, camOverride = null
const people = []

function buildActors() {
  // 蚊: 体の板＋羽の板2枚。いつも見えるよう最前面に描く
  const g = new THREE.Group(), body = new THREE.Mesh(GEO_C, cutMat('m_back', { depthTest: false })); body.renderOrder = 31
  const wingMat = cutMat('m_wing', { depthTest: false, opacity: 0.82 })
  const wa = SPR.m_wing.w / SPR.m_wing.h
  const wing = dir => { const piv = new THREE.Group(), m = new THREE.Mesh(GEO_B, wingMat); m.renderOrder = 30; m.scale.set(0.21 * wa * dir, 0.21, 1); m.position.x = 0.21 * wa * dir / 2 - 0.01 * dir; piv.add(m); piv.position.set(0.05 * dir, 0.07, 0); g.add(piv); return piv }
  const wl = wing(-1), wr = wing(1); g.add(body); scene.add(g)
  const shadow = shadowMesh(0.3)
  mos = { root: g, body, wl, wr, shadow }
  setMosFrame('m_back')
  // スプレーの円すい・網の扇
  const cg = new THREE.ConeGeometry(1, 1, 22, 1, true); cg.translate(0, -0.5, 0); cg.rotateX(Math.PI)   // 先端が原点、+Y へ開く
  cone = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xbfe8c6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); cone.visible = false; cone.renderOrder = 20; scene.add(cone)
  sector = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffb400, transparent: true, opacity: 0.32, depthWrite: false, depthTest: false, side: THREE.DoubleSide })); sector.visible = false; sector.renderOrder = 21; scene.add(sector)
  // 振る道具
  swatter = new THREE.Group(); const sm = new THREE.Mesh(GEO_B, cutMat('p_swatter', { depthTest: false })); const sa = SPR.p_swatter.w / SPR.p_swatter.h; sm.scale.set(1.15 * sa, 1.15, 1); sm.renderOrder = 25; swatter.add(sm); swatter.visible = false; scene.add(swatter)
  netProp = new THREE.Mesh(GEO_C, cutMat('p_net', { depthTest: false })); const na = SPR.p_net.w / SPR.p_net.h; netProp.scale.set(1.3 * na, 1.3, 1); netProp.visible = false; netProp.renderOrder = 25; scene.add(netProp)
  // 衝撃の星・煙の粒・入れ歯
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(GEO_C, cutMat('p_burst', { depthTest: false })); m.visible = false; m.renderOrder = 26; m.userData = { t: 0 }; scene.add(m); bursts.push(m) }
  for (let i = 0; i < 70; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.p_puff, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; s.renderOrder = 15; s.userData = { life: 0, max: 1, v: new THREE.Vector3(), grow: 1 }; scene.add(s); puffs.push(s) }
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(GEO_C, cutMat('p_teeth', { depthTest: false })); const a = SPR.p_teeth.w / SPR.p_teeth.h; m.scale.set(0.42 * a, 0.42, 1); m.visible = false; m.renderOrder = 24; scene.add(m); teethPool.push({ m, ring: null, alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0, homing: 0, near: false, owner: null }) }
  // くん煙の水面
  fog = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: 0xcfc3dc, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide })); fog.rotation.x = -Math.PI / 2; fog.visible = false; fog.renderOrder = 14; scene.add(fog)
}
function setMosFrame(n) { if (M.frame === n && mos.body.material.map === TEX[n]) return; M.frame = n; mos.body.material.map = TEX[n]; const s = SPR[n], h = n === 'm_flat' ? 0.23 : 0.3; mos.w = h * s.w / s.h; mos.h = h; mos.body.scale.set(mos.w, h, 1) }

// 人物（切り絵）
class Person {
  constructor(id, x, z) {
    this.id = id; this.data = FAM[id]; this.kind = this.data.kind
    this.ppm = SPR[id + '_walk'].h / this.data.h
    this.mat = cutMat(id + '_walk')
    this.mesh = new THREE.Mesh(GEO_B, this.mat); this.mesh.renderOrder = 10; scene.add(this.mesh)
    this.shadow = shadowMesh(id === 'cat' || id === 'pig' ? 0.7 : 0.95)
    this.pos = new THREE.Vector3(x, 0, z); this.vel = new THREE.Vector3(); this.state = 'wake'; this.t = 0; this.cd = 0.6; this.act = null; this.y = 0; this.flip = 1; this.frame = null; this.lunge = 0; this.stepT = 0; this.smokeT = 0
    this.setFrame('walk'); this.head = new THREE.Vector3()
  }
  setFrame(f) { if (this.frame === f) return; this.frame = f; const n = `${this.id}_${f}`; this.mat.map = TEX[n]; this.w = SPR[n].w / this.ppm; this.h = SPR[n].h / this.ppm }
  remove() { scene.remove(this.mesh, this.shadow); this.mat.dispose(); freeRing(this.act && this.act.ring) }
}

// ---------------------------------------------------------------- 1回の準備
function clearRun() {
  for (const p of people) p.remove(); people.length = 0
  for (const r of rings) freeRing(r)
  for (const b of teethPool) { b.alive = false; b.m.visible = false; freeRing(b.ring); b.ring = null }
  for (const s of puffs) { s.userData.life = 0; s.visible = false }
  for (const b of bursts) b.visible = false
  columns.length = 0
  if (cone) { cone.visible = false; sector.visible = false; swatter.visible = false; netProp.visible = false; fog.visible = false }
}
function newRun(seed, opts = {}) {
  clearRun()
  const R = rng(seed)
  // 父が最初、次に母（叩く→スプレーの順で覚える）。あとはくじ
  const later = R() < 0.5 ? ['kid', 'gramps'] : ['gramps', 'kid']
  const spawns = [{ t: 0, id: 'dad' }, { t: 12, id: 'mom' }, { t: 30, id: later[0] }, { t: 50, id: later[1] }]
  const hasCat = opts.cat ?? R() < 0.3, hasPig = opts.pig ?? R() < 0.25, hasNb = opts.neighbor ?? R() < 0.2
  if (hasCat) spawns.push({ t: 20 + R() * 20, id: 'cat' })
  if (hasPig) spawns.push({ t: 40 + R() * 30, id: 'pig' })
  if (hasNb) spawns.push({ t: 65 + R() * 25, id: 'neighbor' })
  spawns.sort((a, b) => a.t - b.t)
  W = { seed, t: 0, R, spawns, gap: 2.4, d: 0, near: 0, ended: false, killer: null, result: null, tut: (opts.tut ?? !tutDone) ? 0 : 3, tutMoved: 0, tutV: 0, firstStrike: false, fogSaid: false, chimeT: 18, lineT: 0, lastBubble: -9 }
  M.pos.set(0, 1.25, 1.6); M.vel.set(0, 0, 0); M.cough = 0; M.alive = true; M.death = null; M.panic = 0; deathT = 0
  camYaw = 0; camPitch = -0.12; lastLook = -9
  camera.position.set(0, 1.6, 3); shake = flash = hitStop = 0
  mos.root.scale.set(1, 1, 1); mos.root.rotation.set(0, 0, 0)
  setMosFrame('m_back')
  stick.x = stick.y = 0; vertBtn = 0; vertPulse = 0
}
function spawnPerson(id) {
  // 蚊から離れた所に出す。父は最初に正面
  let x, z
  if (id === 'dad' && W.t < 1) { x = 0; z = -1 }
  else { let bestD = -1; for (let i = 0; i < 8; i++) { const a = W.R() * Math.PI * 2, xx = Math.cos(a) * 2.5, zz = Math.sin(a) * 2.5, dd = Math.hypot(xx - M.pos.x, zz - M.pos.z); if (dd > bestD) { bestD = dd; x = xx; z = zz } } }
  const p = new Person(id, x, z); people.push(p)
  sfx(id === 'cat' ? 'meow' : id === 'pig' ? 'squeak' : 'grunt', { vol: 0.6 })
  line(p, 'wake', 0)
  return p
}

// ---------------------------------------------------------------- 入力
const stick = { x: 0, y: 0, id: null }
let vertBtn = 0, vertPulse = 0
const look = { id: null, x: 0, y: 0 }
addEventListener('blur', () => { if (mode === 'play') setPause(true) })
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') setPause(true) })
;(() => {   // 左下に固定したスティック
  const zone = $('stickZone'), el = $('stick'), knob = el.querySelector('.knob')
  const upd = e => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const d = Math.hypot(dx, dy); if (d > 1) { dx /= d; dy /= d }
    stick.x = dx; stick.y = -dy; knob.style.transform = `translate(${dx * R * 0.6}px,${dy * R * 0.6}px)`
  }
  zone.addEventListener('pointerdown', e => { audioOn(); if (stick.id != null) return; stick.id = e.pointerId; try { zone.setPointerCapture(e.pointerId) } catch (er) {} el.classList.add('held'); upd(e) })
  zone.addEventListener('pointermove', e => { if (e.pointerId === stick.id) upd(e) })
  const end = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; el.classList.remove('held') }
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end)
})()
const view = $('view')
view.addEventListener('pointerdown', e => { audioOn(); if (look.id != null) return; look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; try { view.setPointerCapture(e.pointerId) } catch (er) {} })
view.addEventListener('pointermove', e => {
  if (e.pointerId !== look.id) return
  const k = 0.0072
  camYaw -= (e.clientX - look.x) * k; camPitch = clamp(camPitch - (e.clientY - look.y) * k, -0.9, 0.7)
  look.x = e.clientX; look.y = e.clientY; if (W) lastLook = W.t
})
const lookEnd = e => { if (e.pointerId === look.id) look.id = null }
view.addEventListener('pointerup', lookEnd); view.addEventListener('pointercancel', lookEnd)
for (const [id, d] of [['btnUp', 1], ['btnDown', -1]]) {   // 羽ボタン（1回押すと少し、押している間は続く）
  const b = $(id)
  b.addEventListener('pointerdown', e => { e.preventDefault(); audioOn(); vertBtn = d; vertPulse = 0.16 * d; b.classList.add('on') })
  for (const n of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(n, () => { if (vertBtn === d) vertBtn = 0; b.classList.remove('on') })
}
function gather() { if (testInput) return testInput(); return { sx: clamp(stick.x, -1, 1), sy: clamp(stick.y, -1, 1), v: vertBtn } }

// ---------------------------------------------------------------- 画面
function show(id) { for (const s of ['title', 'how', 'result', 'pause']) $(s).classList.toggle('hidden', s !== id) }
function applyLang() {
  document.documentElement.lang = lang
  for (const el of document.querySelectorAll('[data-t]')) { const v = T()[el.dataset.t]; if (typeof v === 'string') el.textContent = v }
  $('howList').innerHTML = T().how.map(s => `<li>${s}</li>`).join('')
  $('howWho').innerHTML = T().who.map(([id, n, w]) => `<figure><img src="img/${id}_wind.webp?v=4" alt=""><figcaption><b>${n}</b>${w}</figcaption></figure>`).join('')
  $('howKeys').innerHTML = T().keysTouch.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')
  $('btnMute').textContent = muted ? T().soundOff : T().soundOn
  $('bestT').textContent = best > 0 ? `${T().best} ${fmt(best)}${T().sec}` : ''
  $('hudBest').textContent = best > 0 ? `${T().best} ${fmt(best)}` : ''
}
$('btnLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('nm_lang', lang) } catch (e) {} applyLang() }
$('btnMute').onclick = () => { muted = !muted; Snd.setMute(muted); try { localStorage.setItem('nm_mute', muted ? '1' : '0') } catch (e) {} applyLang() }
$('btnHow').onclick = () => { audioOn(); show('how') }
$('btnOk').onclick = () => show('title')
$('btnStart').onclick = () => start()
$('btnAgain').onclick = () => start()
$('btnTitle').onclick = () => toTitle()
$('btnPause').onclick = () => setPause(true)
$('btnResume').onclick = () => setPause(false)
$('btnQuit').onclick = () => { setPause(false); toTitle() }
$('btnSave').onclick = () => { const a = document.createElement('a'); a.download = 'mosquito-wanted.png'; a.href = $('report').toDataURL('image/png'); a.click() }

function setPause(on) { if (mode !== 'play') return; paused = on; $('pause').classList.toggle('hidden', !on); if (!on) { lastT = performance.now(); simAcc = 0 } }
function toTitle() {
  mode = 'title'; paused = false; testInput = null; clearRun(); W = null
  Snd.loop('bgm', null); loopVol('buzz', 0.0001)
  show('title'); $('hud').classList.add('hidden'); say.el.classList.add('hidden'); hideEdges(); applyLang()
  $('fxWord').classList.add('hidden')
}
function start(seed, opts) {
  audioOn()
  if (Snd.ctx && (!Snd.loops.bgm)) Snd.loop('bgm', 'snd/bgm_chase.mp3', 0.2)
  newRun(seed ?? Math.floor(Math.random() * 1e9), opts || {})
  mode = 'play'; paused = false; say.t = 0; say.who = null; say.el.classList.add('hidden')
  show(null); $('hud').classList.remove('hidden'); $('fxWord').classList.add('hidden')
  tipKey = null; $('tip').classList.add('hidden'); applyLang()
  lastT = performance.now(); simAcc = 0
  sfx('click', { vol: 0.5 })
}

// 吹き出し（同時に1つ。表示は 0.9秒＋1字0.09秒）
function bubble(who, text) {
  if (say.t > 0.3 || W.tut < 3) return false
  say.who = who; say.el.textContent = text; say.el.classList.remove('hidden'); say.t = 0.9 + text.length * 0.09 + 0.4; W.lastBubble = W.t
  return true
}
const pick = a => a[Math.floor(Math.random() * a.length)]
function line(p, kind, gap = 3.2) { if (W.t - W.lastBubble < gap) return; const l = p.data[kind][lang]; bubble(p, pick(l)) }
let tipKey = null
function tip(k) { if (tipKey === k) return; tipKey = k; const el = $('tip'); if (!k) { el.classList.add('hidden'); return } el.textContent = T().tut[k] || k; el.classList.remove('hidden') }

// ---------------------------------------------------------------- 効果
function burst(pos, size, tint) { const b = bursts.find(x => !x.visible) || bursts[0]; b.position.copy(pos); b.visible = true; b.userData.t = 0; b.userData.size = size; b.material.color.set(tint || 0xffffff); b.material.opacity = 1 }
function puff(pos, size, life, vx, vy, vz, tint, grow = 1.6) {
  const s = puffs.find(x => x.userData.life <= 0); if (!s) return null
  s.position.copy(pos); s.visible = true; const u = s.userData; u.life = u.max = life; u.v.set(vx, vy, vz); u.size = size; u.grow = grow; s.material.color.set(tint || 0xffffff); s.material.opacity = 0.9; return s
}
function stepFx(dt) {
  for (const s of puffs) { const u = s.userData; if (u.life <= 0) continue; u.life -= dt; if (u.life <= 0) { s.visible = false; continue } s.position.addScaledVector(u.v, dt); const k = 1 - u.life / u.max; const sc = u.size * (1 + k * u.grow); s.scale.set(sc, sc, 1); s.material.opacity = Math.min(0.9, u.life / u.max * 2) }
  for (const b of bursts) { if (!b.visible) continue; b.userData.t += dt; const t = b.userData.t, k = Math.min(1, t / 0.08), a = SPR.p_burst.w / SPR.p_burst.h, sz = b.userData.size * k; b.scale.set(sz * a, sz, 1); b.material.opacity = t > 0.2 ? Math.max(0, 1 - (t - 0.2) / 0.15) : 1; if (t > 0.35) b.visible = false }
}
function nearMiss() {
  W.near++; M.panic = 0.5; hitStop = Math.max(hitStop, 0.05)
  const el = $('nearW'); el.textContent = T().near; el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''
  W.nearUntil = W.t + 0.5
  sfx('swish', { vol: 0.5 })
}
function kill(kind, who) {
  if (!M.alive) return
  M.alive = false; M.death = kind; W.killer = who ? who.id : null; W.deathAt = M.pos.clone(); W.deathVel = M.vel.clone(); deathT = 0
  hitStop = 0.14; flash = 1; shake = 1
  if (kind === 'zap') sfx('zap', { vol: 1 }); else if (kind === 'spray' || kind === 'smoke' || kind === 'fog') sfx('grunt', { vol: 0.8, rate: 1.6 }); else sfx('slap', { vol: 1 })
  sfx('squish', { vol: 0.7 }); Snd.duck && Snd.duck(0.35, 1.4)
  burst(M.pos, kind === 'spray' || kind === 'fog' || kind === 'smoke' ? 0.5 : 0.95, kind === 'zap' ? 0x9fe7ff : 0xffffff)
  setMosFrame(kind === 'spray' || kind === 'fog' || kind === 'smoke' ? 'm_cough' : 'm_flat')
  const el = $('fxWord'); el.textContent = T().death[kind]; el.classList.remove('hidden')
  say.t = 0; say.el.classList.add('hidden')
  if (who) setTimeoutWin(who)
  if (W.tut < 3) { W.tut = 3; tutDone = true; try { localStorage.setItem('nm_tut2', '1') } catch (e) {} }
  tip(null)
}
function setTimeoutWin(who) { W.winLine = pick(who.data.win[lang]); W.winWho = who; W.winAt = 0.75 }

// ---------------------------------------------------------------- 攻撃
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3()
const dOf = () => Math.min(1, W.d)
function predict(out, lead) { const k = dOf() * 0.85; out.copy(M.pos).addScaledVector(M.vel, lead * k); out.x = clamp(out.x, ROOM.x0 + 0.1, ROOM.x1 - 0.1); out.z = clamp(out.z, ROOM.z0 + 0.1, ROOM.z1 - 0.1); out.y = clamp(out.y, 0.12, ROOM.h - 0.08); return out }
const RANGE = { swat: 1.35, zap: 1.4, net: 1.3, spray: 2.3, teeth: 4.4, leap: 2.6, smoke: 99 }
const PREFER = { swat: 1.1, zap: 1.15, net: 1.1, spray: 1.9, teeth: 3.1, leap: 1.9, smoke: 0 }
const WIND = { swat: [0.95, 0.6], zap: [1.05, 0.7], net: [1.05, 0.72], spray: [0.95, 0.6], teeth: [0.8, 0.5], leap: [0.85, 0.58] }
function startAct(p) {
  const d = dOf(), wt = WIND[p.kind], a = { kind: p.kind, t: 0, w: lerp(wt[0], wt[1], d), locked: false, aim: new THREE.Vector3(), dir: new THREE.Vector3(), phase: 'wind', ring: null, r: p.kind === 'zap' ? 0.5 : p.kind === 'leap' ? 0.34 : 0.38 }
  p.act = a; p.state = 'act'; p.setFrame('wind'); p.vel.set(0, 0, 0)
  W.gap = lerp(2.0, 0.5, d)
  if (p.kind === 'swat' || p.kind === 'zap' || p.kind === 'leap') { a.ring = getRing(); predict(a.aim, 0.38) }
  if (p.kind === 'spray') { sfx('shake', { vol: 0.7 }); cone.visible = true; cone.material.opacity = 0.12; cone.material.color.set(0xffd27a); a.dir.copy(_v.copy(M.pos).sub(mouth(p, _v2))).normalize(); placeCone(p, a, 0.12) }
  if (p.kind === 'net') { a.dir.copy(_v.copy(M.pos).sub(p.pos)).setY(0).normalize(); a.h = M.pos.y; buildSector(p, a); sector.visible = true; sector.material.color.set(0xffb400) }
  if (p.kind === 'zap') sfx('zap', { vol: 0.4 })
  if (p.kind === 'leap') sfx('meow', { vol: 0.5 })
  line(p, 'hit')
}
function mouth(p, out) { return out.set(p.pos.x, p.pos.y + p.data.h * 0.68, p.pos.z) }
const SPRAY = { L: 2.7, half: 0.25 }
function placeCone(p, a, op) { const o = mouth(p, _v3); cone.position.copy(o); cone.quaternion.setFromUnitVectors(_v.set(0, 1, 0), a.dir); const r = SPRAY.L * Math.tan(SPRAY.half); cone.scale.set(r, SPRAY.L, r); cone.material.opacity = op }
const NET = { r0: 0.2, r1: 1.75, half: 1.15, dy: 0.38 }
function buildSector(p, a) {
  const pts = [], idx = [], N = 18, base = Math.atan2(a.dir.x, a.dir.z)
  for (let i = 0; i <= N; i++) { const t = base + (i / N - 0.5) * 2 * NET.half; for (const r of [NET.r0, NET.r1]) pts.push(Math.sin(t) * r, 0, Math.cos(t) * r); if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) } }
  const g = sector.geometry; g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setIndex(idx); g.computeBoundingSphere()
  sector.position.set(p.pos.x, a.h, p.pos.z)
}
function endAct(p) {
  const a = p.act; if (a) { freeRing(a.ring); a.ring = null; if (a.kind === 'spray') cone.visible = false; if (a.kind === 'net') { sector.visible = false; netProp.visible = false } }
  p.act = null; p.state = 'chase'; p.setFrame('walk'); p.cd = lerp(1.7, 0.55, dOf()); p.y = 0; p.lunge = 0
}
function stepAct(p, dt) {
  const a = p.act; a.t += dt
  if (a.phase === 'wind') {
    const left = a.w - a.t, k = clamp(a.t / a.w, 0, 1)
    if (a.kind === 'swat' || a.kind === 'zap') {
      const lockAt = 0.38
      if (left > lockAt) predict(a.aim, lockAt)
      else if (!a.locked) { a.locked = true }
      // 届く範囲に収める
      _v.copy(a.aim).sub(p.pos).setY(0); const dd = _v.length(); if (dd > 1.55) a.aim.addScaledVector(_v, (1.55 - dd) / dd)
      placeRing(a.ring, a.aim, a.r, k, a.locked)
      if (left <= 0) strike(p, a)
    } else if (a.kind === 'leap') {
      const lockAt = 0.34
      if (left > lockAt) predict(a.aim, lockAt); else a.locked = true
      placeRing(a.ring, a.aim, a.r, k, a.locked); p.mesh.rotation.z = 0
      if (left <= 0) { a.phase = 'air'; a.t = 0; a.from = p.pos.clone(); a.dur = 0.5; p.setFrame('hit'); sfx('swish', { vol: 0.8 }) }
    } else if (a.kind === 'spray') {
      const lockAt = 0.34
      if (left > lockAt) a.dir.copy(predict(_v, lockAt).sub(mouth(p, _v2))).normalize(); else a.locked = true
      cone.material.color.set(a.locked ? 0xff9a6a : 0xffd27a); placeCone(p, a, 0.1 + k * 0.14)
      if (Math.floor(a.t * 8) !== Math.floor((a.t - dt) * 8)) p.lunge = (p.lunge ? 0 : 0.03)
      if (left <= 0) { a.phase = 'fire'; a.t = 0; a.dur = lerp(1.1, 1.7, dOf()); p.setFrame('hit'); p.lunge = 0; sfx('spray', { vol: 0.9 }); cone.material.color.set(0xbfe8c6) }
    } else if (a.kind === 'net') {
      const lockAt = 0.36
      if (left > lockAt) { a.dir.copy(_v.copy(M.pos).sub(p.pos)).setY(0).normalize(); a.h = M.pos.y; buildSector(p, a) } else a.locked = true
      sector.material.color.set(a.locked ? 0xff2412 : 0xffb400)
      if (left <= 0) { a.phase = 'sweep'; a.t = 0; a.dur = 0.3; a.prevAng = -NET.half; p.setFrame('hit'); netProp.visible = true; sfx('swish', { vol: 0.9 }) }
    } else if (a.kind === 'teeth') {
      if (left <= 0) { throwTeeth(p); a.phase = 'after'; a.t = 0; a.dur = 0.4; p.setFrame('hit') }
    }
    return
  }
  if (a.phase === 'after') { if (a.t >= a.dur) endAct(p); return }
  if (a.phase === 'air') {   // 猫: 弧を描いて飛ぶ
    const k = clamp(a.t / a.dur, 0, 1)
    p.pos.x = lerp(a.from.x, a.aim.x, k); p.pos.z = lerp(a.from.z, a.aim.z, k)
    p.y = Math.max(0, a.aim.y * k + Math.sin(k * Math.PI) * 0.4 - p.data.h * 0.5 * k)
    placeRing(a.ring, a.aim, a.r, 1, true)
    if (k > 0.55 && M.alive) { const cy = p.y + p.data.h * 0.5; if (Math.hypot(M.pos.x - p.pos.x, M.pos.z - p.pos.z) < a.r + M_R && Math.abs(M.pos.y - cy) < 0.42) kill('cat', p) }
    if (k >= 1) { freeRing(a.ring); a.ring = null; burst(_v.copy(a.aim), 0.45); a.phase = 'fall'; a.t = 0; a.y0 = p.y; sfx('slap', { vol: 0.5 }); if (M.alive && a.aim.distanceTo(M.pos) < a.r + 0.5) nearMiss() }
    return
  }
  if (a.phase === 'fall') { p.y = Math.max(0, a.y0 - 4.9 * a.t * a.t); if (p.y === 0) { if (!a.lg) { a.lg = true; a.lt = a.t; sfx('thud', { vol: 0.35 }) } if (a.t - a.lt > 0.45) endAct(p) } return }
  if (a.phase === 'fire') {  // スプレー: 霧の中に長くいるとむせて落ちる
    const turn = lerp(0.18, 0.55, dOf()) * dt
    _v.copy(M.pos).sub(mouth(p, _v2)).normalize(); a.dir.lerp(_v, turn).normalize()
    placeCone(p, a, 0.26)
    const o = mouth(p, _v2)
    if (Math.floor(a.t * 30) !== Math.floor((a.t - dt) * 30)) { const sp = 2.1 + Math.random() * 0.6; const ss = sp * Math.tan(SPRAY.half) * 0.55; puff(o.clone().addScaledVector(a.dir, 0.15), 0.12, 0.85, a.dir.x * sp + (Math.random() - .5) * ss, a.dir.y * sp + (Math.random() - .5) * ss, a.dir.z * sp + (Math.random() - .5) * ss, 0xc9f0d0, 3.4) }
    if (inCone(M.pos, o, a.dir)) { W.inMist = true; a.touched = true } else if (a.touched && !a.nearDone) { a.nearDone = true; nearMiss() }
    if (a.t >= a.dur) endAct(p)
    return
  }
  if (a.phase === 'sweep') { // 網: 端から端へ扇を掃く
    const k = clamp(a.t / a.dur, 0, 1), ang = lerp(-NET.half, NET.half, k), base = Math.atan2(a.dir.x, a.dir.z)
    netProp.position.set(p.pos.x + Math.sin(base + ang) * 1.15, a.h, p.pos.z + Math.cos(base + ang) * 1.15)
    netProp.quaternion.copy(camera.quaternion); netProp.rotateZ(-ang * 0.7)
    _v.copy(M.pos).sub(p.pos); const dy = M.pos.y - a.h; const hd = Math.hypot(_v.x, _v.z), mAng = wrap(Math.atan2(_v.x, _v.z) - base)
    if (M.alive && hd > NET.r0 - M_R && hd < NET.r1 + M_R && Math.abs(dy) < NET.dy && mAng >= a.prevAng - 0.08 && mAng <= ang + 0.08) kill('net', p)
    a.prevAng = ang
    if (k >= 1) { if (M.alive && hd < NET.r1 + 0.45 && Math.abs(dy) < NET.dy + 0.4 && Math.abs(mAng) < NET.half + 0.3) nearMiss(); a.phase = 'after'; a.t = 0; a.dur = 0.28; sector.visible = false; netProp.visible = false }
    return
  }
  if (a.phase === 'strike') { // 叩いた直後の余韻
    const k = clamp(a.t / 0.16, 0, 1), side = a.side
    swatter.quaternion.copy(camera.quaternion); swatter.position.copy(a.aim).addScaledVector(_v.set(0, 1, 0).applyQuaternion(camera.quaternion), 0.97); swatter.rotateZ(Math.PI + side * (1 - k) * 1.5)
    swatter.visible = a.kind === 'swat' && a.t < 0.17
    if (a.t > 0.34) { swatter.visible = false; p.lunge = Math.max(0, p.lunge - dt * 2) }
    if (a.t > 0.5) endAct(p)
  }
}
function strike(p, a) {
  a.phase = 'strike'; a.t = 0; a.side = Math.random() < 0.5 ? 1 : -1
  freeRing(a.ring); a.ring = null
  p.setFrame('hit'); p.lunge = 0.25; W.firstStrike = true
  // 高い所へは跳ねて届かせる（天井も安全地帯にしない）
  p.y = Math.max(0, a.aim.y - p.data.h - 0.1)
  sfx(a.kind === 'zap' ? 'zap' : 'thwack', { vol: 0.9 })
  burst(_v.copy(a.aim), a.kind === 'zap' ? 0.72 : 0.5, a.kind === 'zap' ? 0x9fe7ff : 0xffffff)
  const dist = M.pos.distanceTo(a.aim)
  if (dist < a.r + M_R) kill(a.kind, p)
  else if (dist < a.r + 0.5) nearMiss()
  shake = Math.max(shake, 0.25)
}
function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a }
function inCone(pt, o, dir) { const dx = pt.x - o.x, dy = pt.y - o.y, dz = pt.z - o.z, al = dx * dir.x + dy * dir.y + dz * dir.z; if (al < 0.05 || al > SPRAY.L) return false; const rr = Math.hypot(dx - dir.x * al, dy - dir.y * al, dz - dir.z * al); return rr < al * Math.tan(SPRAY.half) + M_R * 0.5 }
function throwTeeth(p) {
  const d = dOf(), n = d > 0.6 ? 2 : 1, sp = lerp(3.1, 4.5, d)
  for (let i = 0; i < n; i++) {
    const b = teethPool.find(x => !x.alive); if (!b) break
    const o = mouth(p, _v2); b.pos.copy(o); b.alive = true; b.t = 0; b.near = false; b.owner = p; b.homing = i === 0 ? 1.1 : 0; b.ring = getRing(); b.m.visible = true; b.lastPop = 0
    _v.copy(predict(_v3, 0.5)).sub(o).normalize(); if (i === 1) _v.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.4)
    b.vel.copy(_v).multiplyScalar(sp)
  }
  sfx('pop', { vol: 0.8 })
}
function stepTeeth(dt) {
  for (const b of teethPool) {
    if (!b.alive) continue
    b.t += dt
    if (b.t < b.homing) { const sp = b.vel.length(); _v.copy(M.pos).sub(b.pos).normalize().multiplyScalar(sp); b.vel.lerp(_v, 0.95 * dt).setLength(sp) }
    b.pos.addScaledVector(b.vel, dt)
    if (b.pos.x < ROOM.x0 + .1 || b.pos.x > ROOM.x1 - .1) b.vel.x *= -1
    if (b.pos.z < ROOM.z0 + .1 || b.pos.z > ROOM.z1 - .1) b.vel.z *= -1
    if (b.pos.y < 0.08 || b.pos.y > ROOM.h - 0.1) b.vel.y *= -1
    b.pos.x = clamp(b.pos.x, ROOM.x0 + .1, ROOM.x1 - .1); b.pos.z = clamp(b.pos.z, ROOM.z0 + .1, ROOM.z1 - .1); b.pos.y = clamp(b.pos.y, 0.08, ROOM.h - 0.1)
    b.m.position.copy(b.pos); placeRing(b.ring, b.pos, 0.2, 1, true); b.ring.f.visible = false
    if (b.t - b.lastPop > 0.28) { b.lastPop = b.t; sfx('pop', { vol: 0.35, rate: 1.5 }) }
    const dist = b.pos.distanceTo(M.pos)
    if (M.alive && dist < 0.17 + M_R) { kill('teeth', b.owner); burst(b.pos, 0.6); b.t = 99 }
    else if (M.alive && dist < 0.55 && !b.near) { b.near = true; b.wasNear = true }
    else if (b.near && dist > 0.75) { b.near = false; if (b.wasNear) { b.wasNear = false; nearMiss() } }
    if (b.t > 2.3) { b.alive = false; b.m.visible = false; freeRing(b.ring); b.ring = null; puff(b.pos, 0.2, 0.3, 0, 0, 0) }
  }
}
function stepPig(p, dt) {
  p.smokeT -= dt
  if (p.smokeT <= 0 && columns.length < 7) {
    p.smokeT = lerp(1.5, 0.95, dOf()); p.setFrame('hit'); p.backT = 0.4
    columns.push({ x: p.pos.x, z: p.pos.z, life: 5.5, r: 0.36, h: 1.75, emit: 0, owner: p })
    sfx('squeak', { vol: 0.3, rate: 0.7 }); line(p, 'hit', 7)
  }
  if (p.backT > 0) { p.backT -= dt; if (p.backT <= 0) p.setFrame('walk') }
}
function stepColumns(dt) {
  for (let i = columns.length - 1; i >= 0; i--) {
    const c = columns[i]; c.life -= dt; c.emit -= dt
    if (c.emit <= 0 && c.life > 0.6) { c.emit = 0.17; for (let k = 0; k < 2; k++) puff(_v.set(c.x + (Math.random() - .5) * 0.4, Math.random() * 0.4 + 0.05, c.z + (Math.random() - .5) * 0.4), 0.28, 1.5, (Math.random() - .5) * 0.1, 1.05, (Math.random() - .5) * 0.1, 0xe2dcea, 1.5) }
    if (c.life > 0.3 && Math.hypot(M.pos.x - c.x, M.pos.z - c.z) < c.r + M_R && M.pos.y < c.h) { W.inMist = true; W.mistBy = c.owner; W.mistKind = 'smoke' }
    if (c.life <= 0) columns.splice(i, 1)
  }
}

// ---------------------------------------------------------------- 1ステップ
function stepPerson(p, dt) {
  p.t += dt
  if (p.state === 'wake') { p.wiggle = Math.sin(p.t * 22) * 0.04; if (p.t > 0.8) { p.state = 'chase'; p.wiggle = 0 } return }
  if (p.state === 'act') { stepAct(p, dt); if (p.state === 'act') return }
  // 追う
  if (p.kind === 'smoke') stepPig(p, dt)
  p.cd -= dt
  _v.copy(M.pos).sub(p.pos); _v.y = 0; const dist = _v.length() || 0.001; _v.multiplyScalar(1 / dist)
  const spd = p.data.speed * (1 + Math.min(1.25, W.d) * 0.62), pref = PREFER[p.kind]
  let dv = dist > pref + 0.12 ? 1 : dist < pref - 0.35 ? -0.7 : 0
  p.vel.x = lerp(p.vel.x, _v.x * spd * dv, Math.min(1, dt * 7)); p.vel.z = lerp(p.vel.z, _v.z * spd * dv, Math.min(1, dt * 7))
  // ぶつからない
  for (const o of people) { if (o === p || o.state === 'act' && o.kind === 'leap') continue; const dx = p.pos.x - o.pos.x, dz = p.pos.z - o.pos.z, dd = Math.hypot(dx, dz); if (dd < 0.6 && dd > 0.001) { p.vel.x += dx / dd * 1.6 * dt * 6; p.vel.z += dz / dd * 1.6 * dt * 6 } }
  p.pos.addScaledVector(p.vel, dt)
  p.pos.x = clamp(p.pos.x, ROOM.x0 + 0.35, ROOM.x1 - 0.35); p.pos.z = clamp(p.pos.z, ROOM.z0 + 0.35, ROOM.z1 - 0.35)
  const sp = Math.hypot(p.vel.x, p.vel.z)
  if (sp > 0.25) { p.stepT -= dt; if (p.stepT <= 0) { p.stepT = 0.42 / (spd / 1.2); if (dist < 3.5) sfx('cloth', { vol: 0.14 * (1 - dist / 4), rate: 0.7 }) } }
  // 攻撃を始める。一度に始められるのは間隔が空いた時だけ（理不尽に重ねない）
  if (p.kind !== 'smoke' && p.cd <= 0 && W.gap <= 0 && dist <= RANGE[p.kind] && (W.tut >= 2 || W.t > 9)) {
    if (p.kind === 'net' && sector.visible) return
    if (p.kind === 'spray' && cone.visible) return
    startAct(p)
  }
}
function stepTut() {
  if (W.tut >= 3) return
  if (W.tut === 0) { tip('move'); if (W.tutMoved > 1.2) W.tut = 1 }
  else if (W.tut === 1) { tip('wing'); if (W.tutV > 0.3 || W.t > 8) W.tut = 2 }
  else if (W.tut === 2) { tip('dodge'); if (W.firstStrike) { W.tut = 3; tip(null); tutDone = true; try { localStorage.setItem('nm_tut2', '1') } catch (e) {} } }
}
function stepOnce() {
  if (!W || mode !== 'play' || paused) return
  const dt = STEP
  if (!M.alive) {
    deathT += dt
    for (const p of people) if (p.state === 'act') { stepAct(p, dt) }
    if (W.winAt > 0) { W.winAt -= dt; if (W.winAt <= 0 && W.winWho) { say.t = 0; bubble(W.winWho, W.winLine) } }
    if (say.t > 0) { say.t -= dt; if (say.t <= 0) say.el.classList.add('hidden') }
    stepFx(dt)
    if (deathT > 1.9 && !W.ended) endRun()
    return
  }
  W.t += dt; W.d = W.t / 100; W.gap -= dt
  // 登場
  while (W.spawns.length && W.t >= W.spawns[0].t) spawnPerson(W.spawns.shift().id)
  // 蚊
  const inp = gather()
  const fwdx = -Math.sin(camYaw), fwdz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw)
  const lift = Math.abs(camPitch) > 0.32 ? Math.sin(camPitch) : 0   // はっきり上下を向いている時だけカメラの向きへ上下する
  const max = 2.35 * (M.cough > 0.25 ? 0.78 : 1)
  const tx = (fwdx * inp.sy + rx * inp.sx) * max, tz = (fwdz * inp.sy + rz * inp.sx) * max
  let ty = inp.sy * lift * max + inp.v * 1.75
  if (vertPulse) { ty += Math.sign(vertPulse) * 1.75; vertPulse = Math.abs(vertPulse) < dt ? 0 : vertPulse - Math.sign(vertPulse) * dt }
  const rate = Math.min(1, dt * 12)
  M.vel.x = lerp(M.vel.x, tx, rate); M.vel.y = lerp(M.vel.y, ty, rate); M.vel.z = lerp(M.vel.z, tz, rate)
  M.pos.addScaledVector(M.vel, dt)
  W.tutMoved += Math.hypot(M.vel.x, M.vel.z) * dt; if (Math.abs(inp.v) > 0 || vertPulse) W.tutV += dt
  pushOut(M.pos)
  if (M.panic > 0) M.panic -= dt
  // 自動で振り向く: 攻撃中の人＞いちばん近い人を画面に入れておく（なぞった直後は触らない）
  if (!noAuto && look.id == null && W.t - lastLook > 1.3 && people.length) {
    let tg = null, bd = 1e9
    for (const p of people) { const dd = Math.hypot(p.pos.x - M.pos.x, p.pos.z - M.pos.z) - (p.state === 'act' && p.act && p.act.phase === 'wind' ? 2.5 : 0); if (dd < bd) { bd = dd; tg = p } }
    if (tg) { const want = Math.atan2(-(tg.pos.x - M.pos.x), -(tg.pos.z - M.pos.z)), diff = wrap(want - camYaw); if (Math.abs(diff) > 0.14) camYaw += Math.sign(diff) * Math.min(Math.abs(diff), 1.5 * dt * Math.min(1, Math.abs(diff) * 2)) }
  }
  // 家族
  W.inMist = false; W.mistBy = null; W.mistKind = null
  for (const p of people) stepPerson(p, dt)
  stepTeeth(dt); stepColumns(dt)
  // くん煙
  W.fogY = W.t > FOG_T ? (W.t - FOG_T) / FOG_DUR * ROOM.h : 0
  if (W.t > FOG_T && !W.fogSaid) { W.fogSaid = true; const mom = people.find(p => p.id === 'mom'); say.t = 0; if (mom) bubble(mom, T().fogWarn); sfx('spray', { vol: 1, rate: 0.6 }) }
  let inFog = false
  if (W.fogY > 0) { fog.visible = true; fog.position.y = W.fogY; inFog = M.pos.y < W.fogY; if (Math.random() < 0.5) puff(_v.set((Math.random() - .5) * 5.6, W.fogY, (Math.random() - .5) * 5.6), 0.5, 1.4, 0, 0.12, 0, 0xddd2e6, 0.8) }
  // むせる
  if (W.inMist || inFog) M.cough += dt * (inFog ? 1.0 : 2.1); else M.cough = Math.max(0, M.cough - dt * 0.75)
  if (M.cough >= 1 && M.alive) {
    const sprayer = people.find(p => p.kind === 'spray')
    if (inFog) kill('fog', sprayer); else if (W.mistKind === 'smoke') kill('smoke', W.mistBy); else kill('spray', sprayer)
  }
  stepTut(); stepFx(dt)
  if (say.t > 0) { say.t -= dt; if (say.t <= 0) say.el.classList.add('hidden') }
  W.chimeT -= dt; if (W.chimeT <= 0) { W.chimeT = 26 + W.R() * 20; sfx('chime', { vol: 0.14 }) }
}
function pushOut(p) {
  const R = ROOM, r = 0.1
  p.x = clamp(p.x, R.x0 + r, R.x1 - r); p.z = clamp(p.z, R.z0 + r, R.z1 - r); p.y = clamp(p.y, 0.12, R.h - 0.1)
  for (const b of room.solids) {
    if (p.x < b.min.x - r || p.x > b.max.x + r || p.y < b.min.y - r || p.y > b.max.y + r || p.z < b.min.z - r || p.z > b.max.z + r) continue
    const d = [p.x - (b.min.x - r), (b.max.x + r) - p.x, p.y - (b.min.y - r), (b.max.y + r) - p.y, p.z - (b.min.z - r), (b.max.z + r) - p.z]
    let i = 0; for (let k = 1; k < 6; k++) if (d[k] < d[i]) i = k
    if (i === 0) p.x = b.min.x - r; else if (i === 1) p.x = b.max.x + r; else if (i === 2) p.y = b.min.y - r; else if (i === 3) p.y = b.max.y + r; else if (i === 4) p.z = b.min.z - r; else p.z = b.max.z + r
  }
}

// ---------------------------------------------------------------- 結果: 指名手配書
function score() {
  const sec = W.t, r = sec < 15 ? 0 : sec < 30 ? 1 : sec < 60 ? 2 : sec < 100 ? 3 : 4
  return { sec: +fmt(sec), rank: r, rankName: T().ranks[r], bounty: Math.floor(sec * sec * 2).toLocaleString('en-US'), near: W.near, death: M.death, killer: W.killer }
}
function endRun() {
  W.ended = true; const r = score(); W.result = r
  r.record = r.sec > best; if (r.record) { best = r.sec; try { localStorage.setItem('nm_best', String(best)) } catch (e) {} }
  mode = 'result'; loopVol('buzz', 0.0001); Snd.loop('bgm', null)
  $('hud').classList.add('hidden'); say.el.classList.add('hidden'); $('fxWord').classList.add('hidden'); hideEdges(); say.t = 0
  drawPoster(r, false); show('result')
  $('report').classList.remove('slam'); void $('report').offsetWidth
  const post = `https://x.com/intent/post?text=${encodeURIComponent(T().postText({ sec: r.sec, bounty: r.bounty, rank: r.rankName }) + ' ' + T().tags)}&url=${encodeURIComponent('https://tom3games.github.io/night-mosquito/')}`
  $('btnPost').href = post
  sfx(r.record ? 'win' : 'lose', { vol: 0.8, jitter: 0 })
  W.stampTimer = setTimeout(() => { if (mode !== 'result') return; drawPoster(r, true); $('report').classList.add('slam'); sfx('thud', { vol: 1, jitter: 0 }); r.stamped = true }, 850)
}
function drawImg(g, name, x, y, h, flip) { const im = TEX[name].image, w = h * im.width / im.height; g.save(); g.translate(x, y); if (flip) g.scale(-1, 1); g.drawImage(im, -w / 2, -h, w, h); g.restore(); return w }
function drawPoster(r, stamped) {
  const c = $('report'), W_ = 900, H_ = 1240; if (c.width !== W_) { c.width = W_; c.height = H_ }
  const g = c.getContext('2d'), P = T().poster, F = '"Potta One"'
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W_, H_)
  // 紙（色あせた手配書。角は手で破いたように）
  g.fillStyle = '#ecdcae'; g.beginPath(); const rough = [[0, 8], [220, 0], [510, 10], [900, 0], [892, 330], [900, 760], [888, 1240], [520, 1230], [240, 1240], [6, 1232], [0, 700]]; rough.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill()
  g.strokeStyle = '#2b1c10'; g.lineWidth = 7; g.strokeRect(34, 34, W_ - 68, H_ - 68)
  // 見出し
  g.fillStyle = '#2b1c10'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'
  g.font = `${lang === 'ja' ? 130 : 128}px ${F}`; g.fillText(P.wanted, W_ / 2, 170)
  // 顔写真（身長の線の前に蚊）
  const bx = 150, by = 200, bw = 600, bh = 410
  g.fillStyle = '#d9c692'; g.fillRect(bx, by, bw, bh)
  g.strokeStyle = 'rgba(43,28,16,.55)'; g.lineWidth = 3; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(bx, by + bh * i / 6); g.lineTo(bx + bw, by + bh * i / 6); g.stroke() }
  drawImg(g, 'm_front', W_ / 2, by + bh - 12, 372)
  g.lineWidth = 7; g.strokeStyle = '#2b1c10'; g.strokeRect(bx, by, bw, bh)
  // 名前・罪状
  g.fillStyle = '#2b1c10'; g.font = `600 ${lang === 'ja' ? 40 : 36}px "Klee One"`; g.fillText(`${P.name}　${P.crime}`, W_ / 2, 668)
  // 秒（主役）
  g.textAlign = 'left'; const secS = fmt(r.sec), lb = P.alive
  g.font = `600 44px "Klee One"`; const lw = g.measureText(lb).width
  g.font = `150px ${F}`; const sw = g.measureText(secS).width
  g.font = `600 56px "Klee One"`; const uw = g.measureText(P.sec).width
  const total = lw + 22 + sw + 12 + uw, x0 = (W_ - total) / 2
  g.font = `600 44px "Klee One"`; g.fillText(lb, x0, 820)
  g.font = `150px ${F}`; g.fillStyle = '#a81f14'; g.fillText(secS, x0 + lw + 22, 820)
  g.font = `600 56px "Klee One"`; g.fillStyle = '#2b1c10'; g.fillText(P.sec, x0 + lw + 22 + sw + 12, 820)
  // 懸賞金
  g.textAlign = 'center'; g.font = `600 ${lang === 'ja' ? 50 : 42}px "Klee One"`; g.fillText(`${P.bounty} ${r.bounty}${P.yen}`, W_ / 2, 900)
  // 討伐者（絵＋死因）
  const kid = r.killer || 'dad'
  drawImg(g, `${kid}_walk`, 190, 1188, kid === 'cat' || kid === 'pig' ? 150 : 250)
  g.textAlign = 'left'; g.fillStyle = '#2b1c10'; g.font = `600 ${lang === 'ja' ? 36 : 30}px "Klee One"`
  const fam = FAM[kid]; g.fillText(`${P.by}: ${fam.name[lang]}`, 320, 1000)
  g.font = `600 ${lang === 'ja' ? 30 : 26}px "Klee One"`; (T().deathNote[r.death] || '').split('\n').forEach((s, i) => g.fillText(s, 320, 1048 + i * 40))
  if (r.near > 0) { g.font = `600 ${lang === 'ja' ? 28 : 24}px "Klee One"`; g.fillStyle = '#5b4a2f'; g.fillText(`${P.near} ${r.near}${P.times}`, 320, 1160) }
  // 新記録の走り書き
  if (r.record) { g.save(); g.translate(742, 262); g.rotate(0.16); g.fillStyle = '#a81f14'; g.font = `${lang === 'ja' ? 52 : 40}px ${F}`; g.textAlign = 'center'; g.fillText(P.record, 0, 0); g.restore() }
  // 判子（発表）
  if (stamped) {
    const name = r.rankName
    g.save(); g.translate(690, 1085); g.rotate(-0.2); g.strokeStyle = '#c0261a'; g.fillStyle = '#c0261a'; g.globalAlpha = 0.9; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 138, 0, 7); g.stroke(); g.lineWidth = 3.5; g.beginPath(); g.arc(0, 0, 122, 0, 7); g.stroke()
    g.textAlign = 'center'; g.textBaseline = 'middle'
    const parts = T().rankLines[r.rank]
    const fs = lang === 'ja' ? (Math.max(...parts.map(s => s.length)) > 3 ? 50 : 60) : 38
    g.font = `${fs}px ${F}`; parts.forEach((s, i) => g.fillText(s, 0, (i - (parts.length - 1) / 2) * (fs + 6)))
    g.restore()
  }
}

// ---------------------------------------------------------------- 描画
function frame(now) {
  requestAnimationFrame(frame)
  const t = performance.now()
  if (!lastT) lastT = t
  const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t
  if (mode === 'play' && !paused && !frozen) {
    if (hitStop > 0) { hitStop -= dt } else { simAcc += dt; let n = 0; while (simAcc >= STEP && n < 8) { stepOnce(); simAcc -= STEP; n++ } if (n >= 8) simAcc = 0 }
  }
  if (mode === 'play') render(dt)
}
const edgeEls = []
function hideEdges() { for (const e of edgeEls) e.el.classList.add('hidden') }
function edge(i, id, hot, vx, vy) {
  if (!edgeEls[i]) { const el = document.createElement('div'); el.className = 'edge hidden'; el.innerHTML = '<i></i>'; $('hud').appendChild(el); edgeEls[i] = { el, id: null } }
  const e = edgeEls[i]; if (e.id !== id) { e.id = id; e.el.firstChild.style.backgroundImage = `url(img/${id === 'teeth' ? 'p_teeth' : id + '_walk'}.webp?v=4)`; e.el.dataset.id = id; e.el.classList.toggle('thing', id === 'teeth') }
  e.el.classList.remove('hidden'); e.el.classList.toggle('hot', hot)
  e.el.style.transform = `translate(${vx}px,${vy}px)`
}
// 画面の外なら端に出す。戻り値は出したか
function edgeFor(i, wx, wy, wz, id, hot, w, h) {
  proj.set(wx, wy, wz).project(camera)
  const behind = proj.z > 1, on = !behind && Math.abs(proj.x) < 0.95 && Math.abs(proj.y) < 0.95
  if (on) return false
  let nx = behind ? -proj.x : proj.x, ny = behind ? -proj.y : proj.y; const mg = Math.max(Math.abs(nx), Math.abs(ny)) || 1; nx /= mg; ny /= mg
  edge(i, id, hot, clamp((nx + 1) / 2 * w, 30, w - 30) - 24, clamp((1 - ny) / 2 * h, 96, h - 196) - 24)
  return true
}
const proj = new THREE.Vector3(), camTarget = new THREE.Vector3(), lookAt = new THREE.Vector3()
function render(dt) {
  const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio()
  if (renderer.domElement.width !== Math.floor(w * pr) || renderer.domElement.height !== Math.floor(h * pr)) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix() }
  if (!W) { renderer.render(scene, camera); return }
  const tnow = performance.now() / 1000
  // カメラ（蚊の斜め後ろ・高め）
  const fx = -Math.sin(camYaw) * Math.cos(camPitch), fy = Math.sin(camPitch), fz = -Math.cos(camYaw) * Math.cos(camPitch)
  if (camOverride) { camera.position.copy(camOverride[0]); camera.lookAt(camOverride[1]) }
  else if (M.alive || deathT < 0.3) {
    camTarget.set(M.pos.x - fx * 1.75, M.pos.y - fy * 1.75 + 0.5, M.pos.z - fz * 1.75)
    camTarget.x = clamp(camTarget.x, ROOM.x0 + 0.18, ROOM.x1 - 0.18); camTarget.z = clamp(camTarget.z, ROOM.z0 + 0.18, ROOM.z1 - 0.18); camTarget.y = clamp(camTarget.y, 0.25, ROOM.h - 0.1)
    camera.position.lerp(camTarget, Math.min(1, dt * 11))
    lookAt.set(M.pos.x + fx * 0.65, M.pos.y + fy * 0.65 + 0.3, M.pos.z + fz * 0.65)
    camera.lookAt(lookAt)
  }
  if (shake > 0.001) { camera.rotation.z += (Math.random() - .5) * 0.06 * shake; camera.position.y += (Math.random() - .5) * 0.05 * shake; shake = Math.max(0, shake - dt * 2.8) }
  camera.updateMatrixWorld()
  // 蚊
  const r = mos.root
  r.quaternion.copy(camera.quaternion)
  const rx = Math.cos(camYaw), rz = -Math.sin(camYaw), lateral = M.vel.x * rx + M.vel.z * rz
  if (M.alive) {
    r.position.copy(M.pos); r.position.y += Math.sin(tnow * 11) * 0.012
    r.rotateZ(-lateral * 0.13)
    if (Math.abs(lateral) > 0.3) M.flip = lateral > 0 ? 1 : -1
    setMosFrame(M.cough > 0.12 ? 'm_cough' : M.panic > 0 ? 'm_panic' : 'm_back')
    mos.body.scale.x = mos.w * (M.frame === 'm_back' ? M.flip : 1)
    const a = Math.sin(tnow * 70) * 0.55 + 0.25
    mos.wl.rotation.z = -a; mos.wr.rotation.z = a; mos.wl.visible = mos.wr.visible = true
    mos.shadow.visible = true; mos.shadow.position.set(M.pos.x, 0.02, M.pos.z); const sc = 1 - M.pos.y / 5; mos.shadow.scale.setScalar(sc)
    loopVol('buzz', 0.05 + Math.hypot(M.vel.x, M.vel.y, M.vel.z) * 0.05, 0.9 + Math.hypot(M.vel.x, M.vel.y, M.vel.z) * 0.12)
  } else if (W.deathAt) {
    // やられた: 回りながら床へ落ちる
    const k = Math.min(1, deathT / 0.9), y = lerp(W.deathAt.y, 0.14, k * k)
    r.position.set(W.deathAt.x, y, W.deathAt.z); r.rotateZ(k * 3.4 * M.flip)
    mos.wl.visible = mos.wr.visible = false
    const s = 1 + (k < 0.15 ? k * 3 : 0.45); r.scale.setScalar(s)
    lookAt.lerp(r.position, Math.min(1, dt * 4)); camera.lookAt(lookAt); loopVol('buzz', 0.0001)
  }
  // 人物（カメラの方を向く切り絵）
  for (const p of people) {
    const m = p.mesh, dx = camera.position.x - p.pos.x, dz = camera.position.z - p.pos.z
    let bob = 0, sway = 0, sx = 1, sy = 1
    const sp = Math.hypot(p.vel.x, p.vel.z)
    if (p.state === 'chase' && sp > 0.2) { const ph = p.t * (7 + sp * 3); bob = Math.abs(Math.sin(ph)) * 0.07; sway = Math.sin(ph) * 0.09 }
    if (p.state === 'wake') { sway = p.wiggle || 0; sy = 0.7 + Math.min(1, p.t / 0.4) * 0.3; sx = 1.2 - Math.min(1, p.t / 0.4) * 0.2 }
    if (p.state === 'act' && p.act) {
      const a = p.act
      if (a.phase === 'wind') { const k = clamp(a.t / a.w, 0, 1); sy = 1 + k * 0.06; sx = 1 - k * 0.05; sway = Math.sin(a.t * 30) * 0.015 * k + (p.kind === 'leap' ? Math.sin(a.t * 40) * 0.06 : 0) }
      if (a.phase === 'strike') { const k = clamp(a.t / 0.1, 0, 1); sy = 1 - k * 0.1 * (1 - a.t); sx = 1 + k * 0.08 * (1 - a.t) }
    }
    // 叩く時は蚊の方へ少し踏み込む
    let lx = 0, lz = 0
    if (p.lunge) { const d = Math.hypot(M.pos.x - p.pos.x, M.pos.z - p.pos.z) || 1; lx = (M.pos.x - p.pos.x) / d * p.lunge; lz = (M.pos.z - p.pos.z) / d * p.lunge }
    m.position.set(p.pos.x + lx, p.y + bob, p.pos.z + lz)
    m.rotation.set(0, Math.atan2(dx, dz), 0, 'YXZ'); m.rotateZ(sway)
    if (Math.abs(p.vel.x * rx + p.vel.z * rz) > 0.3) p.flip = (p.vel.x * rx + p.vel.z * rz) > 0 ? -1 : 1
    m.scale.set(p.w * sx * (p.state === 'act' ? 1 : p.flip), p.h * sy, 1)
    // 体が蚊を隠すなら薄くする
    proj.copy(M.pos).sub(camera.position); const camToM = proj.length(), camToP = Math.hypot(dx, dz)
    p.mat.opacity = camToP < camToM - 0.1 && camToP < 1.2 ? 0.45 : 1
    p.shadow.position.set(m.position.x, 0.015, m.position.z); p.shadow.visible = true; const ss = Math.max(0.5, 1 - p.y * 0.3); p.shadow.scale.setScalar(ss)
    p.head.set(m.position.x, p.y + p.data.h * 1.02, m.position.z)
  }
  for (const b of teethPool) if (b.alive) { b.m.quaternion.copy(camera.quaternion); b.m.rotateZ(tnow * 14) }
  for (const b of bursts) if (b.visible) b.quaternion.copy(camera.quaternion)
  room.fan.rotation.y = Math.atan2(camera.position.x - room.fan.position.x, camera.position.z - room.fan.position.z)
  room.pull.rotation.z = Math.sin(tnow * 1.7) * 0.1
  // 手札: 時計・むせ・白光り
  $('clockT').textContent = fmt(W.t)
  $('clockS').setAttribute('transform', `rotate(${(W.t * 6) % 360} 20 22)`)
  $('fxCough').style.opacity = clamp(M.cough * 0.9, 0, 0.9)
  if (flash > 0) { $('fxFlash').style.opacity = flash * 0.75; flash = Math.max(0, flash - dt * 3.5); if (flash === 0) $('fxFlash').style.opacity = 0 }
  if (W.nearUntil && W.t > W.nearUntil) { $('nearW').classList.add('hidden'); W.nearUntil = 0 }
  // 画面外の人の顔を端に出す（攻撃中は赤）
  let ei = 0
  if (mode === 'play') {
    for (const p of people) if (edgeFor(ei, p.pos.x, p.y + p.data.h * 0.75, p.pos.z, p.id, p.state === 'act', w, h)) ei++
    for (const b of teethPool) if (b.alive && edgeFor(ei, b.pos.x, b.pos.y, b.pos.z, 'teeth', true, w, h)) ei++
    for (let i = ei; i < edgeEls.length; i++) edgeEls[i].el.classList.add('hidden')
  }
  // 吹き出しの位置
  if (say.who && say.t > 0 && !say.el.classList.contains('hidden')) {
    proj.copy(say.who.head).project(camera); const behind = proj.z > 1
    const bw = say.el.offsetWidth, bh = say.el.offsetHeight
    const px = clamp(((behind ? -proj.x : proj.x) + 1) / 2 * w - bw / 2, 8, w - bw - 8), py = clamp((1 - (behind ? -1 : proj.y)) / 2 * h - bh - 10, 78, h - 240)
    say.el.style.transform = `translate(${Math.round(px)}px,${Math.round(py)}px)`
  }
  renderer.render(scene, camera)
}

// ---------------------------------------------------------------- 検証用: 今見えている危険の一覧（bot と検証が読む。ゲーム本体は使わない）
function threats() {
  const out = []
  for (const p of people) {
    const a = p.act; if (!a) continue
    if (a.ring && (a.kind === 'swat' || a.kind === 'zap' || a.kind === 'leap')) out.push({ type: 'point', pos: a.aim.clone(), r: a.r, left: a.phase === 'wind' ? a.w - a.t : 0, age: a.t, who: p.id, locked: a.locked })
    if (a.kind === 'spray' && (a.phase === 'wind' || a.phase === 'fire')) out.push({ type: 'cone', o: mouth(p, new THREE.Vector3()), dir: a.dir.clone(), L: SPRAY.L, half: SPRAY.half, firing: a.phase === 'fire', age: a.phase === 'wind' ? a.t : 9, who: p.id })
    if (a.kind === 'net' && (a.phase === 'wind' || a.phase === 'sweep')) out.push({ type: 'sector', c: p.pos.clone(), dir: a.dir.clone(), h: a.h, r1: NET.r1, half: NET.half, dy: NET.dy, age: a.phase === 'wind' ? a.t : 9, who: p.id })
  }
  for (const b of teethPool) if (b.alive) out.push({ type: 'ball', pos: b.pos.clone(), vel: b.vel.clone(), r: 0.17, age: b.t + 0.3, who: 'gramps' })
  for (const c of columns) out.push({ type: 'column', x: c.x, z: c.z, r: c.r, h: c.h, age: 9, who: 'pig' })
  return out
}

// ---------------------------------------------------------------- 起動
applyLang()
const fontsReady = document.fonts ? Promise.race([Promise.all(['400 40px "Potta One"', '600 40px "Klee One"'].map(f => document.fonts.load(f, '指名手配夏の夜蚊逃亡秒懸賞金円討伐父母たろうじいちゃんAa0'))), new Promise(r => setTimeout(r, 4000))]).catch(() => {}) : Promise.resolve()
Promise.all([loadAll(), fontsReady]).then(() => {
  room = buildRoom(scene, TEX)
  buildActors()
  mode = 'title'
  const b = $('boot'); b.style.setProperty('--p', 1); $('bootMsg').textContent = T().loadingDone
  setTimeout(() => { b.classList.add('gone'); setTimeout(() => b.remove(), 600) }, 300)
  show('title')
  window.__nmReady = true
}).catch(e => { $('bootMsg').textContent = 'load error: ' + e.message; throw e })
setTimeout(() => { const b = $('boot'); if (b && !window.__nmReady) b.classList.add('gone') }, 12000)
requestAnimationFrame(frame)

// ---------------------------------------------------------------- 検証用の窓口
window.nm = {
  start, toTitle, get W() { return W }, M, people: () => people, threats, FOG_T, FOG_DUR, ROOM, setMosFrame,
  get mode() { return mode }, get camYaw() { return camYaw }, get best() { return best }, get paused() { return paused }, get stick() { return stick },
  get cone() { return cone }, get sector() { return sector }, get camera() { return camera }, get swatter() { return swatter }, get fog() { return fog },
  dbg: {
    pause(on = true) { frozen = on },
    step(n = 1) { for (let i = 0; i < n; i++) { if (mode !== 'play') break; stepOnce() } },
    input(fn) { testInput = fn },
    noAuto(v = true) { noAuto = v },
    setCam(y, p) { camYaw = y; camPitch = p },
    setT(t) { W.t = t; W.d = t / 100 },
    render(n = 1, dt = 0.016) { for (let i = 0; i < n; i++) render(dt) },
    cam(p, l) { camOverride = p ? [new THREE.Vector3(...p), new THREE.Vector3(...l)] : null },
    spawn(id) { return spawnPerson(id) },
    gap(v) { W.gap = v },
  },
  score,
  state: () => ({ mode, t: W && +W.t.toFixed(2), alive: M.alive, death: M.death, near: W && W.near, cough: +M.cough.toFixed(2), n: people.length, who: people.map(p => [p.id, p.state, p.act && p.act.phase]) }),
}
