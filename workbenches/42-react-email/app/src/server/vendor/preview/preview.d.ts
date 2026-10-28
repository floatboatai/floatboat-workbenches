import * as React from 'react';
export type PreviewProps = Readonly<React.ComponentPropsWithoutRef<'div'> & {
    /**
     * @default true
     */
    useTitleTag?: boolean;
    children: string | string[];
}>;
export declare const Preview: React.ForwardRefExoticComponent<Readonly<Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & {
    /**
     * @default true
     */
    useTitleTag?: boolean;
    children: string | string[];
}> & React.RefAttributes<HTMLDivElement>>;
export declare const renderWhiteSpace: (text: string) => import("react/jsx-runtime").JSX.Element | null;
