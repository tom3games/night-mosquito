// 夏の夜の蚊: 文言（日英）と追っ手のデータ。処理は js/game.js
window.NM_TEXT = {
  ja: {
    title: '夏の夜の蚊', sub: '起きた家族の攻撃を飛び回ってかわせ。\n何秒生きのびる？',
    start: '飛び立つ', howBtn: '遊び方', lang: 'English', more: 'ほかのバカゲー', soundOn: '音 オン', soundOff: '音 オフ',
    loading: '家族が目を覚ますまで待機中', loadingDone: '起きました', best: '最高', sec: '秒',
    howTitle: '回覧 蚊の駆除について',
    how: [
      '起きた家族が部屋じゅう追いかけてくる。あなたは蚊。当たったら一発でおしまい。',
      '輪が追ってきて赤くなると、そこに叩きが落ちる。輪から逃げる。スプレーの霧に長くいるとむせて落ちる。',
      '人も攻撃も時間とともに増える。画面の端の顔は外にいる人。生きのびた秒数が記録。',
    ],
    who: [['dad', '父', 'ハエたたき'], ['mom', '母', 'スプレー'], ['kid', 'たろう', '虫取り網'], ['gramps', 'じいちゃん', '入れ歯']],
    keysTouch: [['左下のまる', '飛ぶ'], ['右の羽', '上がる / 下がる'], ['画面をなぞる', '見回す']],
    ok: 'わかった',
    credit: '音楽と効果音は OpenGameArt・Wikimedia Commons の録音（CC0・パブリックドメイン）',
    again: 'もう一回', save: '画像を保存', post: 'Xでポスト', toTitle: 'タイトルへ',
    resume: '続ける', quit: 'やめる', paused: '一時停止',
    tut: { move: '左下のスティックで飛ぶ', wing: '右の羽で上がる・下がる', dodge: '輪から逃げて' },
    near: 'ギリ', fogWarn: '最終手段や',
    death: { swat: 'ぺちっ', spray: 'げほっ', net: 'ばさっ', teeth: 'がぶっ', zap: 'ばちっ', cat: 'にゃっ', smoke: 'げほっ', fog: 'げほっ' },
    deathNote: {
      swat: 'ハエたたきで\n仕留められた', spray: 'スプレーで\nむせて落ちた', net: '虫取り網で\n捕まった', teeth: '入れ歯に\n噛まれた',
      zap: '電撃ラケットで\n焦げた', cat: '猫パンチを\nくらった', smoke: '蚊やり豚の煙で\nむせた', fog: '部屋ごと\n燻された',
    },
    poster: {
      wanted: '指名手配', name: '夏の夜の蚊', crime: '罪状 羽音', alive: '逃亡', sec: '秒', bounty: '懸賞金', yen: '円',
      by: '討伐', record: '新記録', near: 'ギリ', times: '回',
    },
    ranks: ['ただの羽音', '耳元の常連', '町内会の議題', '全国指名手配', '伝説の夏の蚊'],
    rankLines: [['ただの', '羽音'], ['耳元の', '常連'], ['町内会の', '議題'], ['全国', '指名手配'], ['伝説の', '夏の蚊']],
    postText: r => `夏の夜の蚊で ${r.sec}秒 逃げた。懸賞金 ${r.bounty}円「${r.rank}」`,
    tags: '#夏の夜の蚊 #バカゲー',
  },
  en: {
    title: 'Summer Night Mosquito', sub: 'The family is awake and swinging. Fly around them. How long can you last?',
    start: 'Take off', howBtn: 'How to play', lang: '日本語', more: 'More silly games', soundOn: 'Sound: on', soundOff: 'Sound: off',
    loading: 'Waiting for the family to wake up', loadingDone: 'They are up', best: 'Best', sec: 's',
    howTitle: 'Notice: about the mosquito',
    how: [
      'You are the mosquito. The family chases you around the room. One hit and it is over.',
      'A ring follows you. When it turns red, the swat lands there. Get out. Stay in spray too long and you drop.',
      'More people, more attacks over time. Faces at the screen edge are people off screen. Your score is how long you last.',
    ],
    who: [['dad', 'Dad', 'Swatter'], ['mom', 'Mom', 'Spray'], ['kid', 'Taro', 'Bug net'], ['gramps', 'Grandpa', 'Dentures']],
    keysTouch: [['Bottom-left circle', 'Fly'], ['Wings', 'Up / Down'], ['Drag the screen', 'Look']],
    ok: 'Got it',
    credit: 'Music and sounds: recordings from OpenGameArt and Wikimedia Commons (CC0, public domain)',
    again: 'Again', save: 'Save image', post: 'Post on X', toTitle: 'Title',
    resume: 'Resume', quit: 'Quit', paused: 'Paused',
    tut: { move: 'Fly with the stick', wing: 'Wings go up and down', dodge: 'Get out of the ring' },
    near: 'Close!', fogWarn: 'Last resort.',
    death: { swat: 'SPLAT', spray: 'COUGH', net: 'SWOOP', teeth: 'CHOMP', zap: 'ZAP', cat: 'BONK', smoke: 'COUGH', fog: 'COUGH' },
    deathNote: {
      swat: 'Swatted flat', spray: 'Choked on\nbug spray', net: 'Caught in\na bug net', teeth: 'Bitten by\nflying dentures',
      zap: 'Fried by\na zapper racket', cat: 'Taken out by\na cat paw', smoke: 'Choked by\nthe coil pig', fog: 'Fumigated with\nthe whole room',
    },
    poster: {
      wanted: 'WANTED', name: 'Summer Night Mosquito', crime: 'Crime: buzzing', alive: 'At large', sec: 's', bounty: 'Bounty', yen: ' yen',
      by: 'Taken down by', record: 'New record', near: 'Close calls', times: '',
    },
    ranks: ['Just a buzz', 'Ear regular', 'Town meeting topic', 'Nationwide wanted', 'Legend of summer'],
    rankLines: [['Just', 'a buzz'], ['Ear', 'regular'], ['Town', 'meeting', 'topic'], ['Nationwide', 'wanted'], ['Legend', 'of summer']],
    postText: r => `I lasted ${r.sec}s in Summer Night Mosquito. Bounty ${r.bounty} yen: "${r.rank}"`,
    tags: '#SummerNightMosquito',
  },
}

