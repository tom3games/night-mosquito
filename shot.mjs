// 開発用の撮影。node shot.mjs [名前] [js式...]（音は出さない）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = 5644
const sv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const [name = 'dev', ...steps] = process.argv.slice(2)
const W = +(process.env.W || 390), H = +(process.env.H || 844)
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: W, height: H }, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH })
await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__nmReady, null, { timeout: 20000 })
await p.waitForTimeout(800)
for (const f of ['bots.js', 'scn.js']) { try { await p.addScriptTag({ path: import.meta.dirname + '/' + f }) } catch (e) {} }
let i = 0
for (const s of steps) { if (s.startsWith('@')) { await p.screenshot({ path: `shots/${name}-${s.slice(1)}.png` }); continue } const r = await p.evaluate(s); if (r !== undefined) console.log(JSON.stringify(r)); await p.waitForTimeout(300) }
await p.screenshot({ path: `shots/${name}.png` })
console.log('errs', errs)
await b.close(); sv.kill()
