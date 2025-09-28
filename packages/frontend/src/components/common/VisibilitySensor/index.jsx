import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";

/**
 * 使用 IntersectionObserver 封装的可见性探测组件，替代旧的 react-visibility-sensor。
 */
export default function VisibilitySensor({ children, onChange, partialVisibility = false, offset = {} }) {
  const [node, setNode] = useState(null);
  const onChangeRef = useRef(onChange);
  const lastVisibleRef = useRef(undefined);

  const topOffset = typeof offset.top === "number" ? offset.top : 0;
  const rightOffset = typeof offset.right === "number" ? offset.right : 0;
  const bottomOffset = typeof offset.bottom === "number" ? offset.bottom : 0;
  const leftOffset = typeof offset.left === "number" ? offset.left : 0;

  const rootMargin = useMemo(() => {
    return `${topOffset}px ${rightOffset}px ${bottomOffset}px ${leftOffset}px`;
  }, [topOffset, rightOffset, bottomOffset, leftOffset]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!node) {
      return undefined;
    }

    if (typeof IntersectionObserver === "undefined") {
      if (lastVisibleRef.current !== true) {
        lastVisibleRef.current = true;
        if (onChangeRef.current) {
          onChangeRef.current(true);
        }
      }
      return undefined;
    }

    const thresholds = partialVisibility ? [0, 0.0001, 1] : [1];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isVisible = partialVisibility ? entry.isIntersecting : entry.intersectionRatio >= 1;
          if (lastVisibleRef.current !== isVisible) {
            lastVisibleRef.current = isVisible;
            if (onChangeRef.current) {
              onChangeRef.current(isVisible);
            }
          }
        });
      },
      {
        root: null,
        rootMargin,
        threshold: thresholds,
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [node, partialVisibility, rootMargin]);

  const child = React.Children.only(children);
  const childRef = child.ref;

  const attachRef = useCallback(
    (currentNode) => {
      setNode(currentNode);
      if (!childRef) {
        return;
      }
      if (typeof childRef === "function") {
        childRef(currentNode);
      } else if (typeof childRef === "object") {
        childRef.current = currentNode;
      }
    },
    [childRef]
  );

  return React.cloneElement(child, {
    ref: attachRef,
  });
}

VisibilitySensor.propTypes = {
  children: PropTypes.element.isRequired,
  onChange: PropTypes.func,
  partialVisibility: PropTypes.bool,
  offset: PropTypes.shape({
    top: PropTypes.number,
    right: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number,
  }),
};
