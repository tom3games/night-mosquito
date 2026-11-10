# 夏の夜の蚊

蚊になって、起きた家族の攻撃を飛び回ってかわす3Dバカゲー。生きのびた秒数がスコア。ブラウザで遊べる。

- 操作: 左下のスティックで飛ぶ・右の羽ボタンで上下・画面をなぞって見回す（何もしなければ攻撃してくる人の方へ自動で向く）
- 赤い輪が縮むとそこに叩きが落ちる。スプレーの霧・蚊やり豚の煙は長くいるとむせて落ちる
- 結果は懸賞金つきの指名手配書

## 開発
- `node server.mjs` で http://localhost:5643
- `node verify.mjs` 検証一式（音は出さない）、`node sim.mjs` bot の分布、`node og.mjs` OGP 画像、`node shot.mjs <名前> <式...>` 撮影
- 絵は `python art/key.py` で切り抜いて img/ へ（Pillow と numpy が要る。元絵 art/raw は Git に入れない）
- 素材のライセンスは CREDITS.md
