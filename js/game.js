// 夏の夜の蚊。自分が蚊になって、寝ている家族の血を吸う。3D・蚊の斜め後ろからのカメラ
// 物理と判定は固定60Hz（performance.now で数える）。描画は毎フレーム
import * as THREE from 'three'
import { buildRoom, futon, towel, ROOM } from './room.js?v=3'
import { loadFamily, Sleeper, Cat, makeMosquito } from './family.js?v=3'

window.__jsUp = true
const $ = id => document.getElementById(id)
const TX = window.NM_TEXT, FAM = window.NM_FAMILY, MORN = window.NM_MORNING
const coarse = matchMedia('(pointer: coarse)').matches
const LOW = coarse || Math.min(screen.width, screen.height) < 700
const NIGHT = 180                    // 1晩の秒数（23時→5時）
const STEP = 1 / 60
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, k) => a + (b - a) * k
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

let lang = /^ja/.test(navigator.language || 'ja') ? 'ja' : 'en'
try { const l = localStorage.getItem('nm_lang'); if (l) lang = l } catch (e) {}
let muted = false
try { muted = localStorage.getItem('nm_mute') === '1' } catch (e) {}
let tutDone = false
try { tutDone = localStorage.getItem('nm_tut') === '1' } catch (e) {}
const T = () => TX[lang]

// ---------------------------------------------------------------- 描画の土台
const renderer = new THREE.WebGLRenderer({ antialias: !LOW, powerPreference: 'high-performance', preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.5 : 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15
renderer.shadowMap.enabled = !LOW; renderer.shadowMap.type = THREE.PCFSoftShadowMap
$('view').appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0b0d16)
scene.fog = new THREE.Fog(0x0b0d16, 3.5, 8)
const camera = new THREE.PerspectiveCamera(64, 1, 0.004, 20)
camera.rotation.order = 'YXZ'

const manager = new THREE.LoadingManager()
let loadFrac = 0
manager.onProgress = (u, a, b) => { loadFrac = a / Math.max(1, b); bootProgress(loadFrac) }
function bootProgress(f) { const b = $('boot'); if (b) b.style.setProperty('--p', f.toFixed(3)) }

const room = buildRoom(scene, { low: LOW })

// ---------------------------------------------------------------- 音（録音素材だけ）
Snd.def({
  slap: ['snd/slap1.mp3', 'snd/slap2.mp3', 'snd/slap3.mp3'], squish: ['snd/squish1.mp3', 'snd/squish2.mp3'],
  swish: ['snd/swish1.mp3', 'snd/swish2.mp3', 'snd/swish3.mp3'], cloth: ['snd/cloth1.mp3', 'snd/cloth2.mp3', 'snd/cloth3.mp3'],
  grunt: ['snd/grunt1.mp3', 'snd/grunt2.mp3', 'snd/grunt3.mp3'], click: 'snd/click.mp3', switch: 'snd/switch.mp3',
  spray: 'snd/spray.mp3', meow: 'snd/meow.mp3', pop: ['snd/pop1.mp3', 'snd/pop2.mp3'], thud: 'snd/thud.mp3',
  win: 'snd/win.mp3', lose: 'snd/lose.mp3', rank: 'snd/rank.mp3', birds: 'snd/birds.mp3', chime: 'snd/chime.mp3', suck: 'snd/suck1.mp3',
})
Snd.setMute(muted)
const sfx = (n, o) => Snd.play(n, o)
const LOOPS = { amb: ['snd/crickets.mp3', 0.28], fan: ['snd/fan.mp3', 0], buzz: ['snd/buzz.mp3', 0], snore: ['snd/snore.mp3', 0] }
let ambOn = false
function audioOn() { Snd.init(); if (!ambOn && Snd.ctx) { ambOn = true; for (const k in LOOPS) Snd.loop(k, LOOPS[k][0], Math.max(0.0001, LOOPS[k][1])) } }
function loopVol(slot, v, rate) { const l = Snd.loops[slot]; if (!l || !l.g || !Snd.ctx) return; const t = Snd.ctx.currentTime; l.g.gain.setTargetAtTime(Math.max(0.0001, v), t, 0.08); if (rate && l.node) l.node.playbackRate.setTargetAtTime(rate, t, 0.1) }

// ---------------------------------------------------------------- 乱数（夜ごとのくじ）
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// ---------------------------------------------------------------- 状態
const mos = makeMosquito(); scene.add(mos.root)
const M = {   // 蚊
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), full: 0, total: 0, dizzy: 0, state: 'fly', perch: null, land: 0, landFrom: new THREE.Vector3(),
  wind: 0, flap: 0, up: new THREE.Vector3(0, 1, 0), alive: true, death: null,
}
let W = null   // 1晩の状態
let mode = 'loading', paused = false, simAcc = 0, lastT = 0, frozen = false
let camDist = 0.1, camYaw = 0, camPitch = -0.15, shake = 0, flash = 0, hitStop = 0, deathT = 0, glowTarget = null, nearSurface = null
const say = { el: $('say'), who: null, t: 0 }
let testInput = null, camOverride = null
const people = []
let cat = null, futons = [], props = []

// 光る肌（刺せる場所の目印）
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,190,1)'); gr.addColorStop(0.4, 'rgba(255,150,130,.5)'); gr.addColorStop(1, 'rgba(255,120,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t })()
const glows = []
for (let i = 0; i < 28; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, opacity: 0 })); s.visible = false; scene.add(s); glows.push(s) }

// 煙（蚊取り線香）とスプレーの霧
const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(220,226,235,.55)'); gr.addColorStop(1, 'rgba(220,226,235,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t })()
const smoke = []
for (let i = 0; i < (LOW ? 36 : 60); i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 })); s.userData = { t: Math.random() * 6, ph: Math.random() * 6 }; scene.add(s); smoke.push(s) }
const mist = []
for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0, color: 0xd8f0ff })); s.userData = { life: 0, v: new THREE.Vector3() }; s.visible = false; scene.add(s); mist.push(s) }

// 飛んでくる手（腕＋手のひら）・うちわ・スプレー缶
const skin = new THREE.MeshStandardMaterial({ color: 0xf0b48c, roughness: 0.8 })
function makeArm(sleeve) {
  const g = new THREE.Group()
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1, 10), new THREE.MeshStandardMaterial({ color: sleeve, roughness: 0.9 })); arm.geometry.translate(0, 0.5, 0); g.add(arm)
  const palm = new THREE.Group(); g.add(palm)
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.12), skin); palm.add(p)
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.03, 0.07), skin); f.position.set(-0.04 + i * 0.027, 0, 0.09); palm.add(f) }
  const th = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.055), skin); th.position.set(0.065, 0, 0.02); th.rotation.y = -0.6; palm.add(th)
  g.visible = false; scene.add(g)
  return { g, arm, palm }
}
const hands = [makeArm(0x2b2f3a), makeArm(0x2b2f3a)]
const uchiwa = (() => {
  const g = new THREE.Group()
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#f5f0e2'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill(); x.fillStyle = '#2f6fa8'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(64, 120 - i * 22, 30 + i * 12, Math.PI * 1.1, Math.PI * 1.9); x.lineWidth = 7; x.strokeStyle = '#2f6fa8'; x.stroke() } x.fillStyle = '#d6453a'; x.beginPath(); x.arc(84, 44, 14, 0, 7); x.fill()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.15, 28), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 })); face.position.y = 0.2; g.add(face)
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0x9a7a4a })); h.position.y = 0.04; g.add(h)
  g.visible = false; scene.add(g); return g
})()
const can = (() => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 14), new THREE.MeshStandardMaterial({ color: 0xe8b62a, metalness: 0.5, roughness: 0.35 })); b.rotation.x = Math.PI / 2; g.add(b); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.04, 10), new THREE.MeshStandardMaterial({ color: 0xdd3333 })); t.rotation.x = Math.PI / 2; t.position.z = -0.12; g.add(t); g.visible = false; scene.add(g); return g })()
// 壁のシミ
const stain = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.visible = false; scene.add(m); m.userData.c = c; return m })()
function drawStain(red) {
  const c = stain.userData.c, g = c.getContext('2d'); g.clearRect(0, 0, 128, 128)
  g.fillStyle = red ? 'rgba(150,10,20,.92)' : 'rgba(40,36,34,.85)'
  g.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = 18 + (i % 3) * 7 + Math.random() * 8; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r) } g.closePath(); g.fill()
  for (let i = 0; i < 9; i++) { const a = Math.random() * 7, r = 30 + Math.random() * 26; g.beginPath(); g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 2 + Math.random() * 4, 0, 7); g.fill() }
  g.strokeStyle = 'rgba(10,10,10,.9)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(64, 64); const a = Math.random() * 7; g.lineTo(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26); g.stroke() }
  stain.material.map.needsUpdate = true
}

