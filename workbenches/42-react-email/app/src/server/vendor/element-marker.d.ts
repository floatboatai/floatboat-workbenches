import type * as React from 'react';
export declare const elementMarker: unique symbol;
export interface ResolvedTailwind {
    style: React.CSSProperties;
    className: string | undefined;
    classProperties: Record<string, string[]>;
}
export interface ElementOptions<Props = object> {
    resolveTailwind?: (props: Props, resolved: ResolvedTailwind) => Props;
}
export declare const markAsElement: <Props>(component: unknown, options?: ElementOptions<Props>) => void;
export declare const getElementOptions: (type: unknown) => ElementOptions | undefined;
