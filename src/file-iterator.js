

const path = require('path');
const fs = require("fs");
const _ = require("underscore");

module.exports = function (folders, config) {
    const result = [];
    config.visited = {};
    folders.forEach((src) => {
        const stat = fs.statSync(src);
        if (stat.isFile()) {
            throw "only source folder path";
        } else {
            iterate(src, config, result, 0);
        }
    });
    delete config.visited;
    return result;
};

function isLegalDepth(depth, config) {
    if (_.has(config, "depth")) {
        return depth <= config.depth;
    }
    return true;
}

function iterate (p, config, result, depth) {
    if(config.visited[p]){
        return;
    }
    const stat = fs.statSync(p);
    try {
        if (stat.isFile()) {
            if (config && config.filter && !config.filter(p)) {
                return;
            }
            result.push(p);
        } else if (stat.isDirectory() && isLegalDepth(depth + 1, config)) {
            fs.readdirSync(p).forEach((e) => {
                e = path.join(p, e);
                iterate(e, config, result, depth + 1);
            });
        }
    } catch (e) {
        console.error(e);
    } finally{
        config.visited[p] = true;
    }
}
