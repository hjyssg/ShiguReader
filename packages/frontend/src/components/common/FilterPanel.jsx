import React, { useEffect, useState } from "react";
import Checkbox from "@components/common/Checkbox";

const FilterPanel = ({
    title,
    items = [],
    onToggle,
    onReset,
    onSelectNone,
    resetLabel = "Reset",
    selectNoneLabel = "Deselect All",
    className,
    maxVisibleWhenCollapsed
}) => {
    if (items.length === 0) {
        return null;
    }

    const panelClassName = ["filter-panel", className].filter(Boolean).join(" ");
    const hasDeselected = items.some(item => !item.checked);
    const [isExpanded, setIsExpanded] = useState(false);
    const collapsedCount = maxVisibleWhenCollapsed > 0 ? maxVisibleWhenCollapsed : 5;

    const shouldCollapse = items.length > collapsedCount;

    const displayedItems = !shouldCollapse || isExpanded
        ? items
        : items.slice(0, collapsedCount);

    useEffect(() => {
        setIsExpanded(false);
    }, [items, collapsedCount]);

    const showReset = onReset && hasDeselected;
    const showSelectNone = !!onSelectNone;
    const showActions = showReset || showSelectNone;
    const showToggle = shouldCollapse;

    const toggleButton = showToggle && (
        <button
            type="button"
            className="btn btn-sm btn-light filter-panel-toggle-button"
            onClick={() => setIsExpanded(prev => !prev)}
        >
            {isExpanded ? "Show Less" : "..."}
        </button>
    );

    return (
        <div className={panelClassName}>
            {title && (
                <div className="panel-title">
                    {title}
                </div>
            )}
            <div className="filter-panel-checkboxes">
                {displayedItems.map(item => (
                    <Checkbox
                        key={item.value}
                        checked={!!item.checked}
                        onChange={() => onToggle?.(item.value)}
                        title={item.label}
                    >
                        {item.label}
                    </Checkbox>
                ))}
                {shouldCollapse && toggleButton}
            </div>
            {showActions && (
                <div className="filter-panel-actions">
                    {showSelectNone && (
                        <button
                            type="button"
                            className="btn btn-sm btn-light"
                            onClick={onSelectNone}
                        >
                            {selectNoneLabel}
                        </button>
                    )}
                    {showReset && (
                        <button
                            type="button"
                            className="btn btn-sm btn-light"
                            onClick={onReset}
                        >
                            {resetLabel}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default FilterPanel;
