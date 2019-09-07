const assert = require('assert');
const parser = require("..//name-parser");

describe('name parser', () => {
    let s1;
    let result;
    it('trim test', ()=> {

        s1 = null;
        result = parser.parse(s1);
        assert.ok(result === null);

        s1 = "no thing";
        result = parser.parse(s1);
        assert.ok(result === null);

        s1 = "[真珠貝] apple  .zip";
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
        assert.deepEqual(result.tags.sort(), [ "DOUJIN", "C82", "cake"].sort());
        assert.equal(result.author, "武田弘光");

        s1 = "(DOUJIN)(C82)[真珠貝(武田弘光)]apple(cake).zip";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(), [ "DOUJIN", "C82", "cake"].sort());
        assert.equal(result.author, "武田弘光");

        s1 = "(COMIC1☆9) [橘花屋 (上杉響士郎, 榊ゆいの)] すみません。 (アイドルマスター シンデレラガールズ).zip";
        result = parser.parse(s1);
        assert.equal(result.author, "上杉響士郎, 榊ゆいの");
        assert.deepEqual(result.tags.sort(),["COMIC1☆9", "アイドルマスター シンデレラガールズ"].sort());
    })


    it("find name with year tag", ()=>{
        s1 = "[150622](COMIC1☆9) [橘花屋 (上杉響士郎, 榊ゆいの)] すみません。 (アイドルマスター シンデレラガールズ).zip";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(),["2015/06", "COMIC1☆9", "アイドルマスター シンデレラガールズ"].sort());
        assert.equal(result.author, "上杉響士郎, 榊ゆいの");
    })

    it("find author name", ()=>{
        s1 = "(同人ゲームCG) [170428] [ピンポイント] 王女&女騎士Wド下品露出 ～恥辱の見世物奴隷～";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(),["同人ゲームCG", "2017/04"].sort());
        assert.equal(result.author, "ピンポイント");

        s1 = "(ゲームCG) [181207] [DWARFSOFT] ムチムチデカパイマラ喰い魔王様とおんぼろ四畳半同棲生活";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(),["ゲームCG", "2018/12"].sort());
        assert.equal(result.author, "DWARFSOFT");

        s1 = "(一般コミック) [白正男×山戸大輔] テコンダー朴 第01巻-第02巻";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(),["一般コミック"].sort());
        assert.equal(result.author, "白正男×山戸大輔");

        s1 = "(画集) [山戸大輔] うりぼうざっか店 テーマ別画集第3弾「りとるもんすたぁ～」";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(),["画集"].sort());
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
        const C96T = parser.getDateFromTags(["C96"]).getTime();
        const C95T = parser.getDateFromTags(["C95"]).getTime();
        const C91T = parser.getDateFromTags(["C91"]).getTime();
        const C87T = parser.getDateFromTags(["C87"]).getTime();
        const C85T = parser.getDateFromTags(["C85"]).getTime();
        const C84T = parser.getDateFromTags(["C84"]).getTime();
        const C72T = parser.getDateFromTags(["C72"]).getTime();

        assert(C96T > C95T);
        assert(C95T > C91T);
        assert(C91T > C87T);
        assert(C85T > C84T);
        assert(C84T > C72T);
    })
});
