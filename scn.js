// 撮影・検証用の場面づくり（ページ内）
window.__scn = {
  // 叩かれる直前: 父の赤い輪
  swat() { nm.start(5, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.noAuto(false); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 })); const dad = () => nm.people()[0]; let n = 0; while (!(dad() && dad().act && dad().act.t > 0.45) && n < 900) { nm.dbg.step(1); n++ } nm.dbg.render(30); return nm.state() },
  // 母のスプレー噴射中
  spray() { nm.start(5, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.setT(13); const mom = nm.dbg.spawn('mom'); nm.W.spawns.length = 0; nm.people().find(p => p.id !== 'mom')?.pos.set(-2.4, 0, -2.4); const others = nm.people().filter(p => p.id !== 'mom'); others.forEach(o => { o.cd = 99 }); nm.dbg.gap(0); mom.pos.set(0.4, 0, -0.3); nm.M.pos.set(-0.3, 1.25, 1.45); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 })); nm.dbg.setCam(0, -0.12); let n = 0; while (!(mom.act && mom.act.phase === 'fire' && mom.act.t > 0.3) && n < 500) { nm.dbg.step(1); nm.M.cough = 0; n++ } nm.dbg.render(30); return nm.state() },
  // 最初から全員そろった後半の騒ぎ
  chaos() { nm.start(11, { tut: false, cat: true, pig: true, neighbor: true }); nm.dbg.pause(true); nm.dbg.input(__bot('pro')); nm.dbg.setT(70); let n = 0; while (n < 300 && nm.M.alive) { nm.dbg.step(1); n++ } nm.dbg.render(30); return nm.state() },
  // 死ぬ瞬間
  die(sec = 0.25) { nm.start(9, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.input(() => ({ sx: 0, sy: 0, v: 0 })); let n = 0; while (nm.M.alive && n < 3000) { nm.dbg.step(1); n++ } nm.dbg.step(Math.round(sec * 60)); nm.dbg.render(30); return nm.state() },
  // 結果まで
  result(kind = 'human', seed = 1077) { nm.start(seed, { tut: false }); nm.dbg.pause(true); nm.dbg.input(__bot(kind)); let n = 0; while (nm.mode === 'play' && n < 16000) { nm.dbg.step(60); n += 60 } return nm.state() },
  // 燻煙
  fog() { nm.start(3, { tut: false, cat: false, pig: false, neighbor: false }); nm.dbg.pause(true); nm.dbg.input(__bot('pro')); nm.dbg.setT(165); nm.W.spawns.length = 0; for (const id of ['mom', 'kid']) nm.dbg.spawn(id); nm.dbg.step(120); nm.dbg.render(30); return nm.state() },
}
