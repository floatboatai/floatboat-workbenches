import type React from 'react';
type MarginCSSProperty = 'margin' | 'marginLeft' | 'marginRight' | 'marginTop' | 'marginBottom';
type MarginStyles = Partial<Pick<React.CSSProperties, MarginCSSProperty>>;
export interface Margin {
    m?: number | string;
    mx?: number | string;
    my?: number | string;
    mt?: number | string;
    mr?: number | string;
    mb?: number | string;
    ml?: number | string;
}
export declare const withMargin: (props: Margin) => MarginStyles;
export declare const withSpace: (value: number | string | undefined, properties: MarginCSSProperty[]) => Partial<Pick<React.CSSProperties, MarginCSSProperty>>;
export {};
