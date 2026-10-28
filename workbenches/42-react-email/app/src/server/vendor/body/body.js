import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { markAsElement } from '../element-marker.js';
import { marginProperties, paddingProperties } from './margin-properties.js';
export const Body = React.forwardRef(({ children, style, ...props }, ref) => {
    const bodyStyle = {
        background: style?.background,
        backgroundColor: style?.backgroundColor,
    };
    if (style) {
        for (const property of [...marginProperties, ...paddingProperties]) {
            // We reset the margin if the user sets it, this mimics the
            // same behavior that would happen if this was only using the body.
            // This avoids the incoming margin summing up with the margin
            // defined by the email client on the body, or by the browser itself
            bodyStyle[property] = style[property] !== undefined ? 0 : undefined;
        }
    }
    return (_jsx("body", { ...props, dir: props.dir ?? 'ltr', lang: props.lang ?? 'en', style: bodyStyle, ref: ref, children: _jsx("table", { border: 0, width: "100%", cellPadding: "0", cellSpacing: "0", role: "presentation", align: "center", children: _jsx("tbody", { children: _jsx("tr", { children: _jsx("td", { dir: props.dir ?? 'ltr', lang: props.lang ?? 'en', style: style, children: children }) }) }) }) }));
});
Body.displayName = 'Body';
markAsElement(Body);
