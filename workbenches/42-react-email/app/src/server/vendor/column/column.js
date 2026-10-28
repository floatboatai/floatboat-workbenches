import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { markAsElement } from '../element-marker.js';
export const Column = React.forwardRef(({ children, style, ...props }, ref) => {
    return (_jsx("td", { ...props, "data-id": "__react-email-column", ref: ref, style: style, children: children }));
});
Column.displayName = 'Column';
markAsElement(Column);
