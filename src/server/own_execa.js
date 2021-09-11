const _execa = require('execa');
const iconv = require('iconv-lite');


async function execa(cmd, option){
    if(global._cmd_encoding === 65001){
        let { stdout, stderr } = await _execa(cmd, option, { timeout: 60000 });
        return { stdout, stderr }
    }else{
        try{
            let { stdout, stderr } = await _execa(cmd, option, { timeout: 60000, encoding: null });
            // only support chinese os for now
            stdout = iconv.decode(stdout, 'gbk');
            stderr = iconv.decode(stderr, 'gbk');
            return { stdout, stderr }
        }catch (err) {
            err.stdout = iconv.decode(err.stdout, 'gbk');
            err.stderr = iconv.decode(err.stderr, 'gbk');
            throw err;
        }
  
    }
}


module.exports = execa;