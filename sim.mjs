// 遊び方ごとの分布。node sim.mjs [回数=8]（音は出さない）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = 5645, N = +(process.argv[2] || 8)
const sv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 400, height: 300 } })
await muteContext(ctx)
const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message))
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__nmReady, null, { timeout: 20000 })
await p.addScriptTag({ content: readFileSync(new URL('./bots.js', import.meta.url), 'utf8') })
const out = {}
for (const kind of ['idle', 'reckless', 'skilled']) {
  out[kind] = []
  for (let i = 0; i < N; i++) {
    const r = await p.evaluate(({ kind, seed }) => {
      nm.start(seed); nm.dbg.pause(true); nm.dbg.input(window.__bot(kind))
      let n = 0; while (nm.mode === 'play' && n < 60 * 200) { nm.dbg.step(60); n += 60 }
      const s = nm.W.result || nm.score()
      return { mg: s.mg, bites: s.bites, alive: s.alive, rank: s.rank, death: nm.M.death, t: Math.round(nm.W.t), wakes: nm.W.wakes, g: nm.W.gramps, c: nm.W.cat }
    }, { kind, seed: 1000 + i * 77 })
    out[kind].push(r)
  }
  const a = out[kind], avg = k => (a.reduce((s, r) => s + +r[k], 0) / a.length).toFixed(2)
  console.log(`${kind.padEnd(9)} mg=${avg('mg')} bites=${avg('bites')} rank=${avg('rank')} alive=${a.filter(r => r.alive).length}/${a.length} t=${avg('t')} deaths=${a.map(r => r.death || '-').join(',')}`)
}
if (process.env.V) console.log(JSON.stringify(out, null, 1))
await b.close(); sv.kill()
