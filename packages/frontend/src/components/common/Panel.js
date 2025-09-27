import React from 'react';
import { Card } from 'react-bootstrap';
import classNames from 'classnames';

const Panel = ({
    title,
    className,
    bodyClassName,
    headerActions,
    children,
    ...rest
}) => {
    const hasBody = React.Children.count(children) > 0;

    return (
        <Card
            bg="light"
            text="dark"
            className={classNames('shadow-sm border-0 mb-3', className)}
            {...rest}
        >
            {(title || headerActions) && (
                <Card.Header className="d-flex justify-content-between align-items-center bg-white border-0 fw-semibold">
                    <span>{title}</span>
                    {headerActions && <div className="d-flex align-items-center gap-2">{headerActions}</div>}
                </Card.Header>
            )}
            {hasBody && (
                <Card.Body className={classNames('bg-white', bodyClassName)}>
                    {children}
                </Card.Body>
            )}
        </Card>
    );
};

export default Panel;
