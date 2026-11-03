// 夏の夜の蚊: 文言（日英）と家族のデータ。処理は js/game.js
window.NM_TEXT = {
  ja: {
    title: '夏の夜の蚊', sub: '蚊になって、寝ている家族の血を吸う。耳元で鳴くと手が飛んでくる。',
    start: '夜を飛ぶ', howBtn: '遊び方', lang: 'English', more: 'ほかのバカゲー', soundOn: '音あり', soundOff: '音なし',
    loading: '家族が寝つくまで待機中', loadingDone: '寝静まりました',
    howTitle: '遊び方',
    how: [
      'あなたは蚊。23時から朝5時までに、寝ている家族の血を吸う。',
      '肌がうっすら光ったら刺せる。吸うほどお腹が赤く重くなる。壁や天井にとまると消化できる。',
      '耳元を飛ぶと起きかける。寝返り・寝言・しかめっつらが合図。起きたら手やうちわが飛んでくる。',
      '蚊取り線香の煙を吸うと落ちる。扇風機の風には流される。',
    ],
    keysPC: [['WASD', '飛ぶ'], ['Space / Shift', '上がる / 下がる'], ['ドラッグ', '見回す'], ['E', '刺す・飛び立つ']],
    keysTouch: [['左下のまる', '飛ぶ（カメラの向きへ）'], ['右の羽', '上がる / 下がる'], ['右下', '刺す・飛び立つ'], ['右側をなぞる', '見回す']],
    ok: 'わかった',
    credit: '人物 Kenney（CC0）／音 Wikimedia Commons・OpenGameArt の録音（CC0・パブリックドメイン）',
    lbl: { off: '刺す', bite: '刺す', rest: 'とまる', leave: '飛び立つ' },
    again: 'もう一晩', save: '画像を保存', post: 'Xでポスト', toTitle: 'タイトルへ',
    resume: '続ける', quit: 'やめる', paused: '一時停止',
    tut: {
      moveTouch: '左下のスティックで飛ぶ', movePC: 'WASD で飛ぶ・ドラッグで見回す',
      find: '足や腕の光る所へ', biteTouch: '光ったら右下で刺す', bitePC: '光ったら E で刺す',
      leave: 'もう一回押すと飛び立つ', rest: '重い。壁にとまって消化',
    },
    say: {
      hairy: '毛で届かない', full: 'もう入らない', dry: 'もう吸えない。次へ', smoke: 'げほっ', wind: 'うわっ風',
      lightOn: '電気ついた', dawn: '夜明け',
    },
    death: { slap: 'ぺちっ', uchiwa: 'ばしっ', spray: 'しゅー', smoke: 'ぽとっ', cat: 'にゃっ' },
    deathNote: { slap: '手のひらで仕留められた', uchiwa: 'うちわで叩き落とされた', spray: '殺虫スプレーで落ちた', smoke: '蚊取り線香の煙で落ちた', cat: '猫パンチをくらった' },
    report: {
      head: 'かゆみ報告書', date: '8月14日 朝5時', blood: '吸った血', bites: '刺した数', where: '刺した場所',
      alive: '朝まで生きのびた', none: 'なし', mg: 'mg', ka: 'か所', wall: '壁のシミ',
    },
    ranks: ['ただの羽音', 'ちょい吸い', '一晩の常連', '一家のかゆみ担当', '伝説の夏の蚊'],
    postText: (r) => `夏の夜の蚊で ${r.mg}mg 吸って ${r.bites}か所刺した。判定「${r.rank}」`,
    tags: '#夏の夜の蚊 #バカゲー',
  },
  en: {
    title: 'Summer Night Mosquito', sub: 'You are a mosquito. Drink the sleeping family\'s blood. Buzz by their ears and a hand comes flying.',
    start: 'Fly into the night', howBtn: 'How to play', lang: '日本語', more: 'More silly games', soundOn: 'Sound on', soundOff: 'Muted',
    loading: 'Waiting for the family to fall asleep', loadingDone: 'Everyone is asleep',
    howTitle: 'How to play',
    how: [
      'You are a mosquito. From 11 PM to 5 AM, drink the sleeping family\'s blood.',
      'Bare skin glows when you can bite. Your belly grows red and heavy. Rest on a wall or ceiling to digest.',
      'Buzzing near an ear wakes people. Watch for tossing, sleep talk and frowns. Awake people swat.',
      'Coil smoke knocks you out. The fan blows you away.',
    ],
    keysPC: [['WASD', 'Fly'], ['Space / Shift', 'Up / Down'], ['Drag', 'Look'], ['E', 'Bite / take off']],
    keysTouch: [['Bottom-left circle', 'Fly where you look'], ['Wings', 'Up / Down'], ['Bottom right', 'Bite / take off'], ['Drag right side', 'Look']],
    ok: 'Got it',
    credit: 'Characters Kenney (CC0) / Sounds: recordings from Wikimedia Commons and OpenGameArt (CC0, public domain)',
    lbl: { off: 'Bite', bite: 'Bite', rest: 'Land', leave: 'Take off' },
    again: 'Another night', save: 'Save image', post: 'Post on X', toTitle: 'Title',
    resume: 'Resume', quit: 'Quit', paused: 'Paused',
    tut: {
      moveTouch: 'Fly with the stick', movePC: 'WASD to fly, drag to look',
      find: 'Find glowing skin', biteTouch: 'Glowing? Tap bite', bitePC: 'Glowing? Press E',
      leave: 'Press again to take off', rest: 'Too heavy. Rest on a wall',
    },
    say: {
      hairy: 'Too hairy', full: 'Belly is full', dry: 'Dry. Find another spot', smoke: 'Cough', wind: 'Whoa, wind',
      lightOn: 'Lights on', dawn: 'Dawn',
    },
    death: { slap: 'SLAP', uchiwa: 'WHACK', spray: 'PSSHH', smoke: 'PLOP', cat: 'MEOW' },
    deathNote: { slap: 'Swatted by a palm', uchiwa: 'Knocked down by a fan', spray: 'Bug spray got you', smoke: 'Fell in the coil smoke', cat: 'Cat punch' },
    report: {
      head: 'Itch Report', date: 'Aug 14, 5 AM', blood: 'Blood', bites: 'Bites', where: 'Where',
      alive: 'Survived till morning', none: 'none', mg: 'mg', ka: '', wall: 'Wall stain',
    },
    ranks: ['Just a buzz', 'A little sip', 'Regular visitor', 'Family itch officer', 'Legendary summer mosquito'],
    postText: (r) => `Summer Night Mosquito: drank ${r.mg}mg, ${r.bites} bites. Rank "${r.rank}"`,
    tags: '#SummerNightMosquito',
  },
}

