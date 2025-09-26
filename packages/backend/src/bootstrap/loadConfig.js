const fs = require('fs');
const ini = require('ini');

function loadConfig({ etcConfigPath, pathConfigPath, logger }) {
    let etcConfig = {};
    let pathConfig;
    try {
        const etcContent = fs.readFileSync(etcConfigPath, 'utf-8');
        etcConfig = ini.parse(etcContent);
    } catch (error) {
        logger?.warn?.("fail to read ini files");
        logger?.warn?.(error);
    }

    try {
        const pathContent = fs.readFileSync(pathConfigPath, 'utf-8');
        pathConfig = ini.parse(pathContent);
    } catch (error) {
        logger?.warn?.("fail to read path config");
        logger?.warn?.(error);
    }

    return { etcConfig, pathConfig };
}

module.exports = loadConfig;
