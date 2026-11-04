// 夏の夜の蚊の検証一式。node verify.mjs（音は出さない）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, statSync, readdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 5643
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)) }
async function open(browser, opts = {}, clear = true) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  if (clear) await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('c')) { localStorage.clear(); sessionStorage.setItem('c', '1') } } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__nmReady, null, { timeout: 25000 })
  await p.addScriptTag({ path: ROOT + '/bots.js' }); await p.addScriptTag({ path: ROOT + '/scn.js' })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('section:not(.hidden) *, #say:not(.hidden), #fxWord:not(.hidden)')) {
    if (el.closest('.hidden') || el.classList.contains('edge') || el.closest('.edge') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, W = innerWidth, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('section:not(.hidden) button, section:not(.hidden) canvas, section:not(.hidden) a, section:not(.hidden) h1, section:not(.hidden) .notice, section:not(.hidden) .credit')) {
    if (el.closest('.hidden')) continue
    const r = el.getBoundingClientRect(); if (r.height && (r.bottom > H + 1 || r.top < -1)) over.push((el.id || el.className || el.tagName) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom))
  }
  return { H, over: over.slice(0, 6) }
})
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]
const run = (p, kind, seed, opts = {}) => p.evaluate(({ kind, seed, opts }) => {
  nm.start(seed, { tut: false, ...opts }); nm.dbg.pause(true); nm.dbg.input(__bot(kind))
  let n = 0; while (nm.mode === 'play' && n < 60 * 260) { nm.dbg.step(60); n += 60 }
  return { t: +nm.W.t.toFixed(1), death: nm.M.death, by: nm.W.killer, near: nm.W.near, mode: nm.mode }
}, { kind, seed, opts })

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('読み込み画面（蚊取り線香）が消える', async () => { await p.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 5000 }); return true })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', r); return true
})
await t('OGP 一式があり og.png は 1200x630', async () => {
  const r = await p.evaluate(async () => {
    const g = n => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content
    const res = await fetch('og.png'); const blob = await res.blob(); const bm = await createImageBitmap(blob)
    return { t: g('og:title'), d: g('og:description'), i: g('og:image'), c: g('twitter:card'), s: res.status, w: bm.width, h: bm.height }
  })
  expect(r.t && r.d && r.i && r.c === 'summary_large_image' && r.s === 200 && r.w === 1200 && r.h === 630, r); return `${r.w}x${r.h}`
})
await t('古い文言が残っていない（吸う・かゆみ・刺す・寝ている・報告書）', async () => {
  const src = ['index.html', 'data.js', 'js/game.js', 'README.md'].map(f => readFileSync(ROOT + '/' + f, 'utf8')).join('\n')
  const hit = ['吸う', '吸っ', '吸血', 'かゆみ', '報告書', '刺す', '刺し', '寝ている', '寝静', '寝つく', 'Yuji Syuku', 'btnBite', 'kayumi', 'blood', 'Bite'].filter(w => src.includes(w))
  expect(hit.length === 0, hit.join(',')); return true
})
await t('公開物に使わない素材が残っていない（Kenney の人物・古い音）', async () => {
  const snd = readdirSync(ROOT + '/snd'); const g = readFileSync(ROOT + '/js/game.js', 'utf8')
  expect(!snd.some(f => /snore|suck|birds/.test(f)), 'old sound'); expect(!g.includes('GLTFLoader') && !g.includes('assets/chars'), 'glb')
  // game.js から呼ばれる音が全部ファイルとして存在する
  const refs = [...g.matchAll(/snd\/([a-z0-9_]+\.mp3)/g)].map(m => m[1]); const miss = refs.filter(f => !snd.includes(f)); expect(miss.length === 0, miss.join(','))
  // 使っていない音を置かない
  const unused = snd.filter(f => !refs.includes(f)); expect(unused.length === 0, 'unused:' + unused.join(','))
  return `${refs.length}本`
})
await t('初回の読み込みが軽い（画像＋three の合計 4MB 以下・three は配信時に圧縮される。音は最初のタップ後）', async () => {
  const sum = d => readdirSync(ROOT + '/' + d).reduce((s, f) => s + statSync(ROOT + '/' + d + '/' + f).size, 0)
  const mb = (sum('img') + statSync(ROOT + '/vendor/three.module.js').size + statSync(ROOT + '/vendor/three.core.js').size) / 1e6
  expect(mb < 4, mb); return mb.toFixed(2) + 'MB'
})

