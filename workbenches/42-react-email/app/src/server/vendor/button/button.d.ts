import * as React from 'react';
export type ButtonProps = Readonly<React.ComponentPropsWithoutRef<'a'>>;
declare module 'react' {
    interface CSSProperties {
        msoPaddingAlt?: string | number | undefined;
        msoTextRaise?: string | number | undefined;
    }
}
export declare const Button: React.ForwardRefExoticComponent<Readonly<Omit<React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>, "ref">> & React.RefAttributes<HTMLAnchorElement>>;
