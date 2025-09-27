import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Checkbox from "@components/common/Checkbox";

const FilterPanel = ({
    title,
    items = [],
    onToggle,
    onReset,
    onSelectNone,
    resetLabel = "Reset",
    selectNoneLabel = "全部反选",
    className,
    checkboxContainerClassName = "filter-panel-checkboxes",
    actionsClassName = "filter-panel-actions"
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

    const measureOverflow = useCallback(() => {
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
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }
        setIsExpanded(false);
        measureOverflow();
        window.addEventListener("resize", measureOverflow);
        return () => {
            window.removeEventListener("resize", measureOverflow);
        };
    }, [items, measureOverflow]);

    useEffect(() => {
        if (!isExpanded) {
            measureOverflow();
        }
    }, [isExpanded, measureOverflow]);

    const containerStyle = useMemo(() => {
        if (isExpanded || !collapsedHeight) {
            return undefined;
        }
        return {
            maxHeight: collapsedHeight,
            overflow: "hidden"
        };
    }, [collapsedHeight, isExpanded]);

    const showReset = onReset && hasDeselected;
    const showSelectNone = typeof onSelectNone === "function";
    const showActions = showReset || showSelectNone;

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
            {isOverflowing && (
                <div className="filter-panel-toggle">
                    <button
                        type="button"
                        className="btn btn-sm btn-light"
                        onClick={() => setIsExpanded(prev => !prev)}
                    >
                        {isExpanded ? "收起" : "..."}
                    </button>
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
