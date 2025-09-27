import React from "react";
import Checkbox from "@components/common/Checkbox";

const FilterPanel = ({
    title,
    items = [],
    onToggle,
    onSelectAll,
    onDeselectAll,
    selectAllLabel = "Select All",
    deselectAllLabel = "Deselect All",
    className,
    checkboxContainerClassName = "filter-panel-checkboxes",
    actionsClassName
}) => {
    if (!items || items.length === 0) {
        return null;
    }

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

    return (
        <div className={panelClassName}>
            {title && (
                <div className="panel-title">
                    {title}
                </div>
            )}
            <div className={checkboxClassName}>
                {items.map(item => (
                    <Checkbox
                        key={item.value}
                        checked={!!item.checked}
                        onChange={() => onToggle && onToggle(item.value)}
                        title={item.label}
                    >
                        {item.label}
                    </Checkbox>
                ))}
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
