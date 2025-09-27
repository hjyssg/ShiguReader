import Checkbox from "@components/common/Checkbox";
import React, { useEffect, useState } from "react";
import '@styles/FilterPanel.scss';

const FilterPanel = ({
    title,
    items = [],
    onToggle,
    onSelectAll,
    onDeselectAll,
    className
}) => {
    if (!items || items.length === 0) {
        return null;
    }

    const selectAllLabel = "Select All";
    const deselectAllLabel = "Deselect All";
    const checkboxContainerClassName="type-checkboxes"
    const actionsClassName="type-panel-actions"

    const [isExpanded, setIsExpanded] = useState(false);

    const panelClassName = ["filter-panel", className].filter(Boolean).join(" ");
    const checkboxClassName = ["filter-panel-checkboxes", checkboxContainerClassName]
        .filter(Boolean)
        .join(" ");

    const allSelected = items.every(item => item && !!item.checked);
    const canDeselectAll = allSelected && typeof onDeselectAll === "function";
    const canSelectAll = !allSelected && typeof onSelectAll === "function";
    const actionsClass = ["filter-panel-actions", actionsClassName]
        .filter(Boolean)
        .join(" ");

    const maxVisibleWhenCollapsed = 5;
    const canCollapse = items.length > maxVisibleWhenCollapsed;
    const displayedItems = canCollapse && !isExpanded
        ? items.slice(0, maxVisibleWhenCollapsed)
        : items;

    const renderActionButton = () => {
        if (canDeselectAll) {
            return (
                <button
                    type="button"
                    className="sb-pill"
                    onClick={onDeselectAll}
                >
                    <i className="far fa-square" aria-hidden="true"></i>
                    <span>{deselectAllLabel}</span>
                </button>
            );
        }

        if (canSelectAll) {
            return (
                <button
                    type="button"
                    className="sb-pill"
                    onClick={onSelectAll}
                >
                    <i className="fas fa-check-double" aria-hidden="true"></i>
                    <span>{selectAllLabel}</span>
                </button>
            );
        }

        return null;
    };

    const toggleButton = canCollapse && (
        <button
            type="button"
            className="btn btn-sm btn-light filter-panel-toggle-button"
            onClick={() => setIsExpanded(prev => !prev)}
        >
           <div className="inner">{isExpanded ? "Show Less" : "..."}</div> 
        </button>
    );

    return (
        <div className={panelClassName}>
            {title && (
                <div className="panel-title">
                    {title}
                </div>
            )}
            <div className={checkboxClassName}>
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
                {toggleButton}
            </div>
            {(canDeselectAll || canSelectAll) && (
                <div className={actionsClass}>
                    {renderActionButton()}
                </div>
            )}
        </div>
    );
};

export default FilterPanel;