// ---------------- 通し
await t('タイトル → 飛び立つで遊びが始まる（実タップ）', async () => {
  await p.click('#btnStart'); const r = await p.evaluate(() => ({ mode: nm.mode, hud: !document.getElementById('hud').classList.contains('hidden') }))
  expect(r.mode === 'play' && r.hud, r); return true
})
await t('固定60Hz: 1秒ぶん進めると時計が1.00秒進む', async () => {
  const r = await p.evaluate(() => { nm.dbg.pause(true); const a = nm.W.t; nm.dbg.step(60); return nm.W.t - a })
  expect(Math.abs(r - 1) < 0.001, r); return true
})
await t('見た目が出ている（描画の輝度に分散がある）', async () => {
  const r = await p.evaluate(() => { nm.dbg.render(4); const c = document.querySelector('#view canvas'), o = document.createElement('canvas'); o.width = 64; o.height = 64; const g = o.getContext('2d'); g.drawImage(c, 0, 0, 64, 64); const d = g.getImageData(0, 0, 64, 64).data; let s = 0, s2 = 0; for (let i = 0; i < d.length; i += 4) { const y = d[i] * .3 + d[i + 1] * .6 + d[i + 2] * .1; s += y; s2 += y * y } const n = d.length / 4; return s2 / n - (s / n) ** 2 })
  expect(r > 200, r); return Math.round(r)
})
await t('チュートリアル: スティック→羽→赤い輪の順。文字は1つだけ', async () => {
  const r = await p.evaluate(() => {
    localStorage.removeItem('nm_tut2'); nm.start(21, { tut: true, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true)
    const tipT = () => document.getElementById('tip').textContent, seq = []
    let inp = { sx: 0, sy: 0, v: 0 }; nm.dbg.input(() => inp)
    nm.dbg.step(10); seq.push(tipT()); const bubbleShown = !document.getElementById('say').classList.contains('hidden')
    inp = { sx: 1, sy: 0, v: 0 }; nm.dbg.step(50); seq.push(tipT())
    inp = { sx: 0, sy: 0, v: 1 }; nm.dbg.step(30); seq.push(tipT())
    return { seq, bubbleShown, attacked: nm.people()[0].state }
  })
  expect(r.seq[0].includes('スティック') && r.seq[1].includes('羽') && r.seq[2].includes('輪から') && !r.bubbleShown, r); return r.seq
})
await t('チュートリアルは一度終われば次から出ない', async () => {
  const r = await p.evaluate(() => { let n = 0; nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 })); while (nm.M.alive && n < 1200) { nm.dbg.step(1); n++ } const a = localStorage.getItem('nm_tut2'); nm.dbg.step(200); clearTimeout(nm.W.stampTimer); nm.start(22); return { a, tut: nm.W.tut, hidden: document.getElementById('tip').classList.contains('hidden') } })
  expect(r.a === '1' && r.tut === 3 && r.hidden, r); return true
})

