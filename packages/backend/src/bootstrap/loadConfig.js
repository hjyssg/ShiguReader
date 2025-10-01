const fs = require('fs');
const path = require('path');
const ini = require('ini');

const { normalizeEtcConfig, normalizePathConfig } = require('../config/config-schema');

const ensureConfigFile = (configPath, logger) => {
    if (fs.existsSync(configPath)) {
        return;
    }

    const templatePath = `${configPath}.example`;
    if (!fs.existsSync(templatePath)) {
        logger?.warn?.(`[config] 未找到 ${configPath}，且缺少模板 ${templatePath}`);
        return;
    }

    const targetDir = path.dirname(configPath);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(templatePath, configPath);
    logger?.info?.(`[config] 已从模板生成 ${path.basename(configPath)}`);
};

function loadConfig({ etcConfigPath, pathConfigPath, logger }) {
    ensureConfigFile(etcConfigPath, logger);
    ensureConfigFile(pathConfigPath, logger);

    let etcConfigRaw = {};
    let pathConfigRaw = {};

    try {
        const etcContent = fs.readFileSync(etcConfigPath, 'utf-8');
        etcConfigRaw = ini.parse(etcContent);
    } catch (error) {
        logger?.warn?.('fail to read ini files');
        logger?.warn?.(error);
    }

    try {
        const pathContent = fs.readFileSync(pathConfigPath, 'utf-8');
        pathConfigRaw = ini.parse(pathContent);
    } catch (error) {
        logger?.warn?.('fail to read path config');
        logger?.warn?.(error);
    }

    const etcResult = normalizeEtcConfig(etcConfigRaw);
    const pathResult = normalizePathConfig(pathConfigRaw);

    return {
        etcConfig: etcResult.config,
        pathConfig: pathResult.config,
        warnings: [...etcResult.warnings, ...pathResult.warnings],
        errors: [...etcResult.errors, ...pathResult.errors],
    };
}

module.exports = loadConfig;