// ---------------------------------------------------------------- 1晩の組み立て（くじ）
function clearNight() {
  for (const p of people) { p.root.removeFromParent(); for (const z of p.zs) z.removeFromParent() }
  people.length = 0
  for (const f of futons) f.removeFromParent(); futons = []
  for (const p of props) p.removeFromParent(); props = []
  if (cat) { cat.root.removeFromParent(); cat = null }
}
function newNight(seed, opts = {}) {
  clearNight()
  const R = rng(seed)
  const gramps = opts.gramps ?? R() < 0.35, hasCat = opts.cat ?? R() < 0.3
  W = { seed, t: 0, R, gramps, cat: hasCat, light: 0, lightCount: 0, kidRolls: 0, kidRollT: 18 + R() * 8, events: [], bites: [], lastTalk: 0, ended: false, hintT: 0, tut: tutDone ? 99 : 0, tutT: 0, movedDist: 0, fanA: 0, restedT: 0, seenFull: false, wakes: 0 }
  // 父（毛深い足・大の字）・たろう（ばんざい・タオルケットは蹴飛ばした）・母（腕は体の横）
  const dad = new Sleeper(scene, 'dad', FAM.dad, -1.15, -1.45, 0, { pose: 'wide', hairy: true })
  const kid = new Sleeper(scene, 'kid', FAM.kid, 0.02, -1.35, 0.15, { pose: 'up' })
  const mom = new Sleeper(scene, 'mom', FAM.mom, 1.12, -1.45, 0, { pose: 'side' })
  people.push(dad, mom, kid)
  futons.push(futon(scene, 'dad', -1.15, -1.45, 0, 1.6, 0.9), futon(scene, 'kid', 0.0, -1.4, 0, 1.25, 0.75), futon(scene, 'mom', 1.12, -1.45, 0, 1.6, 0.9))
  // タオルケット（父はお腹だけ・母は胸まで・たろうは足元に丸まっている）
  const tD = towel('#d9c27a', '#efe3b2', 0.8, 0.32, 0.3); tD.position.set(-1.15, 0.09, -0.78); scene.add(tD); props.push(tD)
  const tM = towel('#e7a3b0', '#f6dde2', 0.86, 0.62, 0.31); tM.position.set(1.12, 0.09, -0.6); scene.add(tM); props.push(tM)
  const tK = towel('#7fb6d6', '#d6ecf6', 0.42, 0.3, 0.07); tK.position.set(0.25, 0.09, -0.05); tK.rotation.y = 0.7; scene.add(tK); props.push(tK)
  mom.cover = []
  if (gramps) {
    const g = new Sleeper(scene, 'gramps', FAM.gramps, -1.55, 1.15, Math.PI / 2, { pose: 'side', bald: true })
    people.push(g); futons.push(futon(scene, 'gramps', -1.55, 1.15, Math.PI / 2, 1.6, 0.9))
    const tG = towel('#8a7a5a', '#c9bb98', 0.86, 0.6, 0.31); tG.position.set(-0.78, 0.09, 1.15); tG.rotation.y = Math.PI / 2; scene.add(tG); props.push(tG)
    // 枕元の入れ歯（コップの中）
    const cup = new THREE.Group(); cup.position.set(-1.6, 0, 0.45); scene.add(cup); props.push(cup)
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide })); gl.position.y = 0.05; cup.add(gl)
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.033, 0.07, 16), new THREE.MeshStandardMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.3 })); water.position.y = 0.035; cup.add(water)
    const gum = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.008, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe88a96 })); gum.position.set(0, 0.04, 0); gum.rotation.x = 0.4; cup.add(gum)
    for (let i = 0; i < 7; i++) { const a = i / 6 * Math.PI; const t = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.01, 0.006), new THREE.MeshStandardMaterial({ color: 0xfaf8f0 })); t.position.set(Math.cos(a) * 0.02, 0.05, Math.sin(a) * 0.02 * Math.cos(0.4)); cup.add(t) }
  }
  room.table.visible = !gramps
  room.tableSolid.min.y = gramps ? -10 : 0; room.tableSolid.max.y = gramps ? -9 : 0.35
  if (hasCat) cat = new Cat(scene, 1.45, 0.35)
  for (const p of people) { p.updateWorld() }
  // 蚊は手前のふすまのすき間から入ってくる
  M.pos.set(-0.2, 1.1, 1.55); M.vel.set(0, 0, 0); M.full = 0; M.total = 0; M.dizzy = 0; M.state = 'fly'; M.perch = null; M.alive = true; M.death = null; M.wind = 0
  camYaw = 0; camPitch = -0.28
  room.setLight(false); room.setDawn(0); stain.visible = false; mos.root.visible = true; mos.root.scale.set(1, 1, 1)
  hands.forEach(h => h.g.visible = false); uchiwa.visible = false; can.visible = false
  for (const m of mist) { m.visible = false; m.userData.life = 0 }
}