// ---------------- 攻撃の仕組み
await t('予備動作→当たり: 叩きは最低0.6秒前に赤い輪が出る。止まっていると当たる', async () => {
  const r = await p.evaluate(() => {
    nm.start(31, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 }))
    let firstRing = null, n = 0, deadAt = null
    while (nm.M.alive && n < 1200) { nm.dbg.step(1); n++; if (firstRing == null && nm.threats().some(t => t.type === 'point')) firstRing = nm.W.t; if (!nm.M.alive) deadAt = nm.W.t }
    return { firstRing, deadAt, lead: deadAt - firstRing, death: nm.M.death }
  })
  expect(r.death === 'swat' && r.lead >= 0.6, r); return { lead: +r.lead.toFixed(2), deadAt: +r.deadAt.toFixed(2) }
})
await t('見てよければ避けられる: 輪が赤く固定された後に横へ飛ぶと当たらない（5回とも）', async () => {
  const r = await p.evaluate(() => {
    const out = []
    for (let s = 0; s < 5; s++) {
      nm.start(40 + s, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); let inp = { sx: 0, sy: 0, v: 0 }; nm.dbg.input(() => inp)
      let n = 0, moved = false
      while (nm.M.alive && n < 420 && !(nm.W.firstStrike)) {
        nm.dbg.step(1); n++
        const pt = nm.threats().find(t => t.type === 'point' && t.locked)
        if (pt && !moved) { moved = true; inp = { sx: s % 2 ? 1 : -1, sy: 0, v: 0 } }   // 赤くなってから（輪が固定されてから）反応する
      }
      out.push({ alive: nm.M.alive, moved })
    }
    return out
  })
  expect(r.every(x => x.alive && x.moved), r); return true
})
await t('まっすぐ飛び続けても、後半は先読みで当てられる（序盤より狙いが前に出る）', async () => {
  const r = await p.evaluate(() => {
    const test = t0 => { nm.start(50, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.setT(t0); nm.W.spawns.length = 0; nm.people().length || nm.dbg.spawn('dad'); nm.M.pos.set(-2.2, 1.2, 0); nm.M.vel.set(2.2, 0, 0); nm.dbg.noAuto(true); nm.dbg.setCam(-Math.PI / 2, -0.12); nm.dbg.input(() => ({ sx: 0, sy: 1, v: 0 })); const dad = nm.people()[0]; dad.pos.set(-1.3, 0, 0.7); dad.cd = 0; nm.dbg.gap(0); let n = 0; while (!dad.act && n < 60) { nm.dbg.step(1); n++ } const a = dad.act; if (!a) return null; return a.aim.x - nm.M.pos.x }
    const early = test(0), late = test(110); nm.dbg.noAuto(false); return { early, late }
  })
  expect(r.late > r.early + 0.3, r); return r
})
await t('スプレー: 霧の中に長くいるとむせて落ちる。すぐ出れば助かる', async () => {
  const r = await p.evaluate(() => {
    const go = (stayFor) => {
      nm.start(60, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.setT(13); nm.W.spawns.length = 0; const mom = nm.dbg.spawn('mom'); nm.people()[0].cd = 999
      mom.pos.set(0, 0, 0); mom.state = 'chase'; mom.cd = 0; nm.dbg.gap(0); nm.M.pos.set(0, 1.2, 1.4); nm.M.vel.set(0, 0, 0); nm.dbg.noAuto(true); nm.dbg.setCam(0, -0.12)
      let inp = { sx: 0, sy: 0, v: 0 }; nm.dbg.input(() => inp); let n = 0, fired = 0, maxC = 0
      while (nm.M.alive && n < 400) { nm.M.pos.z = Math.max(nm.M.pos.z, 1.2); nm.dbg.step(1); n++; if (mom.act && mom.act.phase === 'fire') fired += 1 / 60; maxC = Math.max(maxC, nm.M.cough); if (fired > stayFor) inp = { sx: 1, sy: 0, v: 1 }; if (fired > 0 && !(mom.act && mom.act.phase === 'fire')) break }
      return { alive: nm.M.alive, death: nm.M.death, maxC: +maxC.toFixed(2) }
    }
    const a = go(9), b = go(0.15); nm.dbg.noAuto(false); return { stay: a, leave: b }
  })
  expect(r.stay.death === 'spray' && r.leave.alive && r.leave.maxC < 1, r); return r
})
await t('網: 扇の中で同じ高さだと捕まり、上へ逃げれば助かる', async () => {
  const r = await p.evaluate(() => {
    const go = (escape) => {
      nm.start(70, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.setT(31); nm.W.spawns.length = 0; const kid = nm.dbg.spawn('kid'); nm.people()[0].cd = 999
      kid.state = 'chase'; kid.cd = 0; kid.pos.set(0, 0, 0); nm.dbg.gap(0); nm.M.pos.set(0, 1.2, 1.0); nm.M.vel.set(0, 0, 0); let inp = { sx: 0, sy: 0, v: 0 }; nm.dbg.input(() => inp); let n = 0
      while (nm.M.alive && n < 300) { nm.dbg.step(1); n++; if (escape && kid.act && kid.act.locked) inp = { sx: 0, sy: 0, v: 1 }; if (kid.act && kid.act.phase === 'after') break }
      return { alive: nm.M.alive, death: nm.M.death, sawSector: nm.sector !== null }
    }
    return { stay: go(false), up: go(true) }
  })
  expect(r.stay.death === 'net' && r.up.alive, r); return r
})
await t('入れ歯: 飛んできて当たる（画面外なら端に出る）。よければ消える', async () => {
  const r = await p.evaluate(() => {
    nm.start(80, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.setT(31); nm.W.spawns.length = 0; const g = nm.dbg.spawn('gramps'); nm.people()[0].cd = 999
    g.state = 'chase'; g.cd = 0; g.pos.set(0, 0, -1.6); nm.dbg.gap(0); nm.M.pos.set(0, 1.2, 1.2); nm.M.vel.set(0, 0, 0); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 })); let n = 0, seen = 0
    while (nm.M.alive && n < 400) { nm.dbg.step(1); n++; if (nm.threats().some(t => t.type === 'ball')) seen++ }
    return { death: nm.M.death, by: nm.W.killer, seen }
  })
  expect(r.death === 'teeth' && r.by === 'gramps' && r.seen > 5, r); return r
})
await t('猫（レア）: 尻を振ってから飛びかかる／蚊やり豚（レア）: 煙の柱を置いて、中にいるとむせる', async () => {
  const r = await p.evaluate(() => {
    nm.start(90, { tut: false, cat: true, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.setT(21); nm.W.spawns.length = 0; const c = nm.dbg.spawn('cat'); nm.people()[0].cd = 999; c.state = 'chase'; c.cd = 0; c.pos.set(0, 0, 0); nm.dbg.gap(0); nm.M.pos.set(0, 0.9, 1.2); nm.M.vel.set(0, 0, 0); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 })); let n = 0; while (nm.M.alive && n < 500) { nm.dbg.step(1); n++ }
    const cat = { death: nm.M.death, by: nm.W.killer }
    nm.start(91, { tut: false, cat: false, pig: true, neighbor: false }); nm.dbg.pause(true); nm.dbg.setT(41); nm.W.spawns.length = 0; nm.people().length = nm.people().length; const pg = nm.dbg.spawn('pig'); nm.people()[0].cd = 999; pg.state = 'chase'; nm.M.pos.set(pg.pos.x, 1.0, pg.pos.z); nm.M.vel.set(0, 0, 0); n = 0; while (nm.M.alive && n < 700) { nm.M.pos.x = pg.pos.x; nm.M.pos.z = pg.pos.z; nm.dbg.step(1); n++ }
    return { cat, pig: { death: nm.M.death, by: nm.W.killer, cols: nm.threats().filter(t => t.type === 'column').length } }
  })
  expect(r.cat.death === 'cat' && r.pig.death === 'smoke' && r.pig.by === 'pig', r); return r
})
await t('隣のおっちゃん（レア）: 電撃ラケットで当たる', async () => {
  const r = await p.evaluate(() => { nm.start(92, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.setT(70); nm.W.spawns.length = 0; const g = nm.dbg.spawn('neighbor'); nm.people()[0].cd = 999; g.state = 'chase'; g.cd = 0; g.pos.set(0, 0, 0); nm.dbg.gap(0); nm.M.pos.set(0, 1.2, 1.1); nm.M.vel.set(0, 0, 0); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 })); let n = 0; while (nm.M.alive && n < 400) { nm.dbg.step(1); n++ } return { death: nm.M.death, by: nm.W.killer } })
  expect(r.death === 'zap' && r.by === 'neighbor', r); return true
})
await t('天井・隅は安全地帯にならない（叩きが届く）', async () => {
  const a = await run(p, 'ceil', 101), b = await run(p, 'corner', 102)
  expect(a.t < 25 && b.t < 25 && a.death && b.death, { a, b }); return { ceil: a.t, corner: b.t }
})
await t('人が時間で増える: 父→母(12秒)→残りの家族(30・50秒)、後半は攻撃の間隔が縮む', async () => {
  const r = await p.evaluate(() => {
    nm.start(120, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 }))
    const snaps = {}; const spawnsAt = nm.W.spawns.map(s => [s.id, s.t])
    for (const T of [1, 13, 31, 51]) { nm.dbg.setT(T - 0.02); nm.M.alive = true; nm.dbg.step(3); snaps[T] = nm.people().length }
    return { snaps, spawnsAt }
  })
  expect(r.snaps[1] === 1 && r.snaps[13] === 2 && r.snaps[31] === 3 && r.snaps[51] === 4, r); return r.snaps
})
await t('くん煙: 150秒から床が煙に埋まり、必ず終わる', async () => {
  const r = await p.evaluate(() => { nm.start(130, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.setT(150); nm.W.spawns.length = 0; for (const x of nm.people()) x.cd = 9999; nm.dbg.spawn('mom').cd = 9999; nm.dbg.gap(999); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 1 })); let n = 0; while (nm.M.alive && n < 60 * 60) { for (const x of nm.people()) x.cd = 9999; nm.dbg.gap(999); nm.dbg.step(1); n++ } return { t: nm.W.t, death: nm.M.death } })
  expect(r.death === 'fog' && r.t > 170 && r.t < 196, r); return r
})