// 追っ手。h: 立ち絵の身長(m)、speed: 足の速さ、kind: 攻撃、wake/hit/win: 一言（12字前後）
window.NM_FAMILY = {
  dad: {
    h: 1.72, speed: 1.25, kind: 'swat', name: { ja: '父', en: 'Dad' },
    wake: { ja: ['明日も早いんじゃ', '何時や思てんねん'], en: ['I work tomorrow!', 'Do you know the time?'] },
    hit: { ja: ['そこやっ', '逃げんなコラ', '部長より憎い', 'この一発に残業を'], en: ['There!', 'Get back here!', 'Worse than my boss!', 'This is for overtime!'] },
    win: { ja: ['よっしゃ寝れる', 'ローンより軽いわ'], en: ['Finally, sleep.', 'Lighter than my loan.'] },
  },
  mom: {
    h: 1.62, speed: 1.05, kind: 'spray', name: { ja: '母', en: 'Mom' },
    wake: { ja: ['網戸閉めてって言うた', '誰が開けたん'], en: ['Who left the screen open?', 'I told you all!'] },
    hit: { ja: ['シューっといくで', '洗濯より厄介', '家計より憎い', 'はい息止めて'], en: ['Hold your breath.', 'Worse than laundry!', 'Worse than the bills!', 'Psssht time.'] },
    win: { ja: ['はい、おしまい', '明日ゴミの日やし'], en: ['And done.', 'Trash day tomorrow.'] },
  },
  kid: {
    h: 1.3, speed: 1.7, kind: 'net', name: { ja: 'たろう', en: 'Taro' },
    wake: { ja: ['自由研究にする！', '蚊や！蚊やで！'], en: ['Summer project!', 'A mosquito!'] },
    hit: { ja: ['つかまえたる！', '100円もらえる！', '宿題これでええ'], en: ['Gotcha!', 'Worth 100 yen!', 'This is my homework!'] },
    win: { ja: ['先生に見せる！', '名前はケンタ！'], en: ['Showing my teacher!', 'I name it Kenta!'] },
  },
  gramps: {
    h: 1.42, speed: 0.72, kind: 'teeth', name: { ja: 'じいちゃん', en: 'Grandpa' },
    wake: { ja: ['ふがふが', 'わしの歯ぁ飛ばす'], en: ['Fgh fgh.', 'My teeth will do it.'] },
    hit: { ja: ['ふが！', '歯をくらえ', '昔はもっとおった', '取ってこい歯'], en: ['Fgh!', 'Eat my teeth!', 'More of you back then!', 'Go, teeth!'] },
    win: { ja: ['ふがっふがっ', '歯はどこや'], en: ['Fgh fgh fgh.', 'Where are my teeth?'] },
  },
  neighbor: {
    h: 1.75, speed: 1.1, kind: 'zap', name: { ja: '隣のおっちゃん', en: 'The neighbor' },
    wake: { ja: ['音で隣から来たで', 'ええ棒持ってきた'], en: ['Heard you from next door.', 'Brought my racket.'] },
    hit: { ja: ['バチバチいくで', 'ええ音出してや', '勝手に上がったで'], en: ['Crackle time!', 'Sing for me!', 'I let myself in.'] },
    win: { ja: ['ええ音したわ', 'ほな帰るわ'], en: ['Nice sound.', 'I will head home.'] },
  },
  cat: {
    h: 0.78, speed: 1.8, kind: 'leap', name: { ja: 'ねこ', en: 'The cat' },
    wake: { ja: ['にゃ', '…'], en: ['Meow.', '...'] }, hit: { ja: ['にゃっ', 'にゃ！'], en: ['Mrow!', 'Meow!'] }, win: { ja: ['ごろごろ'], en: ['Purr.'] },
  },
  pig: {
    h: 0.72, speed: 0.6, kind: 'smoke', name: { ja: '蚊やり豚', en: 'The coil pig' },
    wake: { ja: ['ぶひ', '線香切らしてへん'], en: ['Oink.', 'Coil is still lit.'] },
    hit: { ja: ['ぶふー', 'ぶひひ'], en: ['Pfffft.', 'Oink oink.'] }, win: { ja: ['ぶひひ'], en: ['Oink oink.'] },
  },
}