// ---------------------------------------------------------------- 入力
const keys = new Set()
const stick = { x: 0, y: 0, id: null }
let vertBtn = 0, vertPulse = 0, biteBuf = false
const look = { id: null, x: 0, y: 0 }
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
  keys.add(e.code); audioOn()
  if (mode === 'play' && !e.repeat && ['KeyE', 'Enter', 'KeyF'].includes(e.code)) biteBuf = true
  if (mode === 'play' && e.code === 'Escape') setPause(!paused)
  if (mode === 'result' && !e.repeat && (e.code === 'Enter' || e.code === 'KeyR')) start()
})
addEventListener('keyup', e => keys.delete(e.code))
addEventListener('blur', () => { keys.clear(); if (mode === 'play') setPause(true) })
// 左下に固定したスティック
;(() => {
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
// 見回す（右側をなぞる。PC はどこでもドラッグ）
const view = $('view')
view.addEventListener('pointerdown', e => { audioOn(); if (look.id != null) return; look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; try { view.setPointerCapture(e.pointerId) } catch (er) {} })
view.addEventListener('pointermove', e => {
  if (e.pointerId !== look.id) return
  const k = coarse ? 0.0072 : 0.0048
  camYaw -= (e.clientX - look.x) * k; camPitch = clamp(camPitch - (e.clientY - look.y) * k, -1.3, 1.1)
  look.x = e.clientX; look.y = e.clientY
})
const lookEnd = e => { if (e.pointerId === look.id) look.id = null }
view.addEventListener('pointerup', lookEnd); view.addEventListener('pointercancel', lookEnd)
// 上下（羽ボタン。1回押すと少し上がる・押している間は上がり続ける）
for (const [id, d] of [['btnUp', 1], ['btnDown', -1]]) {
  const b = $(id)
  b.addEventListener('pointerdown', e => { e.preventDefault(); audioOn(); vertBtn = d; vertPulse = 0.28 * d; b.classList.add('on') })
  for (const n of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(n, () => { if (vertBtn === d) vertBtn = 0; b.classList.remove('on') })
}
$('btnBite').addEventListener('pointerdown', e => { e.preventDefault(); audioOn(); if (mode === 'play') biteBuf = true })

function gather() {
  if (testInput) return testInput()
  let sx = stick.x, sy = stick.y, v = vertBtn
  if (keys.has('KeyA') || keys.has('ArrowLeft')) sx -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) sx += 1
  if (keys.has('KeyW') || keys.has('ArrowUp')) sy += 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) sy -= 1
  if (keys.has('Space')) v = 1
  if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyC')) v = -1
  const b = biteBuf; biteBuf = false
  return { sx: clamp(sx, -1, 1), sy: clamp(sy, -1, 1), v, bite: b }
}

// ---------------------------------------------------------------- 画面
function show(id) { for (const s of ['title', 'how', 'result', 'pause']) $(s).classList.toggle('hidden', s !== id) }
function applyLang() {
  document.documentElement.lang = lang
  for (const el of document.querySelectorAll('[data-t]')) { const v = T()[el.dataset.t]; if (typeof v === 'string') el.textContent = v }
  $('howList').innerHTML = T().how.map(s => `<li>${s}</li>`).join('')
  $('howKeys').innerHTML = (coarse ? T().keysTouch : T().keysPC).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')
  $('btnMute').textContent = muted ? T().soundOff : T().soundOn
  $('biteLbl').textContent = T().lbl[$('btnBite').dataset.s] || ''
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
$('btnSave').onclick = () => { const a = document.createElement('a'); a.download = 'kayumi-report.png'; a.href = $('report').toDataURL('image/png'); a.click() }

function setPause(on) { if (mode !== 'play') return; paused = on; $('pause').classList.toggle('hidden', !on); if (!on) { lastT = performance.now(); simAcc = 0 } }
function toTitle() {
  mode = 'title'; paused = false; testInput = null
  newNight(Math.floor(Math.random() * 1e9))
  show('title'); $('hud').classList.add('hidden'); applyLang()
  M.pos.set(0.35, 0.95, -0.2)
}
function start(seed, opts) {
  audioOn()
  newNight(seed ?? Math.floor(Math.random() * 1e9), opts || {})
  mode = 'play'; paused = false; shake = flash = hitStop = 0; deathT = 0; say.t = 0; say.who = null; say.el.classList.add('hidden')
  show(null); $('hud').classList.remove('hidden'); $('touch').classList.toggle('hidden', !coarse)
  $('tip').classList.add('hidden')
  lastT = performance.now(); simAcc = 0
  sfx('click', { vol: 0.5 })
}

// 吹き出し（寝言など）。同時に1つ。表示時間は 0.9秒＋1字0.09秒
function bubble(who, line, cls = '') {
  if (say.t > 0.3) return false
  say.who = who; say.el.textContent = line; say.el.className = 'say ' + cls; say.t = 0.9 + line.length * 0.09 + 0.6
  return true
}
const pick = (a, n) => a[Math.floor(n) % a.length]
let tipKey = null
function tip(k) { if (tipKey === k) return; tipKey = k; const el = $('tip'); if (!k) { el.classList.add('hidden'); return } el.textContent = T().tut[k] || T().say[k] || k; el.classList.remove('hidden') }

// ---------------------------------------------------------------- 当たり
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion()
function pushOut(p, r = 0.012) {
  const R = ROOM
  p.x = clamp(p.x, R.x0 + r, R.x1 - r); p.z = clamp(p.z, R.z0 + r, R.z1 - r); p.y = clamp(p.y, r + 0.002, R.h - r)
  for (const b of room.solids) {
    if (p.x < b.min.x - r || p.x > b.max.x + r || p.y < b.min.y - r || p.y > b.max.y + r || p.z < b.min.z - r || p.z > b.max.z + r) continue
    const d = [p.x - (b.min.x - r), (b.max.x + r) - p.x, p.y - (b.min.y - r), (b.max.y + r) - p.y, p.z - (b.min.z - r), (b.max.z + r) - p.z]
    let i = 0; for (let k = 1; k < 6; k++) if (d[k] < d[i]) i = k
    if (i === 0) p.x = b.min.x - r; else if (i === 1) p.x = b.max.x + r; else if (i === 2) p.y = b.min.y - r; else if (i === 3) p.y = b.max.y + r; else if (i === 4) p.z = b.min.z - r; else p.z = b.max.z + r
  }
  for (const pp of people) for (const c of pp.cols) {
    const d = p.distanceTo(c.w), rr = c.r + r
    if (d < rr && d > 1e-5) p.sub(c.w).multiplyScalar(rr / d).add(c.w)
  }
  // 布団の上面
  for (const f of futons) { const lp = f.worldToLocal(_v2.copy(p)); if (Math.abs(lp.x) < 0.5 && lp.z > -0.2 && lp.z < 1.8 && lp.y < 0.09 + r) { lp.y = 0.09 + r; p.copy(f.localToWorld(lp)) } }
}
// 近くの面（とまれる所）
function nearestSurface(p) {
  const R = ROOM, cands = [
    [p.x - R.x0, 1, 0, 0], [R.x1 - p.x, -1, 0, 0], [p.z - R.z0, 0, 0, 1], [R.z1 - p.z, 0, 0, -1], [R.h - p.y, 0, -1, 0], [p.y, 0, 1, 0],
  ]
  for (const b of room.solids) {
    if (p.x > b.min.x - 0.1 && p.x < b.max.x + 0.1 && p.z > b.min.z - 0.1 && p.z < b.max.z + 0.1 && p.y > b.max.y - 0.02 && p.y < b.max.y + 0.12) cands.push([p.y - b.max.y, 0, 1, 0])
  }
  let best = null; for (const c of cands) if (c[0] < 0.1 && (!best || c[0] < best[0])) best = c
  if (!best) return null
  const n = new THREE.Vector3(best[1], best[2], best[3])
  return { n, p: p.clone().addScaledVector(n, -best[0] + 0.006) }
}
function nearestSpot(p, maxD) {
  let best = null, bd = maxD
  for (const pp of people) { if (pp.state !== 'sleep') continue; for (const s of pp.spots) { if (!s.ok) continue; const d = p.distanceTo(s.w); if (d < bd) { bd = d; best = s } } }
  return best
}

// ---------------------------------------------------------------- 1歩（固定60Hz）
function fanDir(out) { const a = room.fan.root.rotation.y + room.fan.neck.rotation.y; return out.set(Math.sin(a), 0, Math.cos(a)) }
function stepOnce() {
  if (!W || mode !== 'play' || paused) return
  const dt = STEP
  if (!M.alive) { deathT += dt; if (deathT > 2.2 && !W.ended) endNight(); return }
  W.t += dt
  const inp = gather()
  // 扇風機の首振り（左右 0.75rad・9秒で1往復）
  W.fanA += dt; room.fan.root.rotation.y = -2.45; room.fan.neck.rotation.y = Math.sin(W.fanA * Math.PI * 2 / 9) * 0.75
  // 電気
  if (W.light > 0) { W.light -= dt; if (W.light <= 0) { room.setLight(false); sfx('switch', { vol: 0.5 }) } }
  // 夜明け（4:20 から）
  const dawnK = smooth(NIGHT - 22, NIGHT, W.t); room.setDawn(dawnK)
  if (W.t > NIGHT - 12 && !W.birds) { W.birds = true; sfx('birds', { vol: 0.5, jitter: 0 }) }
  W.chimeT = (W.chimeT ?? 12) - dt; if (W.chimeT <= 0) { W.chimeT = 26 + W.R() * 20; sfx('chime', { vol: 0.18, dest: 'muf' }) }   // 窓の外の風鈴

  // ---- 家族
  for (const p of people) stepPerson(p, dt)
  if (cat) stepCat(dt)
  for (const p of people) p.updateWorld()

  // ---- 蚊
  const fwd = _v.set(-Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), -Math.cos(camYaw) * Math.cos(camPitch))
  const right = _v2.set(Math.cos(camYaw), 0, -Math.sin(camYaw))
  const heavy = 1 - M.full * 0.55
  const maxSpd = 0.95 * heavy * (M.dizzy > 0.3 ? 0.7 : 1)
  glowTarget = null; nearSurface = null
  if (M.state === 'fly') {
    const tx = fwd.x * inp.sy + right.x * inp.sx, ty = fwd.y * inp.sy, tz = fwd.z * inp.sy + right.z * inp.sx
    let vy = ty * maxSpd + inp.v * maxSpd * 0.85
    if (vertPulse) { vy += Math.sign(vertPulse) * maxSpd * 0.85; vertPulse -= Math.sign(vertPulse) * dt; if (Math.abs(vertPulse) < dt) vertPulse = 0 }
    const k = Math.min(1, dt * 6)
    M.vel.x += (tx * maxSpd - M.vel.x) * k; M.vel.z += (tz * maxSpd - M.vel.z) * k; M.vel.y += (vy - M.vel.y) * k
    M.vel.y -= M.full * 0.05 * dt   // 重いと少しずつ沈む
    // ふらふら（煙）
    if (M.dizzy > 0.2) { M.vel.x += Math.sin(W.t * 7.1) * M.dizzy * 0.02; M.vel.y += Math.sin(W.t * 5.3) * M.dizzy * 0.02; M.vel.z += Math.cos(W.t * 6.7) * M.dizzy * 0.02 }
    // 扇風機の風
    const fp = room.fan.neck.getWorldPosition(new THREE.Vector3()), fd = fanDir(new THREE.Vector3())
    const rel = M.pos.clone().sub(fp), along = rel.dot(fd), dist = rel.length()
    let windK = 0
    if (along > 0 && dist < 2.6) { const off = rel.clone().addScaledVector(fd, -along).length(); windK = clamp(1 - off / (0.18 + along * 0.32), 0, 1) * (1 - dist / 2.6) }
    M.wind = lerp(M.wind, windK, 0.1)
    M.pos.addScaledVector(M.vel, dt).addScaledVector(fd, windK * 2.2 * dt)
    if (windK > 0.35 && !W.windSaid) { W.windSaid = true; bubble('me', T().say.wind) }
    if (windK < 0.05) W.windSaid = false
    pushOut(M.pos)
    W.movedDist += M.vel.length() * dt
    // 刺せる場所・とまれる面
    glowTarget = nearestSpot(M.pos, 0.14)
    if (!glowTarget) nearSurface = nearestSurface(M.pos)
    if (inp.bite) {
      if (glowTarget) { M.state = 'land'; M.perch = glowTarget; M.land = 0; M.landFrom.copy(M.pos); sfx('pop', { vol: 0.25 }) }
      else if (nearSurface) { M.state = 'rest'; M.perch = nearSurface; M.land = 0; M.landFrom.copy(M.pos) }
    }
  } else if (M.state === 'land' || M.state === 'suck') {
    const s = M.perch
    if (!s.ok || s.owner.state !== 'sleep') { takeOff(true) }
    else {
      M.land = Math.min(1, M.land + dt / 0.3)
      const target = s.w.clone().addScaledVector(s.wn, 0.006)
      M.pos.lerpVectors(M.landFrom, target, smooth(0, 1, M.land)); M.vel.set(0, 0, 0)
      if (M.land >= 1 && M.state === 'land') {
        if (s.hairy) { bubble('me', T().say.hairy); s.owner.alert += 0.12 * s.owner.sens; takeOff(); M.vel.set(0, 0.25, 0) }
        else { M.state = 'suck'; M.suckT = 0; M.counted = false }
      }
      if (M.state === 'suck') {
        M.suckT += dt
        if (M.full >= 1) { if (!W.fullSaid) { W.fullSaid = true; bubble('me', T().say.full) } }
        else if (s.stock <= 0) { if (!s.drySaid) { s.drySaid = true; bubble('me', T().say.dry) } }
        else {
          const d = Math.min(0.11 * dt, s.stock, 1 - M.full); M.full += d; M.total += d; s.stock -= d
          if (Math.random() < dt * 1.4) sfx('suck', { vol: 0.12 })
        }
        if (!M.counted && M.suckT > 0.45) { M.counted = true; W.bites.push({ who: s.owner.id, key: s.key }); s.owner.bites.push(s.key) }
        s.owner.alert += s.owner.sens * (s.face ? 0.05 : 0.022) * dt * (W.light > 0 ? 1.6 : 1)
      }
      if (inp.bite) takeOff()
    }
  } else if (M.state === 'rest') {
    M.land = Math.min(1, M.land + dt / 0.3)
    M.pos.lerpVectors(M.landFrom, M.perch.p, smooth(0, 1, M.land)); M.vel.set(0, 0, 0)
    M.full = Math.max(0, M.full - 0.06 * dt)
    W.restedT += dt
    // 電気がついている時に壁にとまっていると見つかる
    if (W.light > 0) { M.seenT = (M.seenT || 0) + dt; const mom = people.find(p => p.id === 'mom'); if (M.seenT > 2.4 && mom && mom.state === 'sleep') { startAct(mom, true) } } else M.seenT = 0
    if (inp.bite || inp.sy || inp.sx || inp.v) takeOff()
  }
  // 煙・スプレーの霧
  const c = room.coil.pos, drift = Math.sin(W.t * 0.4) * 0.08
  const sy = M.pos.y - c.y
  let inSmoke = false
  if (sy > 0 && sy < 1.25) { const r = 0.12 + sy * 0.18, dx = M.pos.x - (c.x + drift * sy), dz = M.pos.z - (c.z + drift * 0.5 * sy); if (dx * dx + dz * dz < r * r) inSmoke = true }
  let inMist = 0; for (const m of mist) if (m.visible && m.userData.life > 0 && m.position.distanceTo(M.pos) < m.scale.x * 0.45) inMist++
  if (inSmoke) { M.dizzy += 0.5 * dt; if (!W.smokeSaid) { W.smokeSaid = true; bubble('me', T().say.smoke) } } else W.smokeSaid = false
  if (inMist) M.dizzy += Math.min(3, inMist) * 0.5 * dt
  if (!inSmoke && !inMist) M.dizzy = Math.max(0, M.dizzy - 0.3 * dt)
  if (M.dizzy >= 1) return kill(inMist ? 'spray' : 'smoke')
  // 耳元の羽音で起きかける
  for (const p of people) {
    if (p.state !== 'sleep') continue
    const d = M.pos.distanceTo(p.headPos)
    const buzz = M.state === 'fly' ? clamp((0.55 - d) / 0.45, 0, 1) : 0
    p.near = buzz
    const lm = W.light > 0 ? 1.6 : 1
    if (buzz > 0) p.alert += p.sens * lm * Math.pow(buzz, 1.5) * 0.6 * dt
    else if (!(M.perch && M.perch.owner === p && M.state === 'suck')) p.alert = Math.max(0, p.alert - 0.035 * dt)
    if (p.cool > 0) p.alert = Math.min(p.alert, 0.9)
  }
  // チュートリアル（1回だけ）
  stepTut(dt)
  if (W.t >= NIGHT) endNight()
}
function takeOff(shaken) { M.state = 'fly'; M.perch = null; M.vel.set(0, shaken ? 0.4 : 0.2, 0); if (shaken) shake = Math.max(shake, 0.15) }
function kill(kind) {
  if (!M.alive) return
  M.alive = false; M.death = kind; deathT = 0; hitStop = 0.15; flash = 1; shake = 1
  const snd = { slap: 'slap', uchiwa: 'slap', cat: 'slap', spray: 'thud', smoke: 'thud' }[kind]
  sfx(snd, { vol: 1 }); if (kind !== 'smoke' && kind !== 'spray') sfx('squish', { vol: 0.7, delay: 0.03 })
  if (kind === 'cat') sfx('meow', { vol: 0.7, delay: 0.3 })
  // シミ: 一番近い面（無ければ畳）に貼る
  drawStain(M.full > 0.05)
  const s = nearestSurface(M.pos) || { n: new THREE.Vector3(0, 1, 0), p: new THREE.Vector3(M.pos.x, 0.003, M.pos.z) }
  if (kind === 'smoke' || kind === 'spray') { s.n.set(0, 1, 0); s.p.set(M.pos.x, 0.004, M.pos.z); pushFloor(s.p) }
  stain.position.copy(s.p).addScaledVector(s.n, 0.002); stain.lookAt(stain.position.clone().add(s.n)); stain.visible = kind !== 'smoke' && kind !== 'spray'
  stain.scale.setScalar(1 + M.full * 0.8)
  W.deathAt = s.p.clone(); W.deathN = s.n.clone()
  bubble('me', T().death[kind], 'big')
}
function pushFloor(p) { for (const f of futons) { const lp = f.worldToLocal(_v2.copy(p)); if (Math.abs(lp.x) < 0.5 && lp.z > -0.2 && lp.z < 1.8) { lp.y = 0.085; p.copy(f.localToWorld(lp)) } } }

// ---- 家族の1歩
function stepPerson(p, dt) {
  p.t += dt; p.cool = Math.max(0, p.cool - dt)
  const breath = 0.5 + 0.5 * Math.sin(p.t * (p.id === 'kid' ? 1.9 : 1.3))
  if (p.state === 'sleep') {
    // しぐさ（起きかけの合図）
    if (p.alert > 0.45 && !p.turned && p.turnCool <= 0) { p.turned = true; p.rollTo = (p.roll > 0 ? -1 : 1) * 0.75; sfx('cloth', { vol: 0.45 }); if (Math.random() < 0.6) bubble(p, pick(p.def.react[lang], p.t * 7)); p.turnCool = 6 }
    if (p.alert < 0.25 && p.turned && p.turnCool <= 0) { p.turned = false; p.rollTo = 0; p.turnCool = 4 }
    p.turnCool = (p.turnCool || 0) - dt
    if (p.alert > 0.72 && !p.grumbled) { p.grumbled = true; bubble(p, pick(p.def.react[lang], p.t * 13 + 1)); sfx('grunt', { vol: 0.35 }) }
    if (p.alert < 0.5) p.grumbled = false
    if (p.alert >= 1) startAct(p)
    // 寝言（遊び心。羽音とは関係なく時々）
    p.talkT -= dt
    if (p.talkT <= 0) { p.talkT = 9 + W.R() * 14; if (M.pos.distanceTo(p.headPos) < 2.4 && W.t - W.lastTalk > 7) { if (bubble(p, pick(p.def.talk[lang], W.R() * 100))) W.lastTalk = W.t } }
    // たろうの寝相（転がって父の方へ）
    if (p.id === 'kid') {
      W.kidRollT -= dt
      if (W.kidRollT <= 0 && W.kidRolls < 3) { W.kidRollT = 22 + W.R() * 10; W.kidRolls++; p.rolling = 1; p.rollFrom = p.root.position.x; sfx('cloth', { vol: 0.5 }); sfx('thud', { vol: 0.25, delay: 0.6 }) }
      if (p.rolling > 0) {
        p.rolling = Math.max(0, p.rolling - dt / 1.1); const k = 1 - p.rolling
        p.root.position.x = p.rollFrom - 0.26 * smooth(0, 1, k); p.rollG.rotation.z = k * Math.PI * 2 * (p.rolling > 0 ? 1 : 0)
        p.root.rotation.y = 0.15 + W.kidRolls * 0.22 * smooth(0, 1, k) + (W.kidRolls - 1) * 0.22 * (1 - smooth(0, 1, k)) * 0
        if (p.rolling === 0) { p.rollG.rotation.z = 0; p.root.rotation.y = 0.15 + W.kidRolls * 0.22; if (W.kidRolls === 3) bubble(people[0], lang === 'ja' ? 'う…足が…顔に…' : 'Ugh... a foot... on my face...') }
      }
    }
    p.roll = lerp(p.roll, p.rollTo, Math.min(1, dt * 3))
    if (!p.rolling) p.rollG.rotation.z = p.roll
    p.sit = lerp(p.sit, 0, Math.min(1, dt * 2.5)); p.armAim = null
  } else stepAct(p, dt)
  p.applyPose(breath)
}

// 起きて叩く
function startAct(p, seen) {
  p.state = 'act'; p.act = p.def.wake; p.at = 0; p.hitDone = 0; W.wakes++
  sfx('cloth', { vol: 0.7 }); sfx('grunt', { vol: 0.55 })
  if (p.act === 'uchiwa' && W.light <= 0) { W.light = 14; W.lightCount++; room.setLight(true); sfx('switch', { vol: 0.8, delay: 0.25 }); setTimeout(() => bubble('me', T().say.lightOn), 400) }
  bubble(p, pick(p.def.react[lang], W.t * 3 + 2))
}
function shoulder(p) { return p.b.torso.localToWorld(new THREE.Vector3(0, 0.12, 0.02)) }
function stepAct(p, dt) {
  p.at += dt
  const t = p.at, kind = p.act
  const up = { slap: 0.32, flail: 0.22, uchiwa: 0.4, spray: 0.45 }[kind]
  p.sit = lerp(p.sit, t < 1.6 + (kind === 'uchiwa' ? 1.2 : 0) ? 0.85 : 0, Math.min(1, dt * 7))
  const sh = shoulder(p)
  if (kind === 'slap' || kind === 'flail') {
    const reach = kind === 'slap' ? 0.85 : 0.6, lockT = kind === 'slap' ? 0.4 : 0.26, clapT = kind === 'slap' ? 0.62 : 0.42
    if (t >= lockT && !p.aim) { p.aim = M.pos.clone().addScaledVector(M.vel, 0.18); if (kind === 'flail') p.aim.add(new THREE.Vector3(W.R() - 0.5, W.R() - 0.5, W.R() - 0.5).multiplyScalar(0.3)); const d = p.aim.clone().sub(sh); if (d.length() > reach) p.aim = sh.clone().addScaledVector(d.normalize(), reach); sfx('swish', { vol: 0.6 }) }
    const tgt = p.aim || M.pos
    const open = t < clapT ? 1 - smooth(lockT, clapT, t) : 0
    hands.forEach((h, i) => {
      h.g.visible = t > up * 0.6 && t < 1.7
      const side = i ? 1 : -1, sideV = new THREE.Vector3(Math.cos(p.root.rotation.y), 0, -Math.sin(p.root.rotation.y))
      const palm = tgt.clone().addScaledVector(sideV, side * (0.02 + open * 0.28)).add(new THREE.Vector3(0, open * 0.1, 0))
      if (t < lockT) palm.lerpVectors(sh.clone().add(new THREE.Vector3(0, 0.25, 0)).addScaledVector(sideV, side * 0.3), palm, 0.3)
      const s0 = sh.clone().addScaledVector(sideV, side * 0.12)
      placeArm(h, s0, palm, sideV.clone().multiplyScalar(-side))
    })
    if (t >= clapT && !p.hitDone) {
      p.hitDone = 1; sfx('slap', { vol: 0.9 }); shake = Math.max(shake, 0.35)
      if (M.pos.distanceTo(tgt) < (kind === 'slap' ? 0.17 : 0.15)) kill('slap')
      else if (M.pos.distanceTo(tgt) < 0.4) { M.vel.addScaledVector(M.pos.clone().sub(tgt).normalize(), 0.8); if (M.state !== 'fly') takeOff(true) }
    }
    if (t > 2.6) endAct(p)
  } else if (kind === 'uchiwa') {
    const swings = [0.75, 1.35, 1.95]
    uchiwa.visible = t > 0.3 && t < 2.5
    let si = swings.findIndex(s => Math.abs(t - s) < 0.3)
    const dir = M.pos.clone().sub(sh); const dist = dir.length(); dir.normalize()
    const c = sh.clone().addScaledVector(dir, Math.min(0.95, dist))
    const sideV = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
    const ph = si >= 0 ? (t - swings[si]) / 0.3 : -1
    const pos = c.clone().addScaledVector(sideV, si >= 0 ? -ph * 0.4 : 0.35).add(new THREE.Vector3(0, si >= 0 ? 0 : 0.15, 0))
    uchiwa.position.copy(pos); uchiwa.lookAt(pos.clone().add(sideV)); uchiwa.rotateX(-Math.PI / 2)
    hands[0].g.visible = uchiwa.visible; if (uchiwa.visible) placeArm(hands[0], sh, pos, sideV)
    for (let k = 0; k < swings.length; k++) {
      if (t >= swings[k] && p.hitDone <= k) {
        p.hitDone = k + 1; sfx('swish', { vol: 0.9, rate: 0.7 })
        if (M.pos.distanceTo(c) < 0.25 && dist < 1.15) kill('uchiwa')
        else if (dist < 1.6) { M.vel.addScaledVector(sideV, -1.2); if (M.state !== 'fly') takeOff(true) }
      }
    }
    if (t > 3.4) endAct(p)
  } else if (kind === 'spray') {
    can.visible = t > 0.3 && t < 2.4
    const dir = M.pos.clone().sub(sh).normalize()
    const cp = sh.clone().addScaledVector(dir, 0.3); can.position.copy(cp); can.lookAt(cp.clone().sub(dir))
    hands[0].g.visible = can.visible; if (can.visible) placeArm(hands[0], sh, cp, new THREE.Vector3(0, 1, 0))
    if (t > 0.6 && t < 1.9) {
      if (!p.sprayed) { p.sprayed = true; sfx('spray', { vol: 0.9 }) }
      if (Math.random() < 0.6) { const m = mist.find(m => m.userData.life <= 0); if (m) { m.visible = true; m.userData.life = 4; m.position.copy(cp); m.userData.v.copy(dir).multiplyScalar(0.9 + Math.random() * 0.5).add(new THREE.Vector3((Math.random() - .5) * .25, (Math.random() - .5) * .2, (Math.random() - .5) * .25)); m.scale.setScalar(0.12) } }
    }
    if (t > 2.8) endAct(p)
  }
}
function placeArm(h, from, to, upHint) {
  const d = to.clone().sub(from), L = d.length()
  h.g.position.copy(from); h.arm.scale.set(1, Math.max(0.01, L), 1)
  h.arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())
  h.palm.position.copy(d)
  h.palm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().normalize())
  if (upHint) { const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), upHint, d.clone().normalize()); h.palm.quaternion.setFromRotationMatrix(m) }
}
function endAct(p) {
  p.state = 'sleep'; p.alert = 0.5; p.sens = Math.min(2.4, p.sens * 1.2); p.cool = 3.5; p.aim = null; p.sprayed = false; p.turned = false
  hands.forEach(h => h.g.visible = false); uchiwa.visible = false; can.visible = false
  M.seenT = 0
}
// 猫（レア）: 目で追い、近いと猫パンチ
function stepCat(dt) {
  const h = cat.headPos, d = M.pos.distanceTo(h)
  cat.cool = Math.max(0, cat.cool - dt)
  if (d < 1.4) { const loc = cat.root.worldToLocal(M.pos.clone()); const yaw = Math.atan2(-loc.x, -loc.z), pit = Math.atan2(loc.y - 0.3, Math.hypot(loc.x, loc.z)); cat.neck.rotation.y = lerp(cat.neck.rotation.y, clamp(yaw, -1.2, 1.2), 0.2); cat.neck.rotation.x = lerp(cat.neck.rotation.x, clamp(pit, -0.6, 0.9), 0.2) }
  if (d < 0.36 && cat.cool <= 0 && !cat.swipe) { cat.swipe = 0.001; cat.aim = M.pos.clone() }
  if (cat.swipe) {
    cat.swipe += dt; cat.paw.position.y = 0.075 + Math.sin(Math.min(1, cat.swipe / 0.45) * Math.PI) * 0.22
    if (cat.swipe > 0.35 && !cat.hit) { cat.hit = true; sfx('swish', { vol: 0.5, rate: 1.4 }); if (M.pos.distanceTo(cat.aim) < 0.16 && M.pos.distanceTo(h) < 0.45) kill('cat') }
    if (cat.swipe > 0.6) { cat.swipe = 0; cat.hit = false; cat.cool = 2.2 }
  }
  if (!W.catSaid && d < 0.9) { W.catSaid = true; sfx('meow', { vol: 0.35 }) }
}

