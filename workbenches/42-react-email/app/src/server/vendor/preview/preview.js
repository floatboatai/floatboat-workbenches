import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from 'react';
import { markAsElement } from '../element-marker.js';
const PREVIEW_MAX_LENGTH = 200;
export const Preview = React.forwardRef(({ children = '', useTitleTag = true, ...props }, ref) => {
    const text = (Array.isArray(children) ? children.join('') : children).substring(0, PREVIEW_MAX_LENGTH);
    return (_jsxs(_Fragment, { children: [useTitleTag ? _jsx("title", { children: text }) : null, _jsxs("div", { style: {
                    display: 'none',
                    overflow: 'hidden',
                    lineHeight: '1px',
                    opacity: 0,
                    maxHeight: 0,
                    maxWidth: 0,
                }, "data-skip-in-text": true, ...props, ref: ref, children: [text, renderWhiteSpace(text)] })] }));
});
Preview.displayName = 'Preview';
markAsElement(Preview);
// Spam filters such as rspamd ignore these as preview padding, but count the
// direction marks U+200E and U+200F as hidden text, so those are left out.
const whiteSpaceCodes = '\xa0\u200C\u200B\u200D\uFEFF';
export const renderWhiteSpace = (text) => {
    if (text.length >= PREVIEW_MAX_LENGTH) {
        return null;
    }
    return _jsx("div", { children: whiteSpaceCodes.repeat(PREVIEW_MAX_LENGTH - text.length) });
};
