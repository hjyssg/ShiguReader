import React from 'react';
import '../../styles/SortHeader.scss';

const KEY_CONFIG = {
    time: { label: 'Time', icon: '🕒', group: 'Time', title: 'Created Time' },
    mtime: { label: 'Mtime', icon: '📅', group: 'Time', title: 'Modified Time' },
    'last read time': { label: 'Last Read Time', icon: '📖', group: 'Time', title: 'Last Read Time' },
    'read count': { label: 'Read Count', icon: '📚', group: 'Other', title: 'Read Count' },
    'by latest work': { label: 'Latest Work', icon: '🆕', group: 'Time', title: 'Latest Work' },
    'file size': { label: 'File Size', icon: '📁', group: 'File' },
    'avg page size': { label: 'Average Page Size', icon: '📐', group: 'File' },
    'page num': { label: 'Page Number', icon: '📄', group: 'File' },
    'file number': { label: 'File Count', icon: '🔢', group: 'File' },
    filename: { label: 'Filename', icon: '🔤', group: 'File' },
    'tag name': { label: 'Tag Name', icon: '🏷️', group: 'File' },
    score: { label: 'Score', icon: '⭐', group: 'Other' },
    random: { label: 'Random', icon: '🎲', group: 'Other' },
    'by folder name': { label: 'Folder', icon: '🗂️', group: 'File' },
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
        group: meta.group || 'Other',
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
            const groupKey = meta.group;
            if (!map.has(groupKey)) {
                map.set(groupKey, []);
                order.push(groupKey);
            }
            map.get(groupKey).push(meta);
        });
        return order.map((group) => ({ group, items: map.get(group) }));
    }, [sortOptions]);

    const { primarySections, otherSection } = React.useMemo(() => {
        const primary = [];
        const others = [];

        grouped.forEach((section) => {
            if (section.group.toLowerCase() === 'other') {
                others.push(section);
            } else {
                primary.push(section);
            }
        });

        const mergedOther = others.length
            ? {
                  group: 'Other',
                  items: others.flatMap((section) => section.items),
              }
            : null;

        return { primarySections: primary, otherSection: mergedOther };
    }, [grouped]);

    return (
        <div className={`sb-bar ${className || ''}`} role="toolbar" aria-label="Sorting bar">
            {primarySections.map((section) => (
                <div className="sb-row" key={section.group}>
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
                </div>
            ))}

            {(otherSection || showOptions) && (
                <div className="sb-row sb-row--controls">
                    {otherSection ? (
                        <Group label={otherSection.group}>
                            {otherSection.items.map((item) => (
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
                    ) : null}

                    {showOptions ? (
                        <details className="sb-more">
                            <summary className="sb-btn">
                                <span>More</span>
                                <span style={{ opacity: 0.7 }}>▾</span>
                            </summary>
                            <div className="sb-menu">
                                <label className="sb-row-option">
                                    <input
                                        type="checkbox"
                                        checked={!!state.options.stickyFolders}
                                        onChange={(e) => setOption('stickyFolders', e.currentTarget.checked)}
                                    />
                                    Pin folders to top
                                </label>
                                <label className="sb-row-option">
                                    <input
                                        type="checkbox"
                                        checked={!!state.options.naturalSort}
                                        onChange={(e) => setOption('naturalSort', e.currentTarget.checked)}
                                    />
                                    Natural sort (1&lt;10&lt;100)
                                </label>
                            </div>
                        </details>
                    ) : null}

                    <button
                        className="sb-btn sb-btn--order"
                        aria-label={`Toggle sort order (currently ${state.order === 'asc' ? 'ascending' : 'descending'})`}
                        onClick={toggleOrder}
                    >
                        <span className={`sb-arrow ${state.order === 'asc' ? 'up' : 'down'}`} aria-hidden="true" />
                    </button>
                </div>
            )}
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
