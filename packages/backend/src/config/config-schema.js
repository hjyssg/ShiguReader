const dedupe = (items) => {
    const seen = new Set();
    const result = [];
    for (const item of items) {
        if (!seen.has(item)) {
            seen.add(item);
            result.push(item);
        }
    }
    return result;
};

const getValue = (object, pathSegments) => {
    if (!object) {
        return undefined;
    }
    let current = object;
    for (const segment of pathSegments) {
        if (current == null || typeof current !== 'object') {
            return undefined;
        }
        current = current[segment];
    }
    return current;
};

const toArray = (value) => {
    if (Array.isArray(value)) {
        return value;
    }
    if (value === undefined || value === null) {
        return [];
    }
    return [value];
};

const sanitizeList = (value, label, warnings, errors) => {
    const normalized = [];
    const list = toArray(value);
    list.forEach((entry, index) => {
        if (entry === undefined || entry === null) {
            return;
        }
        if (typeof entry !== 'string') {
            errors.push(`${label} 的第 ${index + 1} 项应为字符串，实际为 ${typeof entry}`);
            return;
        }
        const trimmed = entry.trim();
        if (!trimmed) {
            warnings.push(`${label} 的第 ${index + 1} 项为空，已忽略。`);
            return;
        }
        normalized.push(trimmed);
    });
    return dedupe(normalized);
};

const collectValues = (source, paths) => {
    const values = [];
    paths.forEach((segments) => {
        const candidate = getValue(source, segments);
        if (candidate === undefined || candidate === null) {
            return;
        }
        if (Array.isArray(candidate)) {
            values.push(...candidate);
            return;
        }
        values.push(candidate);
    });
    return values;
};

const pickFirstString = (candidates, warnings, errors) => {
    for (const { path, label } of candidates) {
        const value = getValue(label.source, path);
        if (value === undefined || value === null) {
            continue;
        }
        if (typeof value !== 'string') {
            errors.push(`${label.name} 应为字符串，实际为 ${typeof value}`);
            continue;
        }
        return value.trim();
    }
    return '';
};

const normalizeEtcConfig = (rawConfig) => {
    const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const warnings = [];
    const errors = [];

    const security = {};
    const candidates = [
        { path: ['security', 'home_password'], label: { name: '[security].home_password', source } },
        { path: ['security', 'homePassword'], label: { name: '[security].homePassword', source } },
        { path: ['home_password'], label: { name: 'home_password', source } },
    ];

    let homePassword = '';
    for (const candidate of candidates) {
        const value = getValue(candidate.label.source, candidate.path);
        if (value === undefined || value === null) {
            continue;
        }
        if (typeof value !== 'string') {
            errors.push(`${candidate.label.name} 应为字符串，实际为 ${typeof value}`);
            continue;
        }
        homePassword = value.trim();
        break;
    }
    security.homePassword = homePassword;

    const config = {
        security,
        home_password: homePassword,
    };

    return { config, warnings, errors };
};

const normalizePathConfig = (rawConfig) => {
    const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const warnings = [];
    const errors = [];

    const config = {
        paths: {
            scan: [],
            quickAccess: [],
            moveTargets: [],
        },
        favorites: {
            goodRoot: '',
            notGoodRoot: '',
        },
    };

    config.paths.scan = sanitizeList(
        collectValues(source, [
            ['paths', 'scan'],
            ['paths', 'scan_folder_pathes'],
            ['scan'],
            ['scan_folder_pathes'],
        ]),
        'paths.scan',
        warnings,
        errors,
    );

    config.paths.quickAccess = sanitizeList(
        collectValues(source, [
            ['paths', 'quick_access'],
            ['paths', 'quickAccess'],
            ['quick_access'],
            ['quick_access_pathes'],
        ]),
        'paths.quick_access',
        warnings,
        errors,
    );

    config.paths.moveTargets = sanitizeList(
        collectValues(source, [
            ['paths', 'move_targets'],
            ['paths', 'moveTargets'],
            ['move_targets'],
            ['move_pathes'],
        ]),
        'paths.move_targets',
        warnings,
        errors,
    );

    const goodRoot = pickFirstString([
        { path: ['favorites', 'good_root'], label: { name: '[favorites].good_root', source } },
        { path: ['favorites', 'goodRoot'], label: { name: '[favorites].goodRoot', source } },
        { path: ['good_root'], label: { name: 'good_root', source } },
        { path: ['good_folder_root'], label: { name: 'good_folder_root', source } },
    ], warnings, errors);

    const notGoodRoot = pickFirstString([
        { path: ['favorites', 'not_good_root'], label: { name: '[favorites].not_good_root', source } },
        { path: ['favorites', 'notGoodRoot'], label: { name: '[favorites].notGoodRoot', source } },
        { path: ['not_good_root'], label: { name: 'not_good_root', source } },
        { path: ['not_good_folder_root'], label: { name: 'not_good_folder_root', source } },
    ], warnings, errors);

    config.favorites.goodRoot = goodRoot;
    config.favorites.notGoodRoot = notGoodRoot;

    config.scan_folder_pathes = config.paths.scan;
    config.quick_access_pathes = config.paths.quickAccess;
    config.move_pathes = config.paths.moveTargets;
    config.good_folder_root = goodRoot;
    config.not_good_folder_root = notGoodRoot;

    return { config, warnings, errors };
};

module.exports = {
    normalizeEtcConfig,
    normalizePathConfig,
};