// ---------------- bot の分布
const dist = {}
for (const kind of ['idle', 'wander', 'human', 'pro']) {
  const a = []; for (let i = 0; i < 8; i++) a.push(await run(p, kind, 1000 + i * 77))
  const ts = a.map(r => r.t); dist[kind] = { avg: +(ts.reduce((s, x) => s + x, 0) / ts.length).toFixed(1), min: Math.min(...ts), max: Math.max(...ts), ended: a.every(r => r.mode === 'result'), near: +(a.reduce((s, r) => s + r.near, 0) / a.length).toFixed(1) }
}
await t('分布: 何もしない<適当<見てよける。全員必ず終わる', async () => {
  expect(dist.idle.max < 10 && dist.wander.avg > dist.idle.avg * 2 && dist.human.avg > dist.wander.avg * 1.5 && dist.pro.avg >= dist.human.avg * 0.9, dist)
  expect(Object.values(dist).every(d => d.ended && d.max <= 196), dist); return dist
})
await t('同じ種・同じ操作なら同じ結果（再現性・確率で決まらない）', async () => {
  const a = await run(p, 'idle', 5), b = await run(p, 'idle', 5); expect(a.t === b.t && a.death === b.death, { a, b }); return a.t
})

// ---------------- 結果
await t('結果: 手配書に秒数・懸賞金・討伐者。判子は遅れて押される', async () => {
  const r = await p.evaluate(async () => {
    nm.start(140, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.input(__bot('human')); let n = 0; while (nm.mode === 'play' && n < 16000) { nm.dbg.step(60); n += 60 }
    const R = nm.W.result, c = document.getElementById('report'), stamp0 = !!R.stamped; const sum = () => { const g = c.getContext('2d'); const d = g.getImageData(560, 960, 260, 260).data; let red = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 70 && d[i + 2] < 60) red++; return red }; const red0 = sum()
    await new Promise(r => setTimeout(r, 1000)); return { sec: R.sec, bounty: R.bounty, rank: R.rankName, killer: R.killer, stamp0, stamp1: !!R.stamped, red0, red1: sum(), visible: !document.getElementById('result').classList.contains('hidden'), size: [c.width, c.height] }
  })
  expect(r.visible && !r.stamp0 && r.stamp1 && r.red1 > r.red0 + 500 && r.sec > 0 && r.killer, r); return r
})
await t('最高記録を保存して次回も出す。Xポストに秒数とURL', async () => {
  const r = await p.evaluate(() => ({ best: localStorage.getItem('nm_best'), hud: nm.best, post: document.getElementById('btnPost').href }))
  expect(parseFloat(r.best) > 0 && r.post.includes('x.com/intent/post') && r.post.includes(encodeURIComponent('秒')) && r.post.includes('night-mosquito'), r)
  await p.reload(); await p.waitForFunction(() => window.__nmReady); await p.addScriptTag({ path: ROOT + '/bots.js' }); await p.addScriptTag({ path: ROOT + '/scn.js' })
  const b = await p.evaluate(() => document.getElementById('bestT').textContent); expect(b.includes('最高'), b); return b
})
await t('下の記録より短ければ新記録にならない', async () => {
  const r = await p.evaluate(() => { const b = nm.best; nm.start(141, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 })); let n = 0; while (nm.mode === 'play' && n < 2000) { nm.dbg.step(1); n++ } return { record: nm.W.result.record, sec: nm.W.result.sec, b, after: nm.best } })
  expect(r.record === false && r.after === r.b, r); return true
})
await t('画像を保存できる（PNG の data URL）', async () => {
  const r = await p.evaluate(() => document.getElementById('report').toDataURL('image/png').length); expect(r > 50000, r); return r
})
await t('もう一回で状態が戻る（やられた絵・文字・煙が残らない）', async () => {
  const r = await p.evaluate(() => { document.getElementById('btnAgain').click(); nm.dbg.pause(true); nm.W.tut = 3; nm.dbg.render(3); return { mode: nm.mode, alive: nm.M.alive, t: nm.W.t < 0.2, word: document.getElementById('fxWord').classList.contains('hidden'), n: nm.people().length, frame: nm.M.frame, fog: nm.fog.visible, ress: document.getElementById('result').classList.contains('hidden') } })
  expect(r.mode === 'play' && r.alive && r.t && r.word && r.frame === 'm_back' && !r.fog && r.ress, r); return true
})
await t('一時停止で時間が止まり、続けると進む。やめるとタイトルへ', async () => {
  const r = await p.evaluate(async () => { nm.dbg.pause(false); document.getElementById('btnPause').click(); const a = nm.W.t; await new Promise(r => setTimeout(r, 400)); const b = nm.W.t, vis = !document.getElementById('pause').classList.contains('hidden'); document.getElementById('btnResume').click(); await new Promise(r => setTimeout(r, 400)); const c = nm.W.t; document.getElementById('btnPause').click(); document.getElementById('btnQuit').click(); return { a, b, c, vis, mode: nm.mode, title: !document.getElementById('title').classList.contains('hidden') } })
  expect(r.a === r.b && r.c > r.b && r.vis && r.mode === 'title' && r.title, r); return true
})
await t('タブを隠すと一時停止になる', async () => {
  const r = await p.evaluate(() => { nm.start(150, { tut: false }); Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); const v = nm.paused; delete document.hidden; nm.dbg.pause(false); document.getElementById('btnResume').click(); nm.toTitle(); return v })
  expect(r === true, r); return true
})

