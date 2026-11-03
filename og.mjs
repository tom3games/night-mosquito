// OGP 画像（1200x630）。遊んでいる一番おもしろい場面＋題字。node og.mjs（音は出さない）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = 5646
const sv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 1200, height: 630 } }); await muteContext(ctx)
const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message))
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__nmReady, null, { timeout: 20000 }); await p.waitForTimeout(900)
await p.evaluate(() => {
  nm.start(31, { gramps: false, cat: false }); nm.dbg.pause(true)
  const dad = nm.people()[0]; dad.alert = 0.82; dad.rollTo = 0; dad.roll = 0; dad.updateWorld()
  const hp = dad.headPos.clone()
  const cam = hp.clone().add({ x: 0.2, y: 0.78, z: 0.46 })
  const dir = hp.clone().sub(cam).normalize()
  const right = dir.clone().cross({ x: 0, y: 1, z: 0 }).normalize()
  nm.M.full = 0.9; nm.M.state = 'fly'
  nm.M.pos.copy(cam).addScaledVector(dir, 0.15).addScaledVector(right, -0.035).add({ x: 0, y: -0.012, z: 0 })
  nm.M.vel.copy(dir).multiplyScalar(0.3); nm.M.vel.y = -0.05
  nm.dbg.setCam(Math.atan2(-dir.x, -dir.z), -0.6)
  nm.dbg.cam([cam.x, cam.y, cam.z], [hp.x - 0.3, hp.y, hp.z + 0.12], [0.1, 0.3, -1])
  window.__og = true
  document.getElementById('hud').classList.add('hidden'); document.getElementById('tip').classList.add('hidden')
  for (let i = 0; i < 40; i++) nm.dbg.render()
  const d = document.createElement('div')
  d.innerHTML = `<div style="position:fixed;left:48px;top:56px;text-align:left;z-index:99;color:#f4efe2;text-shadow:0 4px 22px rgba(0,0,0,.85)">
    <div style="font-family:'Yuji Syuku',serif;font-size:118px;line-height:1">夏の夜の蚊</div>
    <div style="font-family:'Klee One',sans-serif;font-weight:600;font-size:32px;margin-top:22px;line-height:1.55">蚊になって、<br>寝ている家族の血を吸う。<br>耳元で鳴くと、<br>手が飛んでくる。</div></div>
    <div style="position:fixed;left:44px;bottom:36px;z-index:99;font-family:'Klee One',sans-serif;font-weight:600;font-size:26px;color:#ffd9b8;text-shadow:0 2px 10px #000">ブラウザで無料・スマホで遊べる3Dバカゲー</div>`
  document.body.appendChild(d)
})
await p.waitForTimeout(600)
await p.screenshot({ path: 'og.png' })
await b.close(); sv.kill()
