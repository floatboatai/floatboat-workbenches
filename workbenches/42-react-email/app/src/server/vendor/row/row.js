import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { markAsElement } from '../element-marker.js';
export const Row = React.forwardRef(({ children, style, ...props }, ref) => {
    return (_jsx("table", { align: "center", width: "100%", border: 0, cellPadding: "0", cellSpacing: "0", role: "presentation", ...props, ref: ref, style: style, children: _jsx("tbody", { style: { width: '100%' }, children: _jsx("tr", { style: { width: '100%' }, children: children }) }) }));
});
Row.displayName = 'Row';
markAsElement(Row);
