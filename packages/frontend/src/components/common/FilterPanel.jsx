import React, { useEffect, useMemo, useState } from "react";
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
    checkboxContainerClassName = "filter-panel-checkboxes",
    actionsClassName = "filter-panel-actions",
    maxVisibleWhenCollapsed
}) => {
    if (!items || items.length === 0) {
        return null;
    }

    const panelClassName = ["filter-panel", className].filter(Boolean).join(" ");
    const hasDeselected = items.some(item => item && !item.checked);
    const [isExpanded, setIsExpanded] = useState(false);
    const collapsedCount = useMemo(() => {
        if (Number.isInteger(maxVisibleWhenCollapsed) && maxVisibleWhenCollapsed > 0) {
            return maxVisibleWhenCollapsed;
        }
        return 5;
    }, [maxVisibleWhenCollapsed]);

    const shouldCollapse = items.length > collapsedCount;

    const displayedItems = useMemo(() => {
        if (!shouldCollapse || isExpanded) {
            return items;
        }
        return items.slice(0, collapsedCount);
    }, [collapsedCount, isExpanded, items, shouldCollapse]);

    useEffect(() => {
        setIsExpanded(false);
    }, [items, collapsedCount]);

    const showReset = onReset && hasDeselected;
    const showSelectNone = typeof onSelectNone === "function";
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
            <div
                className={checkboxContainerClassName}
            >
                {displayedItems.map(item => (
                    <Checkbox
                        key={item.value}
                        checked={!!item.checked}
                        onChange={() => onToggle && onToggle(item.value)}
                        title={item.label}
                    >
                        {item.label}
                    </Checkbox>
                ))}
                {shouldCollapse && toggleButton}
            </div>
            {showActions && (
                <div className={actionsClassName}>
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
