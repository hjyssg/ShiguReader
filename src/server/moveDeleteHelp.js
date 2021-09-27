const isWindows = require('is-windows');
const execa = require('./own_execa');

module.exports.move = async function (src, dest) {
    const cmdStr = isWindows() ? "move" : "mv";
    const { stdout, stderr } = await execa(cmdStr, [src, dest]);
    return { stdout, stderr };
}

module.exports.trash = async function (src, dest) {
    const trash = require('trash');
    await trash([src]);
}
