import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { markAsElement } from '../element-marker.js';
export const Container = React.forwardRef(({ children, style = {}, tdClassName, ...props }, ref) => {
    // Split padding styles to improve compatibility with Klaviyo and Outlook,
    // while preserving user-provided style property order without allocating
    // entry arrays on each render.
    const tdStyle = {};
    const tableStyle = {};
    const styleRecord = style;
    for (const key in styleRecord) {
        if (!Object.hasOwn(styleRecord, key)) {
            continue;
        }
        const value = styleRecord[key];
        if (key.startsWith('padding')) {
            tdStyle[key] = value;
        }
        else {
            tableStyle[key] = value;
        }
    }
    return (_jsx("table", { align: "center", width: "100%", ...props, border: 0, cellPadding: "0", cellSpacing: "0", ref: ref, role: "presentation", style: { maxWidth: '37.5em', ...tableStyle }, children: _jsx("tbody", { children: _jsx("tr", { style: { width: '100%' }, children: _jsx("td", { className: tdClassName, style: tdStyle, children: children }) }) }) }));
});
Container.displayName = 'Container';
markAsElement(Container, {
    resolveTailwind(props, { style, className, classProperties }) {
        const tableClasses = [];
        const tdClasses = props.tdClassName ? [props.tdClassName] : [];
        for (const name of className?.split(' ') ?? []) {
            const properties = classProperties[name];
            if (properties &&
                properties.length > 0 &&
                properties.every((property) => property.startsWith('padding'))) {
                tdClasses.push(name);
            }
            else {
                tableClasses.push(name);
            }
        }
        return {
            ...props,
            style,
            className: tableClasses.length > 0 ? tableClasses.join(' ') : undefined,
            tdClassName: tdClasses.length > 0 ? tdClasses.join(' ') : undefined,
        };
    },
});
