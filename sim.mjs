// 遊び方ごとの分布。node sim.mjs [回数=12]（音は出さない）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = 5645, N = +(process.argv[2] || 12), KINDS = (process.argv[3] || 'idle,wander,circle,ceil,corner,human,pro').split(',')
const sv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 400, height: 300 } })
await muteContext(ctx)
const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message))
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__nmReady, null, { timeout: 20000 })
await p.addScriptTag({ content: readFileSync(new URL('./bots.js', import.meta.url), 'utf8') })
const out = {}
for (const kind of KINDS) {
  out[kind] = []
  for (let i = 0; i < N; i++) {
    const r = await p.evaluate(({ kind, seed }) => {
      nm.start(seed, { tut: false }); nm.dbg.pause(true); nm.dbg.input(window.__bot(kind))
      let n = 0; while (nm.mode === 'play' && n < 60 * 260) { nm.dbg.step(60); n += 60 }
      clearTimeout(nm.W.stampTimer)
      return { t: +nm.W.t.toFixed(1), death: nm.M.death, by: nm.W.killer, near: nm.W.near, mode: nm.mode }
    }, { kind, seed: 1000 + i * 77 })
    out[kind].push(r)
  }
  const a = out[kind], ts = a.map(r => r.t).sort((x, y) => x - y), avg = ts.reduce((s, x) => s + x, 0) / ts.length
  const dc = {}; for (const r of a) dc[r.death] = (dc[r.death] || 0) + 1
  console.log(`${kind.padEnd(7)} avg=${avg.toFixed(1)} min=${ts[0]} med=${ts[ts.length >> 1]} max=${ts[ts.length - 1]} near=${(a.reduce((s, r) => s + r.near, 0) / a.length).toFixed(1)} deaths=${JSON.stringify(dc)}${a.some(r => r.mode === 'play') ? ' NOT-ENDED' : ''}`)
}
if (process.env.V) console.log(JSON.stringify(out, null, 1))
await b.close(); sv.kill()
