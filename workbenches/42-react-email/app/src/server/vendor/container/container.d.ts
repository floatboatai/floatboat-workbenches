import * as React from 'react';
export type ContainerProps = Readonly<React.ComponentPropsWithoutRef<'table'>>;
export declare const Container: React.ForwardRefExoticComponent<Readonly<Omit<React.DetailedHTMLProps<React.TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>, "ref">> & {
    tdClassName?: string;
} & React.RefAttributes<HTMLTableElement>>;
