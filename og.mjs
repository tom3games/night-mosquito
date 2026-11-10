// OGP 画像（1200x630）。ゲームの絵＋題字。node og.mjs（音は出さない）
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = 5646
const sv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH)
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 1200, height: 630 } }); await muteContext(ctx)
const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message))
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__nmReady, null, { timeout: 20000 })
await p.evaluate(async () => {
  document.body.innerHTML = `<div style="position:fixed;inset:0;background:#fdeed2 url(art/og.webp) 100% 62%/1560px auto no-repeat">
    <div style="position:absolute;left:48px;top:178px;font-family:'Potta One',sans-serif;font-size:98px;line-height:1;color:#fffbe9;-webkit-text-stroke:5px #1b1612;paint-order:stroke fill;text-shadow:6px 7px 0 #1b1612;transform:rotate(-3deg);transform-origin:left bottom;white-space:nowrap">夏の夜の蚊</div>
    <div style="position:absolute;left:58px;top:322px;font-family:'Klee One',sans-serif;font-weight:600;font-size:42px;line-height:1.35;color:#1b1612">家族の攻撃をよけて<br>何秒生きのびる？</div>
    <div style="position:absolute;left:58px;bottom:44px;font-family:'Klee One',sans-serif;font-weight:600;font-size:27px;color:#1b1612">スマホで無料の3Dバカゲー</div></div>`
  await document.fonts.load('124px "Potta One"', '夏の夜の蚊'); await document.fonts.load('600 42px "Klee One"', '家族の攻撃をよけて何秒生きのびるスマホで無料の3Dバカゲー')
})
await p.waitForTimeout(700)
await p.screenshot({ path: 'og.png' })
await b.close(); sv.kill()
