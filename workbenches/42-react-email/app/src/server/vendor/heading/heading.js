import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { markAsElement } from '../element-marker.js';
import { withMargin } from './utils/spaces.js';
export const Heading = React.forwardRef(({ as: Tag = 'h1', children, style, m, mx, my, mt, mr, mb, ml, ...props }, ref) => {
    return (_jsx(Tag, { ...props, ref: ref, style: { ...withMargin({ m, mx, my, mt, mr, mb, ml }), ...style }, children: children }));
});
Heading.displayName = 'Heading';
markAsElement(Heading);