// ---- チュートリアル（最初の1回。文字は1つずつ）
function stepTut(dt) {
  if (W.tut >= 99) { if (M.full > 0.8 && !W.seenFull) { W.seenFull = true; W.restHint = 4 } if (W.restHint > 0) { W.restHint -= dt; tip('rest') } else tip(null); return }
  if (W.tut < 3 && M.state === 'suck') { W.tut = 3; W.tutT = 0 }
  if (W.tut === 0) { tip(coarse ? 'moveTouch' : 'movePC'); if (W.movedDist > 0.6) W.tut = 1 }
  else if (W.tut === 1) { tip('find'); if (glowTarget) W.tut = 2 }
  else if (W.tut === 2) { tip(coarse ? 'biteTouch' : 'bitePC'); if (M.state === 'suck') { W.tut = 3; W.tutT = 0 } if (!glowTarget && M.state === 'fly') W.tut = 1 }
  else if (W.tut === 3) { W.tutT += dt; tip(W.tutT > 1.5 ? 'leave' : null); if (M.state === 'fly' && W.tutT > 1.5) { W.tut = 99; tip(null); tutDone = true; try { localStorage.setItem('nm_tut', '1') } catch (e) {} } }
}

// ---------------------------------------------------------------- 結果（かゆみ報告書）
function score() {
  const mg = M.total * 3, alive = M.alive
  const s = mg * (alive ? 1.3 : 1)
  const rank = W.bites.length === 0 ? 0 : s < 1 ? 1 : s < 2.6 ? 2 : s < 5 ? 3 : 4
  return { mg: mg.toFixed(2), mgN: mg, bites: W.bites.length, alive, rank, rankName: T().ranks[rank], score: Math.round(s * 100) }
}
function endNight() {
  if (W.ended) return
  W.ended = true; mode = 'result'
  hands.forEach(h => h.g.visible = false); uchiwa.visible = false; can.visible = false
  const r = W.result = score()
  drawReport(r)
  show('result'); $('hud').classList.add('hidden'); tip(null); say.t = 0; say.el.classList.add('hidden')
  const tx = T().postText({ mg: r.mg, bites: r.bites, rank: r.rankName }) + ' ' + T().tags
  $('btnPost').href = 'https://x.com/intent/post?text=' + encodeURIComponent(tx) + '&url=' + encodeURIComponent('https://tom3games.github.io/night-mosquito/')
  sfx(r.alive && r.rank >= 2 ? 'win' : 'lose', { vol: 0.7, jitter: 0 }); setTimeout(() => sfx('rank', { vol: 0.8, jitter: 0 }), 900)
  Snd.duck(0.35, 2.5)
}
// 体の図の点の位置（正面の人型。0..1）
const BODY = { forehead: [0.5, 0.1], cheek: [0.36, 0.21], top: [0.5, 0.03], armL: [0.86, 0.58], armR: [0.14, 0.58], footL: [0.63, 0.9], footR: [0.37, 0.9] }
const FIGC = { dad: '#26304a', mom: '#7a7f8c', kid: '#3f8a5a', gramps: '#c7642e' }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath() }
// 正面の人の絵（服の色・肌・閉じた目）。itch が多いほど顔がしかめっつら
function drawFigure(g, x, y, w, h, id, itch) {
  g.save(); g.translate(x, y); g.lineJoin = 'round'
  const skinC = '#f0c09a', ink = '#3a2e28', cloth = FIGC[id] || '#555'
  g.lineWidth = 3; g.strokeStyle = ink
  // 脚（すね・足は素足）
  for (const s of [-1, 1]) { g.fillStyle = cloth; rr(g, w / 2 + s * w * 0.13 - w * 0.09, h * 0.6, w * 0.18, h * 0.2, 6); g.fill(); g.stroke(); g.fillStyle = skinC; rr(g, w / 2 + s * w * 0.13 - w * 0.085, h * 0.79, w * 0.17, h * 0.19, 6); g.fill(); g.stroke() }
  // 腕
  for (const s of [-1, 1]) { g.save(); g.translate(w / 2 + s * w * 0.27, h * 0.36); g.rotate(s * -0.35); g.fillStyle = cloth; rr(g, -w * 0.07, 0, w * 0.14, h * 0.13, 6); g.fill(); g.stroke(); g.fillStyle = skinC; rr(g, -w * 0.065, h * 0.12, w * 0.13, h * 0.12, 6); g.fill(); g.stroke(); g.restore() }
  // 胴
  g.fillStyle = cloth; rr(g, w * 0.24, h * 0.33, w * 0.52, h * 0.31, 10); g.fill(); g.stroke()
  if (id === 'dad') { g.fillStyle = '#c4161c'; g.beginPath(); g.moveTo(w / 2 - 6, h * 0.34); g.lineTo(w / 2 + 6, h * 0.34); g.lineTo(w / 2 + 4, h * 0.52); g.lineTo(w / 2, h * 0.56); g.lineTo(w / 2 - 4, h * 0.52); g.closePath(); g.fill() }
  // 頭
  const hr = w * 0.24, hx = w / 2, hy = h * 0.17
  g.fillStyle = skinC; rr(g, hx - hr, hy - hr * 0.95, hr * 2, hr * 1.9, hr * 0.5); g.fill(); g.stroke()
  if (id !== 'gramps') { g.fillStyle = { dad: '#2a2018', mom: '#c96a3a', kid: '#1e1a18' }[id] || '#333'; g.beginPath(); g.moveTo(hx - hr, hy - hr * 0.2); g.quadraticCurveTo(hx - hr, hy - hr * 1.1, hx, hy - hr * 1.05); g.quadraticCurveTo(hx + hr, hy - hr * 1.1, hx + hr, hy - hr * 0.2); g.lineTo(hx + hr * 0.6, hy - hr * 0.55); g.lineTo(hx - hr * 0.6, hy - hr * 0.55); g.closePath(); g.fill(); g.stroke() }
  else { g.fillStyle = '#e9e4da'; g.beginPath(); g.ellipse(hx, hy + hr * 0.7, hr * 0.7, hr * 0.35, 0, 0, Math.PI); g.fill() }
  // 目と口（刺されるほどしかめる）
  g.lineWidth = 2.6
  for (const s of [-1, 1]) { g.beginPath(); if (itch >= 2) { g.moveTo(hx + s * hr * 0.55, hy - hr * 0.05); g.lineTo(hx + s * hr * 0.2, hy + hr * 0.08) } else { g.arc(hx + s * hr * 0.38, hy, hr * 0.15, 0.15, Math.PI - 0.15) } g.stroke() }
  g.beginPath(); if (itch >= 1) { g.moveTo(hx - hr * 0.2, hy + hr * 0.5); g.quadraticCurveTo(hx, hy + hr * 0.36, hx + hr * 0.2, hy + hr * 0.5) } else { g.arc(hx, hy + hr * 0.35, hr * 0.18, 0.3, Math.PI - 0.3) } g.stroke()
  g.restore()
}
function drawCat(g, x, y, w) {
  g.save(); g.translate(x, y); g.fillStyle = '#2e2926'; g.strokeStyle = '#3a2e28'; g.lineWidth = 3
  g.beginPath(); g.ellipse(w / 2, w * 0.95, w * 0.42, w * 0.3, 0, 0, 7); g.fill()
  g.beginPath(); g.arc(w / 2, w * 0.55, w * 0.25, 0, 7); g.fill()
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2 + s * w * 0.22, w * 0.45); g.lineTo(w / 2 + s * w * 0.2, w * 0.25); g.lineTo(w / 2 + s * w * 0.06, w * 0.36); g.fill() }
  g.fillStyle = '#e6cf3a'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + s * w * 0.1, w * 0.55, w * 0.05, w * 0.04, 0, 0, 7); g.fill() }
  g.fillStyle = '#111'; for (const s of [-1, 1]) g.fillRect(w / 2 + s * w * 0.1 - 1.5, w * 0.515, 3, w * 0.075)
  g.strokeStyle = '#2e2926'; g.lineWidth = 7; g.beginPath(); g.moveTo(w * 0.85, w * 1.05); g.quadraticCurveTo(w * 1.05, w * 0.8, w * 0.92, w * 0.62); g.stroke()
  g.restore()
}
// 刺されたあと（ぷっくり）
function bump(g, x, y, k) { g.fillStyle = 'rgba(240,120,130,.45)'; g.beginPath(); g.arc(x, y, 17 * k, 0, 7); g.fill(); g.fillStyle = '#e04a55'; g.beginPath(); g.arc(x, y, 8 * k, 0, 7); g.fill(); g.fillStyle = '#b3121a'; g.beginPath(); g.arc(x, y, 3 * k, 0, 7); g.fill() }
function drawReport(r) {
  const c = $('report'), g = c.getContext('2d'), Wd = 1080, Ht = 1350
  c.width = Wd; c.height = Ht
  // わら半紙
  g.fillStyle = '#efe6cf'; g.fillRect(0, 0, Wd, Ht)
  for (let i = 0; i < 2600; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(120,100,60,.07)' : 'rgba(255,255,255,.15)'; g.fillRect(Math.random() * Wd, Math.random() * Ht, 2, 2) }
  g.strokeStyle = 'rgba(80,110,150,.28)'; g.lineWidth = 2; g.beginPath(); g.moveTo(60, 222); g.lineTo(Wd - 60, 222); g.stroke(); g.beginPath(); g.moveTo(60, 850); g.lineTo(Wd - 60, 850); g.stroke()
  const F = (s, wgt = 700) => `${wgt} ${s}px "Klee One","Zen Kaku Gothic New",sans-serif`
  const L = T().report
  g.fillStyle = '#222'; g.font = F(84, 600); g.textBaseline = 'alphabetic'; g.fillText(L.head, 70, 140)
  g.font = F(34, 600); g.fillStyle = '#444'; g.fillText(L.date, 74, 196)
  // 家族
  const fam = people.slice().sort((a, b) => ['dad', 'mom', 'kid', 'gramps'].indexOf(a.id) - ['dad', 'mom', 'kid', 'gramps'].indexOf(b.id))
  const n = fam.length + (W.cat ? 1 : 0), colW = (Wd - 120) / Math.min(n, 4)
  fam.forEach((p, i) => {
    const x = 60 + i * colW, y = 250, fw = Math.min(200, colW - 30), fh = fw * 1.55
    const counts = {}; for (const b of W.bites) if (b.who === p.id) counts[b.key] = (counts[b.key] || 0) + 1
    const kh = p.id === 'kid' ? 0.82 : 1, fx = x + (colW - fw) / 2, fy = y + fh * (1 - kh)
    drawFigure(g, fx, fy, fw, fh * kh, p.id, p.bites.length)
    for (const k in counts) { const pt = BODY[k]; if (!pt) continue; for (let j = 0; j < counts[k]; j++) bump(g, fx + pt[0] * fw + j * 10, fy + pt[1] * fh * kh + j * 7, 1) }
    const nb = p.bites.length
    g.fillStyle = '#222'; g.font = F(40); g.fillText(p.def.name[lang], x + 10, y + fh + 60)
    g.font = F(34, 600); g.fillStyle = nb ? '#b3121a' : '#555'; g.fillText(nb + (lang === 'ja' ? 'か所' : ' bites'), x + 10, y + fh + 104)
    const m = MORN[p.id][lang], line = nb === 0 ? m[0] : nb === 1 ? m[1] : nb === 2 ? m[2] : m[3]
    wrapText(g, '「' + line + '」', x + 10, y + fh + 150, colW - 24, 40, F(30, 600), '#333')
  })
  if (W.cat) { const cw = fam.length < 4 ? Math.min(150, colW - 40) : 118, cx = fam.length < 4 ? 60 + fam.length * colW : Wd - 60 - cw, cy = fam.length < 4 ? 250 + 120 : 40; drawCat(g, cx + (fam.length < 4 ? (colW - cw) / 2 : 0), cy, cw); if (fam.length < 4) { g.font = F(40); g.fillStyle = '#222'; g.fillText(lang === 'ja' ? 'ねこ' : 'Cat', cx + 10, 250 + fw0(colW) * 1.55 + 60); wrapText(g, '「' + MORN.cat[lang][0] + '」', cx + 10, 250 + fw0(colW) * 1.55 + 150, colW - 24, 40, F(30, 600), '#333') } }
  // 下: 吸った血・刺した数・判定ハンコ
  const by = 940
  g.fillStyle = '#222'; g.font = F(40, 600); g.fillText(L.blood, 80, by); g.fillText(L.bites, 80, by + 76)
  g.font = F(64); g.fillStyle = '#b3121a'; g.fillText(r.mg + ' ' + L.mg, 330, by + 4); g.fillText(r.bites + ' ' + L.ka, 330, by + 82)
  g.font = F(36, 600); g.fillStyle = '#333'
  g.fillText(r.alive ? L.alive : T().deathNote[M.death], 80, by + 160)
  if (!r.alive) {   // 壁のシミの絵
    const sc = stain.userData.c; g.save(); g.globalAlpha = 0.95; g.drawImage(sc, 620, by + 100, 120, 120); g.restore()
    g.font = F(26, 600); g.fillStyle = '#555'; g.fillText(L.wall, 616, by + 246)
  }
  // ハンコ
  g.save(); g.translate(Wd - 230, by + 40); g.rotate(-0.18); g.strokeStyle = '#c4161c'; g.fillStyle = '#c4161c'; g.lineWidth = 9
  g.beginPath(); g.arc(0, 0, 130, 0, 7); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 112, 0, 7); g.stroke()
  g.textAlign = 'center'; const rn = r.rankName
  const size = lang === 'ja' ? (rn.length > 6 ? 34 : 44) : (rn.length > 14 ? 22 : 28)
  if (lang === 'ja' && rn.length > 5) { const h = Math.ceil(rn.length / 2); g.font = F(size); g.fillText(rn.slice(0, h), 0, -6); g.fillText(rn.slice(h), 0, size + 2) }
  else { g.font = F(size); wrapCenter(g, rn, 0, 0, 200, size + 4) }
  g.restore()
  g.font = '500 24px "Zen Kaku Gothic New",sans-serif'; g.fillStyle = '#777'; g.textAlign = 'left'; g.fillText('tom3games.github.io/night-mosquito', 80, Ht - 50)
}
const fw0 = colW => Math.min(200, colW - 30)
function wrapText(g, s, x, y, w, lh, font, col) {
  g.font = font; g.fillStyle = col; let line = '', yy = y
  const parts = lang === 'ja' ? [...s] : s.split(/(\s+)/)
  for (const ch of parts) { if (g.measureText(line + ch).width > w && line) { g.fillText(line, x, yy); line = ch.trimStart(); yy += lh } else line += ch }
  if (line) g.fillText(line, x, yy)
}
function wrapCenter(g, s, x, y, w, lh) { const words = s.split(' '); const lines = []; let l = ''; for (const wd of words) { if (g.measureText(l + ' ' + wd).width > w && l) { lines.push(l); l = wd } else l = l ? l + ' ' + wd : wd } lines.push(l); lines.forEach((t, i) => g.fillText(t, x, y + (i - (lines.length - 1) / 2) * lh + lh * 0.3)) }

