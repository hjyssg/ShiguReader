/** 计算对特定作者/tag的喜欢程度的分值 */
const getScoreFromCount = module.exports.getScoreFromCount = ({ good_count=0, bad_count=0, total_count=0 }, goodDump) => {
    console.assert(good_count >= 0 && bad_count >= 0);
    console.assert(total_count >= 0 && total_count >= (good_count + bad_count));
    goodDump = goodDump || 100;

    // 写一个数学函数，当x逼近正无穷，y逼近1。要使保证x从0到100的范围内，y尽量均匀分布。超过100开始逼近1
    // 超过的部分， 超过的部分极小的加权
    // y区间约是0到2
    function f1(x, ceil) {
        ceil = ceil || goodDump; // fault value

        const a = Math.log((ceil+1)/ceil);
        if (x <= ceil) {
            return 1 - Math.exp(-a * x);
        } else {
            //阻尼过强，会导致一直垃圾小tag因为比例排前
            //太弱，又没啥效果。
            const above = (x - ceil);
            return 1 + f1(above, ceil + 5000);
        }
    }

    function f2(x){
        // 用Math.floor进行离散区间处理
        // +1 避免无穷
        return Math.floor(x/3) *3 + 1;
    }

    let result = 0;
    if(good_count == 0 && bad_count == 0){
        // 啥都没有，纯中性
        result = 0;
    }else if(good_count == 0 && bad_count > 0){
        // 区间是负数
        // 虽然bad，但数量多的话，给分高点。 
        // 虽然不喜欢，到时下载得多。还是有点好感的概念
        result = -1/f2(total_count);
    }else {
        const g = good_count;
        const b = f2(bad_count);
        // 既看比例，
        const ratio = g / (g + b);
        // 也看绝对值
        const absV1 = f1(g);
        const absV2 = f1(total_count - g - b);
        // 最终区间落在0~4
        result = ratio +  absV1 + absV2;
    }

    return Number(result.toFixed(3));
}  