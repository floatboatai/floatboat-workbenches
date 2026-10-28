import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
export const Html = React.forwardRef(({ children, lang = 'en', dir = 'ltr', ...props }, ref) => (_jsx("html", { ...props, dir: dir, lang: lang, ref: ref, children: children })));
Html.displayName = 'Html';
