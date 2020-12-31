const assert = require('assert');
const parser = require("../name-parser");


describe('name parser', () => {
    let s1;
    let result;
    it('trim test', ()=> {

        s1 = null;
        result = parser.parse(s1);
        assert.ok(!result);

        s1 = "no thing";
        result = parser.parse(s1);
        assert.ok(!result);

        s1 = "[真珠貝] apple .zip";
        result = parser.parse(s1);
        assert.equal(result.author, "真珠貝");
        assert.deepEqual(result.tags, []);

        s1 = "[真珠貝]apple  .zip";
        result = parser.parse(s1);
        assert.equal(result.author, "真珠貝");
        assert.deepEqual(result.tags, []);

        s1 = "[真珠貝]apple.zip";
        result = parser.parse(s1);
        assert.equal(result.author, "真珠貝");
        assert.deepEqual(result.tags, []);
    });

    it("find with group name and tag", () => {

        s1 = "(DOUJIN)(C82) [真珠貝 (武田弘光)] apple (cake).zip";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(), [ "DOUJIN", "cake"].sort());
        assert.equal(result.author, "武田弘光");
        assert.equal(result.comiket, "C82")

        s1 = "(DOUJIN)(C82)[真珠貝(武田弘光)]apple(cake).zip";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(), [ "DOUJIN", "cake"].sort());
        assert.equal(result.author, "武田弘光");

        s1 = "(COMIC1☆9) [橘花屋 (上杉響士郎, 榊ゆいの)] すみません。 (アイドルマスター シンデレラガールズ).zip";
        result = parser.parse(s1);
        assert.equal(result.author, "上杉響士郎, 榊ゆいの");
        assert.deepEqual(result.authors, ["上杉響士郎", "榊ゆいの"]);
        assert.deepEqual(result.tags, [ "アイドルマスター シンデレラガールズ"]);
        assert.equal(result.comiket, "COMIC1☆9")
    })


    it("find name with year tag", ()=>{
        s1 = "[150622](COMIC1☆9) [橘花屋 (上杉響士郎, 榊ゆいの)] すみません。 (アイドルマスター シンデレラガールズ).zip";
        result = parser.parse(s1);
        assert.equal(result.dateTag, "150622");
    })

    it("find author name", ()=>{
        s1 = "(同人ゲームCG) [170428] [ピンポイント] 王女&女騎士Wド下品露出 ～恥辱の見世物奴隷～";
        result = parser.parse(s1);
        assert.equal(result.author, "ピンポイント");

        s1 = "(ゲームCG) [181207] [DWARFSOFT] ムチムチデカパイマラ喰い魔王様とおんぼろ四畳半同棲生活";
        result = parser.parse(s1);
        assert.equal(result.author, "DWARFSOFT");

        s1 = "(一般コミック) [白正男×山戸大輔] テコンダー朴 第01巻-第02巻";
        result = parser.parse(s1);
        assert.equal(result.author, "白正男×山戸大輔");

        s1 = "(画集) [山戸大輔] うりぼうざっか店 テーマ別画集第3弾「りとるもんすたぁ～」";
        result = parser.parse(s1);
        assert.equal(result.author, "山戸大輔");
    });

    it("tag converter", ()=>{
        s1 = "[桃井涼太] 艦隊これくしょん -艦これ- 4コマコミック 吹雪、がんばります! Vol.1(艦隊これくしょん) [Digital].zip";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(),["艦これ", "吹雪"].sort());

        s2 = "[桃井涼太] 艦隊これくしょん -艦これ- 4コマコミック 吹雪、がんばります! Vol.1(艦これ) [Digital].zip";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(),["艦これ", "吹雪"].sort());

        s3 = "[Pixel Cot. (羽原メグル)] こおりのせかい (艦隊これくしょん-艦これ-) (1).zip";
        result = parser.parse(s3);
        assert.deepEqual(result.tags.sort(),["艦これ"].sort());   
    })   

    
    it("tag time calculation", ()=>{
        const C96T = parser.getDateFromParse("(C96)[ fake_author ] apple").getTime();
        const C95T = parser.getDateFromParse("(C95)[ fake_author ] apple").getTime();
        const C94T = parser.getDateFromParse("(C94)[ fake_author ] apple").getTime();
        const C92T = parser.getDateFromParse("(C92)[ fake_author ] apple").getTime();
        const C91T = parser.getDateFromParse("(C91)[ fake_author ] apple").getTime();
        const C87T = parser.getDateFromParse("(C87)[ fake_author ] apple").getTime();
        const C85T = parser.getDateFromParse("(C85)[ fake_author ] apple").getTime();
        const C84T = parser.getDateFromParse("(C84)[ fake_author ] apple").getTime();
        const C72T = parser.getDateFromParse("(C72)[ fake_author ] apple").getTime();

        assert(C96T > C95T);
        assert(C95T > C91T);
        assert(C95T > C94T);
        assert(C94T > C92T);
        assert(C92T > C91T);
        assert(C91T > C87T);
        assert(C85T > C84T);
        assert(C84T > C72T);

        const air2 = parser.getDateFromParse("(エアコミケ2) [ちんちん亭 (chin)] 12132").getTime();
        assert(air2 > C96T);
    })

    it("test etc", ()=>{
        let temp = parser.parse("(C89) (同人誌) [にのこや] MAKIPET3 (ラブライブ!)");
        assert.deepEqual(temp.authors, ["にのこや"])
        assert.deepEqual(temp.tags, ["同人誌", "ラブライブ!"])
    
        //重要 tag转换！
        temp = parser.parse("(C80) (同人誌) [サークルARE] 唯ちゃんが俺のファミレスでバイトすることになった件 (K-ON!)");
        assert.deepEqual(temp.tags, ["同人誌", "けいおん"])
    
        // when no author
        temp = parser.parse("唯ちゃんが俺のファミレスでバイトすることになった件 (K-ON!)");
        assert.deepEqual(temp.tags, ["けいおん"])
        assert.deepEqual(temp.authors, [])
    })


    it("isHighlySimilar", ()=>{
        assert(parser.isHighlySimilar("tozanbu", "tozan:bu"))
        assert(parser.isHighlySimilar("tobu", "to:bu"))
        assert(parser.isHighlySimilar("12ab", "12abc"))
        
        assert(parser.isHighlySimilar("時雨露出×野外2", "白露型時雨露出×野外2") === false);
        assert(parser.isHighlySimilar("12a", "13a") === false);
        assert(parser.isHighlySimilar("12", "ab") === false);
        
        //this one is difficult
        assert(parser.isHighlySimilar("サソワレマスター1", "サソワレマスター2") === false);
        assert(parser.isHighlySimilar("サソワレマスター2", "サソワレマスター3") === false);
        
    })

});