// ---------------------------------------------------------------- 描画
const clockH = $('clockH'), clockM = $('clockM')
function frame(now) {
  requestAnimationFrame(frame)
  if (!lastT) lastT = now
  let dt = Math.min(0.1, (now - lastT) / 1000); lastT = now
  if (mode === 'play' && !paused && !frozen) {
    if (hitStop > 0) { hitStop -= dt } else { simAcc += dt; let n = 0; while (simAcc >= STEP && n < 8) { stepOnce(); simAcc -= STEP; n++ } if (n >= 8) simAcc = 0 }
  }
  if (mode === 'title' && W) titleDrift(dt)
  render(dt)
}
function titleDrift(dt) {
  W.t += dt * 0.3
  const a = performance.now() / 1000
  M.pos.set(0.55 + Math.sin(a * 0.5) * 0.25, 0.95 + Math.sin(a * 0.9) * 0.1, 0.55 + Math.cos(a * 0.4) * 0.2)
  camYaw = -0.8 + Math.sin(a * 0.15) * 0.4; camPitch = -0.35
  room.fan.root.rotation.y = -2.45; room.fan.neck.rotation.y = Math.sin(a * 0.7) * 0.75
  for (const p of people) { p.t += dt; p.applyPose(0.5 + 0.5 * Math.sin(p.t * 1.3)) ; p.updateWorld() }
}
const proj = new THREE.Vector3()
function render(dt) {
  const w = innerWidth, h = innerHeight
  if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix() }
  const tnow = performance.now() / 1000
  // 蚊の見た目
  M.flap += dt * 60
  const flying = M.state === 'fly' || M.state === 'land'
  mos.wings.forEach((wg, i) => { wg.rotation.z = (i ? -1 : 1) * (flying ? (M.flap % 2 < 1 ? 0.7 : -0.3) : 0.12); wg.rotation.y = flying ? 0 : (i ? -1 : 1) * 1.15 })
  mos.wingMat.opacity = flying ? 0.22 : 0.4
  mos.setFull(M.full)
  if (M.alive) {
    mos.root.position.copy(M.pos)
    if (M.state === 'fly') {
      const hd = Math.hypot(M.vel.x, M.vel.z) > 0.05 ? Math.atan2(-M.vel.x, -M.vel.z) : camYaw
      mos.root.rotation.set(-M.vel.y * 0.6, hd, 0, 'YXZ'); mos.root.position.y += Math.sin(tnow * 9) * 0.002
    } else {
      const n = M.state === 'rest' ? M.perch.n : M.perch.wn
      const f = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw)); f.addScaledVector(n, -f.dot(n)); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize()
      const m = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(n, f.clone().negate()).normalize(), n, f.clone().negate()); mos.root.quaternion.setFromRotationMatrix(m)
      if (M.state === 'suck') mos.root.rotateX(0.25)
    }
  } else if (W && W.deathAt) {
    // やられた: シミの上にぺしゃんこ、煙なら落ちて裏返る
    const k = Math.min(1, deathT / 0.6)
    if (M.death === 'smoke' || M.death === 'spray') { mos.root.position.lerpVectors(M.pos, W.deathAt.clone().add(new THREE.Vector3(0, 0.004, 0)), k * k); mos.root.rotation.set(0, mos.root.rotation.y, Math.PI * k) }
    else { mos.root.position.copy(W.deathAt).addScaledVector(W.deathN, 0.003); mos.root.scale.set(1.3, 0.25, 1.3); mos.root.lookAt(mos.root.position.clone().add(W.deathN)); mos.root.rotateX(Math.PI / 2) }
  }
  // カメラ（蚊の斜め後ろ・少し上）
  const fwd = new THREE.Vector3(-Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), -Math.cos(camYaw) * Math.cos(camPitch))
  let camTarget
  if (camOverride) { camera.position.copy(camOverride[0]); camera.lookAt(camOverride[1]) }
  else if (mode === 'title') {
    const a = tnow * 0.05
    camera.position.set(1.45 + Math.sin(a) * 0.15, 1.55, 1.35); camera.lookAt(-0.35, 0.15 + Math.sin(a * 2) * 0.05, -0.9)
  } else if (M.alive || !W || !W.deathAt) {
    camDist = lerp(camDist, M.state === 'fly' ? 0.1 + M.full * 0.025 : 0.17, Math.min(1, dt * 4)); const dist = camDist
    const side = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw))
    camTarget = M.pos.clone().addScaledVector(fwd, -dist).addScaledVector(side, 0.028).add(new THREE.Vector3(0, 0.045, 0))
    pushOut(camTarget, 0.006)
    camera.position.lerp(camTarget, mode === 'title' ? 0.05 : Math.min(1, dt * 14))
    if (camera.position.distanceTo(M.pos) > 1.2) camera.position.copy(camTarget)
    camera.lookAt(M.pos.clone().addScaledVector(fwd, 0.07).add(new THREE.Vector3(0, 0.012, 0)))
  } else {
    const n = W.deathN, p = W.deathAt.clone().addScaledVector(n, 0.13).add(new THREE.Vector3(0.03, 0.03, 0))
    camera.position.lerp(p, Math.min(1, dt * 5)); camera.lookAt(W.deathAt)
  }
  if (shake > 0) { camera.position.add(new THREE.Vector3((Math.random() - .5) * shake * 0.01, (Math.random() - .5) * shake * 0.01, 0)); shake = Math.max(0, shake - dt * 3) }
  camera.fov = window.__og ? 46 : lerp(camera.fov, 64 + M.wind * 8 + M.dizzy * 6, 0.1); camera.updateProjectionMatrix()
  if (M.dizzy > 0.1) camera.rotation.z += Math.sin(tnow * 3) * M.dizzy * 0.12
  // 扇風機の羽
  room.fan.blades.rotation.z -= dt * 40
  room.coil.ember.material.emissiveIntensity = 2.5 + Math.sin(tnow * 3) * 0.6
  // 煙の粒（判定と同じ柱の中）
  const c = room.coil.pos
  for (const s of smoke) {
    const u = s.userData; u.t += dt * 0.35; if (u.t > 1) u.t -= 1
    const y = u.t * 1.25, drift = Math.sin((W ? W.t : tnow) * 0.4) * 0.08
    s.position.set(c.x + drift * y + Math.sin(u.ph + y * 4) * 0.05 * y, c.y + y, c.z + drift * 0.5 * y + Math.cos(u.ph + y * 3) * 0.05 * y)
    s.scale.setScalar(0.04 + y * 0.22); s.material.opacity = (1 - u.t) * Math.min(1, u.t * 6) * 0.34
  }
  for (const m of mist) { if (m.userData.life <= 0) { m.visible = false; continue } if (mode === 'play' && !paused) { m.userData.life -= dt; m.position.addScaledVector(m.userData.v, dt); m.userData.v.multiplyScalar(0.96); m.scale.setScalar(Math.min(0.7, m.scale.x + dt * 0.35)) } m.material.opacity = Math.min(1, m.userData.life / 2) * 0.35 }
  // 光る肌
  let gi = 0
  if (mode === 'play' && M.alive && M.state === 'fly') {
    for (const p of people) { if (p.state !== 'sleep') continue; for (const s of p.spots) { if (!s.ok || gi >= glows.length) continue; const d = M.pos.distanceTo(s.w); if (d > 0.7) continue; const g = glows[gi++]; g.visible = true; g.position.copy(s.w).addScaledVector(s.wn, 0.01); const on = s === glowTarget; g.scale.setScalar(on ? 0.055 : 0.035); g.material.opacity = (on ? 0.95 : 0.45 * (1 - d / 0.7)) * (0.75 + 0.25 * Math.sin(tnow * 5)) * (s.stock > 0 ? 1 : 0.3) } }
  }
  for (; gi < glows.length; gi++) glows[gi].visible = false
  // 起きかけの顔・z
  for (const p of people) {
    p.decal.material.opacity = smooth(0.35, 0.85, p.alert) * (p.state === 'sleep' ? 1 : 1)
    const hp = p.headPos
    p.zT += dt
    const camNear = clamp((camera.position.distanceTo(hp) - 0.3) / 0.4, 0, 1)
    p.zs.forEach((z, i) => { const ph = (p.zT * 0.35 + i / 3) % 1; z.position.set(hp.x + 0.08 + ph * 0.1, hp.y + 0.15 + ph * 0.3, hp.z + Math.sin(ph * 6) * 0.03); z.material.opacity = (p.alert < 0.3 && p.state === 'sleep' ? 1 : 0) * Math.sin(ph * Math.PI) * 0.8 * camNear; z.scale.setScalar(0.035 + ph * 0.04) })
  }
  // HUD
  if (mode === 'play' && W) {
    const hours = W.t / NIGHT * 6, hh = (23 + Math.floor(hours)) % 24, mm = Math.floor((hours % 1) * 60)
    clockH.setAttribute('transform', `rotate(${((hh % 12) + mm / 60) * 30} 20 22)`); clockM.setAttribute('transform', `rotate(${mm * 6} 20 22)`)
    $('clockT').textContent = `${hh}:${String(mm).padStart(2, '0')}`
    const bb = $('btnBite')
    const st = !M.alive ? 'off' : M.state === 'suck' || M.state === 'land' || M.state === 'rest' ? 'leave' : glowTarget ? 'bite' : nearSurface ? 'rest' : 'off'
    if (bb.dataset.s !== st) { bb.dataset.s = st; $('biteLbl').textContent = T().lbl[st] }
  }
  if (say.t > 0) {
    say.t -= dt
    let pos = null
    if (say.who === 'me') pos = M.pos.clone().add(new THREE.Vector3(0, 0.03, 0))
    else if (say.who && say.who.headPos) pos = say.who.headPos.clone().add(new THREE.Vector3(0, 0.3, 0))
    if (pos) { proj.copy(pos).project(camera); const vis = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1; const x = clamp((proj.x * 0.5 + 0.5) * w, 90, w - 90), y = clamp((-proj.y * 0.5 + 0.5) * h, 70, h - 160); say.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`; say.el.classList.toggle('hidden', say.t <= 0); say.el.classList.toggle('off', !vis) }
    if (say.t <= 0) say.el.classList.add('hidden')
  }
  $('fxFlash').style.opacity = flash; flash = Math.max(0, flash - dt * 3)
  $('fxDizzy').style.opacity = clamp(M.dizzy, 0, 1) * 0.8
  // 音
  if (Snd.ctx && ambOn) {
    const play = mode === 'play' && !paused
    let near = 0; for (const p of people) near = Math.max(near, p.near || 0)
    loopVol('buzz', play && M.alive && (M.state === 'fly' || M.state === 'land') ? 0.08 + near * 0.55 : 0.0001, 1 + M.full * -0.18 + M.wind * 0.1)
    const fanD = M.pos.distanceTo(room.fan.root.position)
    loopVol('fan', 0.06 + clamp(1 - fanD / 3, 0, 1) * 0.3 + M.wind * 0.3)
    const dad = people.find(p => p.id === 'dad'); loopVol('snore', dad && dad.alert < 0.4 && dad.state === 'sleep' ? 0.04 + clamp(1 - M.pos.distanceTo(dad.headPos) / 2, 0, 1) * 0.3 : 0.0001)
    loopVol('amb', 0.22 * (1 - smooth(NIGHT - 25, NIGHT, W ? W.t : 0)))
  }
  renderer.render(scene, camera)
}

// ---------------------------------------------------------------- 起動
applyLang()
const bootStart = performance.now()
const fontsReady = document.fonts ? Promise.race([Promise.all(['600 40px "Klee One"', '400 40px "Yuji Syuku"'].map(f => document.fonts.load(f, 'かゆみ報告書夏の夜蚊刺吸血朝生きのびた父母たろうじいちゃんAa0'))), new Promise(r => setTimeout(r, 4000))]).catch(() => {}) : Promise.resolve()
Promise.all([loadFamily(manager), fontsReady]).then(() => {
  newNight(1)
  mode = 'title'; M.pos.set(0.35, 0.95, -0.2)
  const b = $('boot'); bootProgress(1); $('bootMsg').textContent = T().loadingDone
  setTimeout(() => { b.classList.add('gone'); setTimeout(() => b.remove(), 600) }, 350)
  show('title')
  window.__nmReady = true
}).catch(e => { $('bootMsg').textContent = 'load error: ' + e.message; throw e })
setTimeout(() => { const b = $('boot'); if (b && !window.__nmReady) { b.classList.add('gone') } }, 12000)
requestAnimationFrame(frame)

// ---------------------------------------------------------------- 検証用の窓口
window.nm = {
  start, toTitle, get W() { return W }, M, people: () => people, get cat() { return cat }, room,
  get mode() { return mode },
  dbg: {
    pause(on = true) { frozen = on },
    step(n = 1) { for (let i = 0; i < n; i++) { if (mode !== 'play') break; stepOnce() } },
    input(fn) { testInput = fn },
    setCam(y, p) { camYaw = y; camPitch = p },
    render() { render(0.016) },
    cam(p, l, up) { camOverride = p ? [new THREE.Vector3(...p), new THREE.Vector3(...l)] : null; camera.up.set(...(up || [0, 1, 0])) },
  },
  score, nearestSpot, glow: () => glowTarget, hands, uchiwa, can,
  state: () => ({ mode, t: W && W.t, full: M.full, total: M.total, alive: M.alive, death: M.death, bites: W && W.bites.length, mstate: M.state, dizzy: M.dizzy, light: W && W.light, alerts: people.map(p => [p.id, +p.alert.toFixed(2), p.state]) }),
}
