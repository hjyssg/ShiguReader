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
        assert.deepEqual(result.tags.sort(), [ "DOUJIN", "C82", "真珠貝", "cake"].sort());
        assert.equal(result.author, "武田弘光");

        s1 = "(DOUJIN)(C82)[真珠貝(武田弘光)]apple(cake).zip";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(), [ "DOUJIN", "C82", "真珠貝", "cake"].sort());
        assert.equal(result.author, "武田弘光");

        s1 = "(COMIC1☆9) [橘花屋 (上杉響士郎, 榊ゆいの)] すみません。 (アイドルマスター シンデレラガールズ).zip";
        result = parser.parse(s1);
        assert.equal(result.author, "上杉響士郎, 榊ゆいの");
        assert.deepEqual(result.tags.sort(),["COMIC1☆9", "橘花屋", "アイドルマスター シンデレラガールズ"].sort());
    })


    it("find name with year tag", ()=>{
        s1 = "[150622](COMIC1☆9) [橘花屋 (上杉響士郎, 榊ゆいの)] すみません。 (アイドルマスター シンデレラガールズ).zip";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(),["150622", "COMIC1☆9", "橘花屋", "アイドルマスター シンデレラガールズ"].sort());
        assert.equal(result.author, "上杉響士郎, 榊ゆいの");
    })

    it("find name", ()=>{
        s1 = "(同人ゲームCG) [170428] [ピンポイント] 王女&女騎士Wド下品露出 ～恥辱の見世物奴隷～";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(),["同人ゲームCG", "170428"].sort());
        assert.equal(result.author, "ピンポイント");

        s1 = "(ゲームCG) [181207] [DWARFSOFT] ムチムチデカパイマラ喰い魔王様とおんぼろ四畳半同棲生活";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(),["ゲームCG", "181207"].sort());
        assert.equal(result.author, "DWARFSOFT");

        s1 = "(一般コミック) [白正男×山戸大輔] テコンダー朴 第01巻-第02巻";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(),["一般コミック"].sort());
        assert.equal(result.author, "白正男×山戸大輔");

        s1 = "(画集) [山戸大輔] うりぼうざっか店 テーマ別画集第3弾「りとるもんすたぁ～」";
        result = parser.parse(s1);
        assert.deepEqual(result.tags.sort(),["画集"].sort());
        assert.equal(result.author, "山戸大輔");
    })
});