// 家族。寝る場所・寝つきの深さ・寝言・朝の一言
// sens: 羽音への敏感さ（大きいほど起きやすい）。wake: 起きた時にやること
window.NM_FAMILY = {
  dad: {
    name: { ja: '父', en: 'Dad' }, file: 'male-d', scale: 1.6, sens: 0.75, wake: 'slap',
    talk: {
      ja: ['部長…それは経費です…', 'あと5分…いや5年…', '唐揚げにレモン…かけたん誰や…', 'ボーナス…ボーナス…', 'わしの…プリン…', 'その企画…通りまぁす…'],
      en: ['Boss... it\'s a business expense...', 'Five more minutes... no, years...', 'Who put lemon... on my karaage...', 'Bonus... bonus...', 'My... pudding...', 'Proposal... approved...'],
    },
    react: { ja: ['ん…？', 'なんや…', 'ぶーんて…'], en: ['Hm...?', 'What...', 'That buzz...'] },
  },
  mom: {
    name: { ja: '母', en: 'Mom' }, file: 'female-d', scale: 1.5, sens: 1.35, wake: 'uchiwa',
    talk: {
      ja: ['ガス…消したっけ…', '冷蔵庫のプリン…名前書いたのに…', 'お父さん…いびき…', '特売…卵…お一人様…'],
      en: ['Did I... turn off the gas...', 'My pudding... had my name on it...', 'Honey... snoring...', 'Eggs on sale... one per person...'],
    },
    react: { ja: ['…蚊？', 'ちょっと…', 'いる。絶対いる'], en: ['...a mosquito?', 'Ugh...', 'It\'s here. I know it'] },
  },
  kid: {
    name: { ja: 'たろう', en: 'Taro' }, file: 'male-f', scale: 1.1, sens: 0.6, wake: 'flail', roll: true,
    talk: {
      ja: ['カブトムシ…でっか…', 'ぼくが…キャプテン…', '宿題は…犬が…', 'おかわり…', 'うんこ…でた…'],
      en: ['Beetle... so big...', 'I\'m... the captain...', 'The dog... ate my homework...', 'Seconds please...', 'Pooped...'],
    },
    react: { ja: ['むにゃ', 'やめろー', 'えいっ'], en: ['Mmph', 'Stoppit', 'Hyah'] },
  },
  gramps: {
    name: { ja: 'じいちゃん', en: 'Grandpa' }, file: 'male-b', scale: 1.5, sens: 0.45, wake: 'spray', rare: true,
    talk: {
      ja: ['ふがふが…', 'ばあさんや…メシは…', 'わしの歯…どこや…', '昭和の蚊は…もっと…', 'ふが…'],
      en: ['Fuga fuga...', 'Dear... is dinner...', 'Where... are my teeth...', 'Back in my day... mosquitoes...', 'Fuga...'],
    },
    react: { ja: ['ふが？', 'なんじゃ', 'スプレーどこや'], en: ['Fuga?', 'What now', 'Where\'s the spray'] },
  },
}

// 朝の一言（刺された数で変わる）
window.NM_MORNING = {
  dad: { ja: ['よう寝たわ', 'なんか足かゆいな', 'おでこに出来てる…会議あるのに', '全身かゆい。今日休む'], en: ['Slept great', 'My leg itches', 'One on my forehead... I have a meeting', 'Itchy all over. Calling in sick'] },
  mom: { ja: ['網戸ちゃんと閉めてよ', '1か所だけ。許さない', '私ばっかり刺されてる', '今夜は全部屋スプレー'], en: ['Close the screen door', 'Just one. Unforgivable', 'Why always me', 'Spraying every room tonight'] },
  kid: { ja: ['刺されてない！', '見て！ぷっくり！', '学校で自慢する', 'かゆいけど強くなった気がする'], en: ['No bites!', 'Look! A bump!', 'Showing it off at school', 'Itchy but I feel stronger'] },
  gramps: { ja: ['年寄りの血はまずいんか', 'ふが（かゆい）', '昭和の蚊のほうが強かった', '入れ歯がかゆい'], en: ['Is old blood not tasty?', 'Fuga (itchy)', 'Mosquitoes were tougher back then', 'My dentures itch'] },
  cat: { ja: ['にゃーん（見てたぞ）'], en: ['Meow (I saw you)'] },
}
