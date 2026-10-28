import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { markAsElement } from '../element-marker.js';
export const Hr = React.forwardRef(({ style, ...props }, ref) => (_jsx("hr", { ...props, ref: ref, style: {
        width: '100%',
        border: 'none',
        borderColor: 'transparent',
        borderTop: '1px solid #eaeaea',
        ...style,
    } })));
Hr.displayName = 'Hr';
markAsElement(Hr);
