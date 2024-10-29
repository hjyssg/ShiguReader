const execa = require('./own_execa');

module.exports.move = async function (src, dest) {
    const cmdStr = global.isWindows ? "move" : "mv";
    const { stdout, stderr } = await execa(cmdStr, [src, dest]);
    return { stdout, stderr };
}

module.exports.trash = async function (src) {
    const trash = await import('trash');
    await trash.default([src]);
}
