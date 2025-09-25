import React from 'react';
import '../style/SortHeader.scss';

const KEY_CONFIG = {
    time: { label: 'Time', icon: '🕒', group: '时间', title: '创建时间' },
    mtime: { label: 'Mtime', icon: '📅', group: '时间', title: '修改时间' },
    'last read time': { label: 'Last Read', icon: '📖', group: '时间', title: '最近阅读' },
    'read count': { label: 'Read Count', icon: '📚', group: '时间', title: '阅读次数' },
    'by latest work': { label: 'Latest Work', icon: '🆕', group: '时间', title: '最新作品' },
    'file size': { label: 'File Size', icon: '📁', group: '文件' },
    'avg page size': { label: 'Avg Page', icon: '📐', group: '文件' },
    'page num': { label: 'Page Num', icon: '📄', group: '文件' },
    'file number': { label: 'File Count', icon: '🔢', group: '文件' },
    filename: { label: 'Filename', icon: '🔤', group: '文件' },
    'tag name': { label: 'Tag Name', icon: '🏷️', group: '文件' },
    score: { label: 'Score', icon: '⭐', group: '文件' },
    random: { label: 'Random', icon: '🎲', group: '其他' },
    'by folder name': { label: 'Folder', icon: '🗂️', group: '文件' },
};

const DEFAULT_OPTIONS = {
    stickyFolders: false,
    naturalSort: true,
};

function getMeta(key) {
    if (!key && key !== 0) {
        return null;
    }
    const normalized = String(key).toLowerCase();
    const meta = KEY_CONFIG[normalized] || {};
    const label = meta.label || key;
    return {
        key,
        label,
        group: meta.group || '其他',
        icon: meta.icon || '⬤',
        title: meta.title,
    };
}

function useSortState({ sortOptions, selected, isSortAsc, options }) {
    const optionsKey = React.useMemo(() => sortOptions.join('|'), [sortOptions]);
    const initialKey = React.useMemo(() => {
        if (selected && sortOptions.includes(selected)) {
            return selected;
        }
        return sortOptions[0] || '';
    }, [selected, sortOptions, optionsKey]);

    const [state, setState] = React.useState({
        key: initialKey,
        order: isSortAsc ? 'asc' : 'desc',
        options: { ...DEFAULT_OPTIONS, ...options },
    });

    React.useEffect(() => {
        setState((prev) => ({
            key: initialKey || prev.key,
            order: isSortAsc ? 'asc' : 'desc',
            options: { ...DEFAULT_OPTIONS, ...options },
        }));
    }, [initialKey, isSortAsc, optionsKey, options]);

    return [state, setState];
}

export default function SortHeader({
    sortOptions = [],
    selected,
    isSortAsc = false,
    onChange,
    className,
    showOptions = false,
    options,
}) {
    const [state, setState] = useSortState({ sortOptions, selected, isSortAsc, options });

    const emit = React.useCallback(
        (next) => {
            setState(next);
            if (onChange) {
                onChange(next.key, next.order === 'asc', next);
            }
        },
        [onChange, setState],
    );

    const handleSelect = React.useCallback(
        (key) => {
            emit({
                key,
                order: key === state.key ? (state.order === 'asc' ? 'desc' : 'asc') : 'desc',
                options: state.options,
            });
        },
        [emit, state.key, state.options, state.order],
    );

    const toggleOrder = React.useCallback(() => {
        emit({ ...state, order: state.order === 'desc' ? 'asc' : 'desc' });
    }, [emit, state]);

    const setOption = React.useCallback(
        (key, value) => {
            emit({ ...state, options: { ...state.options, [key]: value } });
        },
        [emit, state],
    );

    const grouped = React.useMemo(() => {
        const map = new Map();
        const order = [];
        sortOptions.forEach((key) => {
            const meta = getMeta(key);
            if (!meta) {
                return;
            }
            if (!map.has(meta.group)) {
                map.set(meta.group, []);
                order.push(meta.group);
            }
            map.get(meta.group).push(meta);
        });
        return order.map((group) => ({ group, items: map.get(group) }));
    }, [sortOptions]);

    return (
        <div className={`sb-bar ${className || ''}`} role="toolbar" aria-label="Sorting bar">
            {grouped.map((section, index) => (
                <React.Fragment key={section.group}>
                    {index > 0 ? <div className="sb-divider" /> : null}
                    <Group label={section.group}>
                        {section.items.map((item) => (
                            <button
                                key={item.key}
                                className="sb-pill"
                                aria-pressed={state.key === item.key}
                                title={item.title}
                                onClick={() => handleSelect(item.key)}
                            >
                                <span style={{ opacity: 0.9 }}>{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </Group>
                </React.Fragment>
            ))}

            <div className="sb-right">
                <button className="sb-btn" aria-label="切换升降序" onClick={toggleOrder}>
                    <span>Order</span>
                    <span className={`sb-caret ${state.order === 'asc' ? 'up' : 'down'}`} aria-hidden="true" />
                    <span
                        style={{ opacity: 0.8, letterSpacing: '.04em', fontVariant: 'all-small-caps' }}
                    >
                        {state.order.toUpperCase()}
                    </span>
                </button>

                {showOptions ? (
                    <details className="sb-more">
                        <summary className="sb-btn">
                            <span>More</span>
                            <span style={{ opacity: 0.7 }}>▾</span>
                        </summary>
                        <div className="sb-menu">
                            <label className="sb-row">
                                <input
                                    type="checkbox"
                                    checked={!!state.options.stickyFolders}
                                    onChange={(e) => setOption('stickyFolders', e.currentTarget.checked)}
                                />
                                置顶文件夹
                            </label>
                            <label className="sb-row">
                                <input
                                    type="checkbox"
                                    checked={!!state.options.naturalSort}
                                    onChange={(e) => setOption('naturalSort', e.currentTarget.checked)}
                                />
                                自然排序 (1&lt;10&lt;100)
                            </label>
                        </div>
                    </details>
                ) : null}
            </div>
        </div>
    );
}

function Group({ label, children }) {
    return (
        <div className="sb-group" role="group" aria-label={label}>
            <span className="sb-label">{label}</span>
            {children}
        </div>
    );
}