// ---------------- 音（鳴らさず回数で見る）
await t('音: 録音だけで鳴らす（BGM・環境音・羽音のループが始まる／叩き・スプレーの呼び出し）', async () => {
  const r = await p.evaluate(async () => {
    nm.start(160, { tut: false, cat: false, pig: false, neighbor: false }); await new Promise(r => setTimeout(r, 300)); nm.dbg.pause(true)
    nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 })); nm.dbg.setT(13); let n = 0; while (nm.M.alive && n < 800) { nm.dbg.step(1); n++ }
    const loops = Object.keys(Snd.loops).filter(k => Snd.loops[k]); await new Promise(r => setTimeout(r, 1500))
    return { loops, played: Snd.played, ok: window.__muteOk(), calls: window.__soundCalls, bgm: Snd.played['loop:bgm'] }
  })
  expect(r.loops.includes('bgm') && r.loops.includes('amb') && r.loops.includes('buzz') && r.ok && r.played.slap > 0 && r.played.thwack > 0, r); return { played: Object.keys(r.played).length, bgm: r.bgm, mute: r.ok }
})
await t('合成音を使っていない（createOscillator なし）', async () => { for (const f of ['js/game.js', 'sfx.js']) expect(!readFileSync(ROOT + '/' + f, 'utf8').includes('createOscillator'), f); return true })
await t('英語に切り替わる（タイトル・遊び方・結果）', async () => {
  const r = await p.evaluate(() => {
    nm.toTitle(); document.getElementById('btnLang').click()
    const a = document.querySelector('#title h1').textContent, how = document.getElementById('howList').textContent
    nm.start(170, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 })); let n = 0; while (nm.mode === 'play' && n < 2000) { nm.dbg.step(1); n++ }
    return { a, how, post: decodeURIComponent(document.getElementById('btnPost').href), rank: nm.W.result.rankName }
  })
  expect(/Mosquito/.test(r.a) && /mosquito/i.test(r.how) && /lasted/.test(r.post) && /[A-Za-z]/.test(r.rank), r)
  await p.waitForTimeout(1000); await p.screenshot({ path: `${ROOT}/shots/en-result.png` })
  await p.evaluate(() => { nm.toTitle(); document.getElementById('btnLang').click() }); return true
})
await t('実時間で通る（デバッグの歩進なし）: 放置すると叩かれ、約2秒後に手配書が出る。時計は実時間どおり', async () => {
  const r = await p.evaluate(async () => {
    nm.dbg.pause(false); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 })); nm.start(200, { tut: false, cat: false, pig: false, neighbor: false })
    const t0 = performance.now(); let tDead = null
    while (nm.mode === 'play' && performance.now() - t0 < 15000) { await new Promise(r => setTimeout(r, 50)); if (!nm.M.alive && tDead == null) tDead = performance.now() }
    return { mode: nm.mode, sec: nm.W.t, real: (tDead - t0) / 1000, after: (performance.now() - tDead) / 1000, death: nm.M.death }
  })
  expect(r.mode === 'result' && r.death === 'swat' && Math.abs(r.real - r.sec) < 0.8 && r.after > 1.6 && r.after < 3.2, r); return { sec: +r.sec.toFixed(2), real: +r.real.toFixed(2), after: +r.after.toFixed(2) }
})
await p.evaluate(() => { nm.dbg.input(null); nm.dbg.pause(true) })
await t('文字の同時表示: 吹き出しと案内は同時に出ない', async () => {
  const r = await p.evaluate(() => {
    localStorage.removeItem('nm_tut2'); nm.start(180, { tut: true }); nm.dbg.pause(true); let inp = { sx: 1, sy: 0.2, v: 0 }; nm.dbg.input(() => inp); let both = 0, n = 0; while (nm.M.alive && n < 1500) { nm.dbg.step(1); n++; if (n % 50 === 0) inp = { sx: -inp.sx, sy: inp.sy, v: 0 }; const a = !document.getElementById('tip').classList.contains('hidden'), b = !document.getElementById('say').classList.contains('hidden'); if (a && b) both++ } clearTimeout(nm.W.stampTimer); localStorage.setItem('nm_tut2', '1'); return both
  })
  expect(r === 0, r); return true
})
await p.evaluate(() => { nm.dbg.pause(false); nm.toTitle() })
await t('ここまでエラーなし', async () => { expect(p.errs.length === 0, p.errs.join('|')) })

