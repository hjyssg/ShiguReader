import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    const containerRef = useRef(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [collapsedHeight, setCollapsedHeight] = useState(null);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const shouldLimitByCount = Number.isInteger(maxVisibleWhenCollapsed) && maxVisibleWhenCollapsed > 0;

    const measureOverflow = useCallback(() => {
        if (shouldLimitByCount) {
            setCollapsedHeight(null);
            setIsOverflowing(false);
            return;
        }

        if (typeof window === "undefined") {
            setCollapsedHeight(null);
            setIsOverflowing(false);
            return;
        }
        const container = containerRef.current;
        if (!container) {
            setCollapsedHeight(null);
            setIsOverflowing(false);
            return;
        }

        const firstCheckbox = container.querySelector(".aji-checkbox");
        if (!firstCheckbox) {
            setCollapsedHeight(null);
            setIsOverflowing(false);
            return;
        }

        const styles = window.getComputedStyle(container);
        const rowGapValue = styles.rowGap || styles.gap || "0";
        const rowGap = parseFloat(rowGapValue) || 0;
        const checkboxHeight = firstCheckbox.getBoundingClientRect().height;
        if (!checkboxHeight) {
            setCollapsedHeight(null);
            setIsOverflowing(false);
            return;
        }

        const nextCollapsedHeight = checkboxHeight * 2 + rowGap;
        setCollapsedHeight(nextCollapsedHeight);
        const totalHeight = container.scrollHeight;
        setIsOverflowing(totalHeight - nextCollapsedHeight > 1);
    }, [shouldLimitByCount]);

    useEffect(() => {
        setIsExpanded(false);
        if (shouldLimitByCount) {
            return undefined;
        }
        if (typeof window === "undefined") {
            return undefined;
        }
        measureOverflow();
        window.addEventListener("resize", measureOverflow);
        return () => {
            window.removeEventListener("resize", measureOverflow);
        };
    }, [items, measureOverflow, shouldLimitByCount]);

    useEffect(() => {
        if (!isExpanded && !shouldLimitByCount) {
            measureOverflow();
        }
    }, [isExpanded, measureOverflow, shouldLimitByCount]);

    const containerStyle = useMemo(() => {
        if (shouldLimitByCount || isExpanded || !collapsedHeight) {
            return undefined;
        }
        return {
            maxHeight: collapsedHeight,
            overflow: "hidden"
        };
    }, [collapsedHeight, isExpanded, shouldLimitByCount]);

    const displayedItems = useMemo(() => {
        if (!shouldLimitByCount || isExpanded) {
            return items;
        }
        return items.slice(0, maxVisibleWhenCollapsed);
    }, [items, isExpanded, shouldLimitByCount, maxVisibleWhenCollapsed]);

    const showReset = onReset && hasDeselected;
    const showSelectNone = typeof onSelectNone === "function";
    const showActions = showReset || showSelectNone;
    const showToggle = shouldLimitByCount
        ? items.length > maxVisibleWhenCollapsed
        : isOverflowing;

    const toggleButton = showToggle && (
        <button
            type="button"
            className="btn btn-sm btn-light filter-panel-toggle-button"
            onClick={() => setIsExpanded(prev => !prev)}
        >
            {isExpanded ? "Show Less" : "Show More"}
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
                ref={containerRef}
                style={containerStyle}
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
                {shouldLimitByCount && toggleButton}
            </div>
            {!shouldLimitByCount && isOverflowing && (
                <div className="filter-panel-toggle">
                    {toggleButton}
                </div>
            )}
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
