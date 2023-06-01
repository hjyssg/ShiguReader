const assert = require("assert");
const parser = require("../name-parser");

describe("name parser", () => {
  let s1;
  let result;
  it("trim test", () => {
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

    s1 = "[真珠貝]apple  ";
    result = parser.parse(s1);
    assert.equal(result.author, "真珠貝");
    assert.deepEqual(result.tags, []);
  });

  it("find with group name and tag", () => {
    s1 = "(DOUJIN)(C82) [真珠貝 (武田弘光)] apple (cake).zip";
    result = parser.parse(s1);
    assert.deepEqual(result.tags.sort(), ["DOUJIN", "cake"].sort());
    assert.equal(result.author, "武田弘光");
    assert.equal(result.comiket, "C82");

    s1 = "(DOUJIN)(C82)[真珠貝(武田弘光)]apple(cake).zip";
    result = parser.parse(s1);
    assert.deepEqual(result.tags.sort(), ["DOUJIN", "cake"].sort());
    assert.equal(result.author, "武田弘光");

    s1 =
      "(COMIC1☆9) [橘花屋 (上杉響士郎, 榊ゆいの)] すみません。 (アイドルマスター シンデレラガールズ).zip";
    result = parser.parse(s1);
    assert.equal(result.author, "上杉響士郎, 榊ゆいの");
    assert.deepEqual(result.authors, ["上杉響士郎", "榊ゆいの"]);
    assert.deepEqual(result.tags, ["アイドルマスター シンデレラガールズ"]);
    assert.equal(result.comiket, "COMIC1☆9");
  });

  it("find name with year tag", () => {
    s1 =
      "[150622](COMIC1☆9) [橘花屋 (上杉響士郎, 榊ゆいの)] すみません。 (アイドルマスター シンデレラガールズ).zip";
    result = parser.parse(s1);
    assert.equal(result.dateTag, "150622");
  });

  it("find author name", () => {
    s1 =
      "(同人ゲームCG) [170428] [ピンポイント] 王女&女騎士Wド下品露出 ～恥辱の見世物奴隷～";
    result = parser.parse(s1);
    assert.equal(result.author, "ピンポイント");

    s1 =
      "(ゲームCG) [181207] [DWARFSOFT] ムチムチデカパイマラ喰い魔王様とおんぼろ四畳半同棲生活";
    result = parser.parse(s1);
    assert.equal(result.author, "DWARFSOFT");

    s1 = "(一般コミック) [白正男×山戸大輔] テコンダー朴 第01巻-第02巻";
    result = parser.parse(s1);
    assert.equal(result.author, "白正男×山戸大輔");

    s1 =
      "(画集) [山戸大輔] うりぼうざっか店 テーマ別画集第3弾「りとるもんすたぁ～」";
    result = parser.parse(s1);
    assert.equal(result.author, "山戸大輔");
  });

  it("tag converter", () => {
    s1 =
      "[桃井涼太] 艦隊これくしょん -艦これ- 4コマコミック 吹雪、がんばります! Vol.1(艦隊これくしょん) [Digital].zip";
    result = parser.parse(s1);
    assert.deepEqual(result.tags.sort(), ["艦これ"].sort());
    assert.deepEqual(result.charNames.sort(), ["吹雪"].sort());
    assert.deepEqual(result.rawTags.sort(), ["艦隊これくしょん"].sort());

    s2 =
      "[桃井涼太] 艦隊これくしょん -艦これ- 4コマコミック 吹雪、がんばります! Vol.1(艦これ) [Digital].zip";
    result = parser.parse(s1);
    assert.deepEqual(result.tags.sort(), ["艦これ"].sort());
    assert.deepEqual(result.charNames.sort(), ["吹雪"].sort());

    s3 =
      "[Pixel Cot. (羽原メグル)] こおりのせかい (艦隊これくしょん-艦これ-) (1).zip";
    result = parser.parse(s3);
    assert.deepEqual(result.tags.sort(), ["艦これ"].sort());
    assert.deepEqual(
      result.rawTags.sort(),
      ["艦隊これくしょん-艦これ-"].sort()
    );
  });

  it("tag time calculation", () => {
    const C96T = parser
      .getDateFromParse("(C96)[ fake_author ] apple")
      .getTime();
    const C95T = parser
      .getDateFromParse("(C95)[ fake_author ] apple")
      .getTime();
    const C94T = parser
      .getDateFromParse("(C94)[ fake_author ] apple")
      .getTime();
    const C92T = parser
      .getDateFromParse("(C92)[ fake_author ] apple")
      .getTime();
    const C91T = parser
      .getDateFromParse("(C91)[ fake_author ] apple")
      .getTime();
    const C87T = parser
      .getDateFromParse("(C87)[ fake_author ] apple")
      .getTime();
    const C85T = parser
      .getDateFromParse("(C85)[ fake_author ] apple")
      .getTime();
    const C84T = parser
      .getDateFromParse("(C84)[ fake_author ] apple")
      .getTime();
    const C72T = parser
      .getDateFromParse("(C72)[ fake_author ] apple")
      .getTime();

    assert(C96T > C95T);
    assert(C95T > C91T);
    assert(C95T > C94T);
    assert(C94T > C92T);
    assert(C92T > C91T);
    assert(C91T > C87T);
    assert(C85T > C84T);
    assert(C84T > C72T);

    const air2 = parser
      .getDateFromParse("(エアコミケ2) [ちんちん亭 (chin)] 12132")
      .getTime();
    assert(air2 > C96T);
  });

  it("test etc", () => {
    let temp = parser.parse("(C89) (同人誌) [にのこや] MAKIPET3 (ラブライブ!)");
    assert.deepEqual(temp.authors, ["にのこや"]);
    assert.deepEqual(temp.tags, ["ラブライブ!"]);

    //重要 tag转换！
    temp = parser.parse(
      "(C80) (同人誌) [サークルARE] 唯ちゃんが俺のファミレスでバイトすることになった件 (K-ON!)"
    );
    assert.deepEqual(temp.tags, ["けいおん"]);

    // when no author
    temp = parser.parse(
      "唯ちゃんが俺のファミレスでバイトすることになった件 (K-ON!)"
    );
    assert.deepEqual(temp.tags, ["けいおん"]);
    assert.deepEqual(temp.authors, []);
  });

  //----------------------对内部小function的测试--------------------------
  it("isHighlySimilar", () => {
    assert(parser.isHighlySimilar("tozanbu", "tozan:bu"));
    assert(parser.isHighlySimilar("tobu", "to:bu"));
    assert(parser.isHighlySimilar("12ab", "12abc"));

    assert(
      parser.isHighlySimilar("時雨露出×野外2", "白露型時雨露出×野外2") === false
    );
    assert(parser.isHighlySimilar("12a", "13a") === false);
    assert(parser.isHighlySimilar("12", "ab") === false);

    //this one is difficult
    assert(
      parser.isHighlySimilar("サソワレマスター1", "サソワレマスター2") === false
    );
    assert(
      parser.isHighlySimilar("サソワレマスター2", "サソワレマスター3") === false
    );
  });

  describe("isUselessTag", () => {
    it("should return true if the string has a useless tag", () => {
      assert.strictEqual(parser.isUselessTag("DL版"), true);
      assert.strictEqual(parser.isUselessTag("同人ソフト"), false);
      assert.strictEqual(parser.isUselessTag("修正版"), true);
      assert.strictEqual(parser.isUselessTag("エロ漫画"), true);
      assert.strictEqual(parser.isUselessTag("PNG"), true);

      assert.strictEqual(parser.isUselessTag("天気の子"), false);
      assert.strictEqual(parser.isUselessTag("ラブライブ"), false);
    });

    it("should be case-insensitive", () => {
      assert.strictEqual(
        parser.isUselessTag("DL版"),
        parser.isUselessTag("dl版")
      );
      assert.strictEqual(
        parser.isUselessTag("同人ゲーム"),
        parser.isUselessTag("同人GAME")
      );
    });

    it("should work with non-Japanese characters", () => {
      assert.strictEqual(parser.isUselessTag("digital"), true);
      assert.strictEqual(parser.isUselessTag("JPG"), true);
    });

    //  可以不休？
    // it("should not match substrings", () => {
    //   assert.strictEqual(parser.isUselessTag("ページ補足あり"), false);
    //   assert.strictEqual(parser.isUselessTag("進行中夏コミ新刊"), false);
    // });

    it("should allow certain tags despite matching the regex", () => {
      assert.strictEqual(parser.isUselessTag("ページ修正あり"), false);
      assert.strictEqual(parser.isUselessTag("C97"), false);
    });
  });

  describe("isMediaType", () => {
    it("should return true if the string contains a book type keyword", () => {
      assert.strictEqual(parser.isMediaType("同人CG集"), true);
      assert.strictEqual(parser.isMediaType("成年コミック"), true);
      assert.strictEqual(parser.isMediaType("イラスト集"), true);
      assert.strictEqual(parser.isMediaType("画集"), true);
      assert.strictEqual(parser.isMediaType("18禁ゲーム"), true);
      assert.strictEqual(parser.isMediaType("RPG"), false);
      assert.strictEqual(parser.isMediaType("CD"), false);
    });

    it("should be case-insensitive", () => {
      assert.strictEqual(
        parser.isMediaType("同人ゲーム"),
        parser.isMediaType("同人GAME")
      );
      assert.strictEqual(
        parser.isMediaType("一般コミック"),
        parser.isMediaType("一般漫画")
      );
    });

    it("should work with non-Japanese characters", () => {
      assert.strictEqual(parser.isMediaType("CG"), true);
      assert.strictEqual(parser.isMediaType("game"), true);

      assert.strictEqual(
        parser.isMediaType("The Idolmaster Cinderella Girls"),
        false
      );
    });
  });

  describe("getMediaType", () => {
    it("should return the book type keyword if present", () => {
      assert.strictEqual(
        parser.getMediaType("(一般コミック)[賀来ゆうじ] 地獄楽"),
        "一般コミック"
      );
      assert.strictEqual(
        parser.getMediaType("(同人誌) [おーと&みぃる] 欲しくなる"),
        "同人誌"
      );
      assert.strictEqual(
        parser.getMediaType("(成年コミック) [シヲリイタ] リベンジ"),
        "成年コミック"
      );
    });

    it("should return undefined if no book type keyword is present", () => {
      assert.strictEqual(
        parser.getMediaType(
          "[Airota][Tengoku Daimakyou][07][1080p AVC AAC][CHS]"
        ),
        undefined
      );
      assert.strictEqual(
        parser.getMediaType("Kaifuku Jutsushi no Yarinaoshi  vol 01-12"),
        undefined
      );
    });
  });

  describe("belongToEvent", () => {
    it("should return true if the string matches an event regex", () => {
      assert.strictEqual(parser.belongToEvent("C89"), true);
      assert.strictEqual(parser.belongToEvent("エアコミケ1"), true);
      assert.strictEqual(parser.belongToEvent("こみトレ100"), true);
      assert.strictEqual(parser.belongToEvent("ファータグランデ騎空祭"), true);
      assert.strictEqual(parser.belongToEvent("みみけっと4"), true);
    });

    it("should return false if the string does not match any event regex", () => {
      assert.strictEqual(parser.belongToEvent("同人CD"), false);
    });

    it("should be case-insensitive", () => {
      assert.strictEqual(
        parser.belongToEvent("c97"),
        parser.belongToEvent("C97")
      );
      assert.strictEqual(
        parser.belongToEvent("MiMiKeTTO 3"),
        parser.belongToEvent("みみけっと３")
      );
    });
  });

  describe("getDateFromStr", () => {
    it("should return a Date object if the string contains a valid date", () => {
      const dateStr = "2019年12月31日";
      const expectedDate = new Date(2019, 11, 31); // December is 11 because months are 0-indexed in JS
      assert.deepStrictEqual(parser.getDateFromStr(dateStr), expectedDate);

      assert.strictEqual(!!parser.getDateFromStr("20191231"), true);
      assert.strictEqual(!!parser.getDateFromStr("2020-01-01"), true);
      assert.strictEqual(!!parser.getDateFromStr("2020年02月30日"), true);

      assert.strictEqual(!!parser.getDateFromStr("2019年13月01日"), false);
      assert.strictEqual(!!parser.getDateFromStr("2019年20月01日"), false);
    });

    it("should return undefined if the string does not contain a valid date", () => {
      assert.strictEqual(parser.getDateFromStr("本"), undefined);
      assert.strictEqual(
        parser.getDateFromStr(" Kaifuku Jutsushi no Yarinaoshi  "),
        undefined
      );
    });
  });

  describe("editDistance", () => {
    it("should return the Levenshtein distance between two strings", () => {
      assert.strictEqual(parser.editDistance("kitten", "sitting"), 3);
      assert.strictEqual(parser.editDistance("book", "back"), 2);
      assert.strictEqual(parser.editDistance("comiket", "comic market"), 5);
      assert.strictEqual(parser.editDistance("abc", "xyz"), 3);

      // TODO：不确定
      //   assert.strictEqual(parser.editDistance("flower", "power"), 3);
    });

    it("should return 0 for identical strings", () => {
      const str = "test string";
      assert.strictEqual(parser.editDistance(str, str), 0);
    });
  });
});