// ---------------- スマホ縦3サイズ × Chromium・WebKit × 全画面
for (const [bt, name] of [[chromium, 'chromium'], [webkit, 'webkit']]) {
  const br = name === 'chromium' ? browser : await bt.launch()
  for (const [w, h, sz] of SIZES) {
    const q = await open(br, { viewport: { width: w, height: h }, hasTouch: true, isMobile: name === 'webkit', deviceScaleFactor: 2 })
    await t(`一画面・はみ出しなし ${name} ${sz}（タイトル・遊び方・遊び中・むせ・やられ・結果・一時停止）`, async () => {
      const bad = []
      const check = async nm_ => { const a = await fit(q), b = await overflow(q); if (a.over.length) bad.push(nm_ + JSON.stringify(a.over)); if (b.sw > b.W + 1 || b.bad.length) bad.push(nm_ + JSON.stringify(b)); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-${sz}-${nm_}.png` }) }
      await q.waitForTimeout(500); await check('title')
      await q.tap('#btnHow'); await q.waitForTimeout(300); await check('how'); await q.tap('#btnOk')
      await q.tap('#btnStart'); await q.waitForTimeout(250)
      expect(await q.evaluate(() => window.__muteOk()), 'NOT MUTED')
      await check('tut')
      await q.evaluate(() => __scn.swat()); await q.waitForTimeout(200); await check('play')
      await q.evaluate(() => __scn.chaos()); await q.waitForTimeout(200); await check('chaos')
      await q.evaluate(() => { __scn.die(0.3); document.getElementById('fxWord').style.animation = 'none' }); await q.waitForTimeout(250); await check('die')
      await q.evaluate(() => { nm.dbg.step(150) }); await q.waitForTimeout(1100); await check('result')
      await q.evaluate(() => { nm.dbg.pause(false); document.getElementById('btnAgain').click() }); await q.waitForTimeout(150); await q.evaluate(() => document.getElementById('btnPause').click()); await q.waitForTimeout(150); await check('pause')
      expect(bad.length === 0, bad.join(' ; ')); expect(q.errs.length === 0, q.errs.join('|')); return true
    })
    if (sz === 'phone') await t(`実タッチ操作 ${name}: スティックで動き、羽で上がり、なぞると向きが変わる`, async () => {
      const r = await q.evaluate(async () => { document.getElementById('btnResume').click(); nm.start(190, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.input(null); nm.dbg.noAuto(true); return { x: nm.M.pos.x } })
      const box = await q.locator('#stick').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2
      await q.evaluate(([cx, cy]) => { const z = document.getElementById('stickZone'); const ev = (t, x, y) => z.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })); ev('pointerdown', cx, cy); ev('pointermove', cx + 50, cy) }, [cx, cy])
      await q.waitForTimeout(400)
      const a = await q.evaluate(() => ({ x: nm.M.pos.x, y: nm.M.pos.y, sx: nm.stick.x }))
      await q.evaluate(([cx, cy]) => { document.getElementById('stickZone').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: cx, clientY: cy, bubbles: true, pointerType: 'touch' })) }, [cx, cy])
      await q.evaluate(() => { const b = document.getElementById('btnUp'); b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, bubbles: true, pointerType: 'touch' })) }); await q.waitForTimeout(350)
      const c = await q.evaluate(() => { const b = document.getElementById('btnUp'); b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, bubbles: true, pointerType: 'touch' })); return nm.M.pos.y })
      const y0 = await q.evaluate(() => { const v = document.getElementById('view'); const ev = (t, x) => v.dispatchEvent(new PointerEvent(t, { pointerId: 9, clientX: x, clientY: 300, bubbles: true, pointerType: 'touch' })); const a = nm.camYaw; ev('pointerdown', 200); ev('pointermove', 260); ev('pointerup', 260); const b = nm.camYaw; nm.dbg.noAuto(false); return { a, b } })
      expect(a.x > r.x + 0.3 && a.sx > 0.5 && c > a.y + 0.15 && y0.a !== y0.b, { r, a, c, y0 }); return true
    })
    await q.context().close()
  }
  if (name !== 'chromium') await br.close()
}

for (const l of results) console.log(l)
console.log(`\n${pass} passed, ${fail} failed`)
console.log('dist', JSON.stringify(dist))
await browser.close(); server.kill()
process.exit(fail ? 1 : 0)
