const assert = require('assert');
const picker = require("../human-name-picker");

describe('name picker', () => {
    let s1;
    let result;
    it('normal', ()=> {

        s1 = null;
        result = picker.pick(s1);
        assert.ok(result === null);

        s1 = "[LCBD-00601] Riho Iida 飯田里穂 – りほの島、楽園の光 Blu-ray";
        result = picker.pick(s1);
        assert.deepEqual(result,  ["飯田里穂"]);


        s1 = " 飯田里穂 – 沙月恵奈 IPX-551 口でするだけなら…浮気じゃないよね？ オンナの口は嘘をつく…口から始まる寝取られ話桃乃木かな";
        result = picker.pick(s1);
        assert.deepEqual(result,  ["飯田里穂", "沙月恵奈", "桃乃木かな"]);

        s1 = " [Ohys-Raws] Sono Bisque Doll wa Koi o Suru - 02 (AT-X 1280x720 x264 AAC) ";
        result = picker.pick(s1);
        assert.deepEqual(result,  null);
    });

});
