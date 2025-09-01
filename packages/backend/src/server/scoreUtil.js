
/**
 * 离散区间处理
 */
function discretizeToInterval(x){
    // 用Math.floor进行离散区间处理
    // +1 避免无穷
    return Math.floor(x/3) *3 + 1;
}


/**
 * 写一个数学函数，当x逼近正无穷，y逼近1。要使保证x从0到100的范围内，y尽量均匀分布。超过100开始逼近1。
 * 超过的部分，超过的部分极小的加权。
 * y区间约是0到2
 */
function approachOneWithDamping(x, ceil) {
    const a = Math.log((ceil+1)/ceil);
    if (x <= ceil) {
        return 1 - Math.exp(-a * x);
    } else {
        //阻尼过强，会导致一直垃圾小tag因为比例排前
        //太弱，又没啥效果。
        const above = (x - ceil);
        return 1 + approachOneWithDamping(above, ceil + 5000);
    }
}

/** 计算对特定作者/tag的喜欢程度的分值 */
module.exports.getScoreFromCount = ({ good_count=0, bad_count=0, total_count=0 }) => {
    console.assert(good_count >= 0 && bad_count >= 0);
    console.assert(total_count >= 0 && total_count >= (good_count + bad_count));
    const goodDump =  100;
    const other_count = total_count - good_count - bad_count;

    

    let result = 0;
    if(total_count == 0){
        return 0;
    } else if(good_count == 0 && other_count == 0 && bad_count > 0){
        // 区间是负数
        // result = -discretizeToInterval(total_count);
        return -approachOneWithDamping(bad_count, 3000);
    }else {
        const scale = 1.5;
        const ratio = good_count / (total_count) * scale;
        // 也看绝对值
        const absV1 = approachOneWithDamping(good_count, goodDump);
        const absV2 = approachOneWithDamping(other_count, goodDump);
        // 最终区间落在0~4
        result = ratio +  absV1 + absV2;
    }

    return result;
}  