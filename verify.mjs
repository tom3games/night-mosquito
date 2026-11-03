// 夏の夜の蚊の検証一式。node verify.mjs（音は出さない）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
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
  if (clear) await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__nmReady, null, { timeout: 20000 })
  await p.addScriptTag({ path: ROOT + '/bots.js' })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('section:not(.hidden) *, #say:not(.hidden)')) {
    if (el.closest('.hidden') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, W = innerWidth, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('section:not(.hidden) button, section:not(.hidden) canvas, section:not(.hidden) a, section:not(.hidden) h1, section:not(.hidden) .notice')) { if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue; const r = el.getBoundingClientRect(); if (!r.width) continue; if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1) over.push((el.id || el.className || el.tagName) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
// 2つの要素が重なっていないか
const overlap = (q, a, b) => q.evaluate(([a, b]) => { const A = document.querySelector(a), B = document.querySelector(b); if (!A || !B || A.closest('.hidden') || B.closest('.hidden')) return false; const r = A.getBoundingClientRect(), s = B.getBoundingClientRect(); if (!r.width || !s.width) return false; return !(r.right <= s.left || s.right <= r.left || r.bottom <= s.top || s.bottom <= r.top) }, [a, b])
// 2026-11-03 本人方針: スマホ縦だけ確かめる（横持ち・PC は指定された時だけ）
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]
const night = (p, kind, seed, opts) => p.evaluate(({ kind, seed, opts }) => {
  nm.start(seed, opts); nm.dbg.pause(true); nm.dbg.input(__bot(kind))
  let n = 0; while (nm.mode === 'play' && n < 60 * 200) { nm.dbg.step(60); n += 60 }
  const s = nm.W.result || nm.score()
  return { mg: +s.mg, bites: s.bites, alive: s.alive, rank: s.rank, death: nm.M.death, t: Math.round(nm.W.t), mode: nm.mode }
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
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', r); return r
})
await t('OGP 一式がある', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]')))
  expect(r.every(Boolean), r)
})
await t('タイトルの3Dに部屋と家族が描けている（輝度の散らばり）', async () => {
  const v = await p.evaluate(() => { nm.dbg.render(); const c = document.querySelector('#view canvas'), g = document.createElement('canvas'); g.width = 120; g.height = 200; const x = g.getContext('2d'); x.drawImage(c, 0, 0, 120, 200); const d = x.getImageData(0, 0, 120, 200).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ } return Math.round(s2 / n - (s / n) ** 2) })
  expect(v > 150, 'variance ' + v); return v
})
// ---- 遊びの通し
await t('始めるとHUDが出て、時計が23時から進む', async () => {
  await p.click('#btnStart'); await p.waitForTimeout(600)
  const r = await p.evaluate(() => ({ mode: nm.mode, hud: !document.getElementById('hud').classList.contains('hidden'), t: nm.W.t, clock: document.getElementById('clockT').textContent }))
  expect(r.mode === 'play' && r.hud && r.t > 0 && /^23:/.test(r.clock), r); return r
})
await t('何もしない通し: 朝まで生きのびるが0か所・最低の判定', async () => { const r = await night(p, 'idle', 3); expect(r.mode === 'result' && r.bites === 0 && r.rank === 0 && r.mg === 0, r); return r })
const sims = { reckless: [], skilled: [] }
for (const kind of ['reckless', 'skilled']) for (let i = 0; i < 6; i++) sims[kind].push(await night(p, kind, 2000 + i * 31))
await t('下手（顔に突っ込んで吸い続ける）は叩かれて早く終わる', async () => { const a = sims.reckless; const dead = a.filter(r => !r.alive).length, avgT = a.reduce((s, r) => s + r.t, 0) / a.length; expect(dead >= 5 && avgT < 90, a); return { dead, avgT } })
await t('上手（足元から・起きかけたら離れる・天井で消化）は朝まで生きて高い判定', async () => { const a = sims.skilled; const alive = a.filter(r => r.alive).length, avgRank = a.reduce((s, r) => s + r.rank, 0) / a.length; expect(alive >= 5 && avgRank >= 3, a); return { alive, avgRank, mg: a.map(r => r.mg) } })
await t('上手と下手で点の差がはっきり出る（平均の血の量が2倍以上）', async () => { const m = k => sims[k].reduce((s, r) => s + r.mg, 0) / sims[k].length; expect(m('skilled') > m('reckless') * 2, { s: m('skilled'), r: m('reckless') }); return { skilled: m('skilled').toFixed(2), reckless: m('reckless').toFixed(2) } })
await t('同じ夜（種）と同じ操作なら同じ結果', async () => { const a = await night(p, 'skilled', 4242), b = await night(p, 'skilled', 4242); expect(JSON.stringify(a) === JSON.stringify(b), [a, b]); return a })
await t('刺して吸うとお腹がふくらみ、刺した数に入る', async () => {
  const r = await p.evaluate(() => { nm.start(11, { gramps: false, cat: false }); nm.dbg.pause(true); const mom = nm.people().find(p => p.id === 'mom'); mom.updateWorld(); const s = mom.spots.find(s => s.key === 'footL'); nm.M.pos.copy(s.w).add({ x: 0, y: 0.06, z: 0 }); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0, bite: true })); nm.dbg.step(1); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0, bite: false })); const st0 = nm.M.state; nm.dbg.step(120); return { st0, st: nm.M.state, full: nm.M.full, bites: nm.W.bites.length, scale: nm.M.full } })
  expect(r.st0 === 'land' && r.st === 'suck' && r.full > 0.1 && r.bites === 1, r); return r
})
await t('毛深い父の足は刺さらない（数に入らない）', async () => {
  const r = await p.evaluate(() => { nm.start(12, { gramps: false, cat: false }); nm.dbg.pause(true); const dad = nm.people()[0]; dad.updateWorld(); const s = dad.spots.find(s => s.hairy && s.ok); nm.M.pos.copy(s.w).add({ x: 0, y: 0.06, z: 0 }); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0, bite: true })); nm.dbg.step(1); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0, bite: false })); nm.dbg.step(90); return { hairy: !!s, st: nm.M.state, bites: nm.W.bites.length, full: nm.M.full } })
  expect(r.hairy && r.bites === 0 && r.full === 0 && r.st === 'fly', r); return r
})
await t('壁や天井にとまると消化してお腹が軽くなる', async () => {
  const r = await p.evaluate(() => { nm.start(13, { gramps: false, cat: false }); nm.dbg.pause(true); nm.M.full = 0.8; nm.M.pos.set(-0.5, 2.33, 0.6); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0, bite: true })); nm.dbg.step(1); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0, bite: false })); const st = nm.M.state; nm.dbg.step(300); return { st, full: +nm.M.full.toFixed(2) } })
  expect(r.st === 'rest' && r.full < 0.6, r); return r
})
await t('蚊取り線香の煙にいるとふらふらして落ちる', async () => {
  const r = await p.evaluate(() => { nm.start(14, { gramps: false, cat: false }); nm.dbg.pause(true); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0, bite: false })); const c = nm.room.coil.pos; let n = 0; while (nm.M.alive && n < 600) { nm.M.pos.set(c.x, 0.4, c.z); nm.M.vel.set(0, 0, 0); nm.dbg.step(1); n++ } return { alive: nm.M.alive, death: nm.M.death, sec: +(n / 60).toFixed(1) } })
  expect(!r.alive && r.death === 'smoke' && r.sec < 4, r); return r
})
await t('扇風機の風に流される', async () => {
  const r = await p.evaluate(() => { nm.start(15, { gramps: false, cat: false }); nm.dbg.pause(true); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0, bite: false })); const f = nm.room.fan; f.root.updateMatrixWorld(true); nm.W.fanA = 0; const head = f.neck.getWorldPosition(f.head.clone()); const a = f.root.rotation.y; nm.room.fan.root.rotation.y = -2.45; const d = { x: Math.sin(-2.45), z: Math.cos(-2.45) }; nm.M.pos.set(head.x + d.x * 0.6, head.y, head.z + d.z * 0.6); const p0 = nm.M.pos.clone(); nm.dbg.step(30); return { moved: +nm.M.pos.distanceTo(p0).toFixed(3) } })
  expect(r.moved > 0.2, r); return r
})
await t('母が起きると電気がつき、うちわが来る', async () => {
  const r = await p.evaluate(() => { nm.start(16, { gramps: false, cat: false }); nm.dbg.pause(true); const mom = nm.people().find(p => p.id === 'mom'); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0, bite: false })); let n = 0; while (mom.state === 'sleep' && n < 3000) { nm.M.pos.copy(mom.headPos).add({ x: -0.12, y: 0.12, z: 0.2 }); nm.dbg.step(1); n++ } const light = nm.W.light > 0; nm.dbg.step(60); return { light, act: mom.act, uchiwa: nm.uchiwa.visible, sec: +(n / 60).toFixed(1) } })
  expect(r.light && r.act === 'uchiwa' && r.uchiwa && r.sec < 8, r); return r
})
await t('起きかけの合図（寝返り・顔のしわ）が叩かれる前に出る', async () => {
  const r = await p.evaluate(() => { nm.start(17, { gramps: false, cat: false }); nm.dbg.pause(true); const dad = nm.people()[0]; nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0, bite: false })); let turnedAt = null, decalAt = null, n = 0; while (dad.state === 'sleep' && n < 4000) { nm.M.pos.copy(dad.headPos).add({ x: 0.18, y: 0.18, z: 0.25 }); nm.dbg.step(1); n++; nm.dbg.render(); if (dad.turned && turnedAt == null) turnedAt = n / 60; if (dad.decal.material.opacity > 0.3 && decalAt == null) decalAt = n / 60 } return { turnedAt, decalAt, wakeAt: n / 60 } })
  expect(r.turnedAt != null && r.decalAt != null && r.wakeAt - r.turnedAt > 1, r); return r
})
await t('じいちゃんは殺虫スプレー（霧が出る）', async () => {
  const r = await p.evaluate(() => { nm.start(18, { gramps: true, cat: false }); nm.dbg.pause(true); const g = nm.people().find(p => p.id === 'gramps'); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0, bite: false })); let n = 0; while (g.state === 'sleep' && n < 6000) { nm.M.pos.copy(g.headPos).add({ x: 0.1, y: 0.15, z: 0.15 }); nm.dbg.step(1); n++ } nm.dbg.step(70); return { act: g.act, can: nm.can.visible, sec: +(n / 60).toFixed(1), calls: Snd.played.spray || 0 } })
  expect(r.act === 'spray' && r.can && r.calls > 0, r); return r
})
await t('猫（レア）は近づくと猫パンチ', async () => {
  const r = await p.evaluate(() => { nm.start(19, { gramps: false, cat: true }); nm.dbg.pause(true); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0, bite: false })); let n = 0; while (nm.M.alive && n < 600) { nm.M.pos.copy(nm.cat.headPos).add({ x: 0, y: 0.05, z: -0.15 }); nm.dbg.step(1); n++ } return { alive: nm.M.alive, death: nm.M.death } })
  expect(!r.alive && r.death === 'cat', r); return r
})
await t('かゆみ報告書が描けている（輝度の散らばり）・Xポストに結果と URL', async () => {
  await night(p, 'skilled', 2000)
  const r = await p.evaluate(() => { const c = document.getElementById('report'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ } return { v: Math.round(s2 / n - (s / n) ** 2), post: document.getElementById('btnPost').href, shown: !document.getElementById('result').classList.contains('hidden') } })
  expect(r.v > 300 && r.shown && /x\.com\/intent\/post/.test(r.post) && /night-mosquito/.test(r.post), r); return { v: r.v }
})
await t('遊び中の文字は同時に2つまで（ヒント＋吹き出し）', async () => {
  const r = await p.evaluate(() => { nm.start(20); nm.dbg.pause(true); nm.dbg.input(__bot('reckless')); let mx = 0; for (let i = 0; i < 1200 && nm.mode === 'play'; i++) { nm.dbg.step(1); nm.dbg.render(); const n = [...document.querySelectorAll('#tip, #say')].filter(e => !e.classList.contains('hidden') && !e.classList.contains('off') && e.textContent).length; mx = Math.max(mx, n) } return mx })
  expect(r <= 2, r); return r
})
await t('音: 羽音・叩く音などを鳴らす呼び出しがある（実際には無音）', async () => {
  const r = await p.evaluate(() => ({ slap: Snd.played.slap || 0, swish: Snd.played.swish || 0, loops: Object.keys(Snd.played).filter(k => k.startsWith('loop:')), mute: window.__muteOk() }))
  expect(r.slap > 0 && r.swish > 0 && r.mute, r); return r
})
await t('英語に切り替えると文言と報告書が英語', async () => {
  await p.evaluate(() => nm.toTitle()); await p.click('#btnLang')
  const r = await p.evaluate(() => ({ h1: document.querySelector('#title h1').textContent, start: document.getElementById('btnStart').textContent }))
  await p.click('#btnLang')
  expect(r.h1 === 'Summer Night Mosquito' && /Fly/.test(r.start), r); return r
})
await t('Chromium: エラーなし', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---- スマホ縦3サイズ × 全画面（Chromium と WebKit）
const wk0 = await webkit.launch()
for (const [eng, bw] of [['chromium', browser], ['webkit', wk0]]) for (const [w, h, name0] of SIZES) {
  const name = eng + '-' + name0, touch = true
  const q = await open(bw, { viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch })
  const views = {}
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  const tap = sel => eng === 'webkit' ? q.tap(sel) : q.click(sel)
  await tap('#btnHow'); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` }); await tap('#btnOk')
  await tap('#btnStart'); await q.waitForTimeout(300)
  await q.evaluate(() => { nm.dbg.pause(true); const mom = nm.people().find(p => p.id === 'mom'); mom.updateWorld(); const s = mom.spots.find(s => s.key === 'armR'); nm.M.pos.copy(s.w).add({ x: 0.03, y: 0.07, z: 0.05 }); nm.dbg.setCam(0.6, -0.5); nm.dbg.step(1); for (let i = 0; i < 20; i++) nm.dbg.render() })
  views.play = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  const ov = touch ? await overlap(q, '.clock', '#tip') : false
  await t(`${name}: 時計とヒントが重ならない`, async () => { expect(!ov, ov) })
  await q.evaluate(() => nm.dbg.pause(false)); await tap('#btnPause'); views.pause = await fit(q); await tap('#btnResume')
  await night(q, 'skilled', 2000); await q.waitForTimeout(400)
  views.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, r) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await q.close()
}
await wk0.close()
await browser.close()

// ---- WebKit（iPhone 相当）でタッチの通し
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで始まり、左下のスティックで前に飛ぶ', async () => {
  await wp.tap('#btnStart'); await wp.waitForTimeout(400)
  const r = await wp.evaluate(async () => {
    const z = document.getElementById('stickZone'), st = document.getElementById('stick').getBoundingClientRect(), cx = st.left + st.width / 2, cy = st.top + st.height / 2
    const p0 = nm.M.pos.clone()
    z.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: cx, clientY: cy, bubbles: true }))
    z.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: cx, clientY: cy - 50, bubbles: true }))
    await new Promise(r => setTimeout(r, 900))
    z.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: cx, clientY: cy - 50, bubbles: true }))
    return { moved: +nm.M.pos.distanceTo(p0).toFixed(2), visible: getComputedStyle(document.getElementById('touch')).display }
  })
  expect(r.moved > 0.15 && r.visible !== 'none', r); return r
})
await t('WebKit: 右下のボタンで刺す・もう一度で飛び立つ', async () => {
  const r = await wp.evaluate(async () => {
    const mom = nm.people().find(p => p.id === 'mom'); const s = mom.spots.find(s => s.key === 'footR'); nm.M.pos.copy(s.w).add({ x: 0, y: 0.06, z: 0 }); nm.M.vel.set(0, 0, 0)
    await new Promise(r => setTimeout(r, 120))
    const b = document.getElementById('btnBite'), st0 = b.dataset.s
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 900))
    const st1 = nm.M.state, s1 = b.dataset.s
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 200))
    return { st0, st1, s1, st2: nm.M.state }
  })
  expect(r.st0 === 'bite' && r.st1 === 'suck' && r.s1 === 'leave' && r.st2 === 'fly', r); return r
})
await t('WebKit: 実際には無音（タップで音を鳴らした後）', async () => { const r = await wp.evaluate(() => ({ ok: window.__muteOk(), calls: window.__soundCalls })); expect(r.ok, r); return r })
await wp.screenshot({ path: `${ROOT}/shots/webkit-play.png` })
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
