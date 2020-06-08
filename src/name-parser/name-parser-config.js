module.exports.same_tags = [
    ["ラブライブ!サンシャイン!!", "ブライブ！ サンシャイン!!"],
    ["オリジナル", "Original"],
    ["東方Project","東方","Touhou Project"],
    ["アイドルマスター", "アイマス", "THE iDOLM@STER"],
    ["アイドルマスター シンデレラガールズ", "THE IDOLM@STER CINDERELLA GIRLS","アイドルマスターシンデレラガールズ"],
    ["アイドルマスター ミリオンライブ!","アイドルマスターミリオンライブ!"],
    ["アズールレーン","Azur Lane"],
    ["ガールズ&パンツァー","Girls und Panzer"],
];

module.exports.same_tag_regs_table = {
    "艦これ": [/艦これ/, /艦隊これくしょん/],
    "ラブライブ!" : [/Love Live/i, /ラブライブ/i],
    "プリンセスコネクト!Re:Dive": [/プリンセスコネクト.*Re.*Dive/i],
    "Fate⁄Grand Order": [/Fate.*Grand.*Order/i, /FGO/],
    "Fate⁄Stay Night": [/Fate.*Stay.*Night/i],
    "Fate⁄Zero": [/Fate.*Zero/i],
    "Fate/hollow ataraxia": [/Fate.*hollow.*at/i],
    "Fate/Extra": [/Fate.*Extra/i],
    "Fate/EXTELLA": [/Fate.*EXTELLA/i],
    "Fate/kaleid liner プリズマ☆イリヤ": [/Fate.*kaleid.*liner.*プリズマ.*イリヤ/i, /Fate.*kaleid.*liner/, /プリズマ.*イリヤ/ ]
}

module.exports.not_author_but_tag = [
    "同人音声",
    "アンソロジー",
    "DL版",
    "よろず",
    "成年コミック",
    "Pixiv",
    "アーティスト",
    "雑誌",
    "English",
    "320K"
]
