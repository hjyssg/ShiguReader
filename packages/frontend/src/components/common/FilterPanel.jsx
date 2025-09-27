import React from "react";
import Checkbox from "@components/common/Checkbox";

const FilterPanel = ({
    title,
    items = [],
    onToggle,
    onReset,
    resetLabel = "Reset",
    className,
    checkboxContainerClassName = "filter-panel-checkboxes",
    actionsClassName = "filter-panel-actions"
}) => {
    if (!items || items.length === 0) {
        return null;
    }

    const panelClassName = ["filter-panel", className].filter(Boolean).join(" ");
    const hasDeselected = items.some(item => item && !item.checked);

    return (
        <div className={panelClassName}>
            {title && (
                <div className="panel-title">
                    {title}
                </div>
            )}
            <div className={checkboxContainerClassName}>
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
            {onReset && hasDeselected && (
                <div className={actionsClassName}>
                    <button
                        type="button"
                        className="btn btn-sm btn-light"
                        onClick={onReset}
                    >
                        {resetLabel}
                    </button>
                </div>
            )}
        </div>
    );
};

export default FilterPanel;
