import * as React from 'react';
export type RowProps = Readonly<React.ComponentPropsWithoutRef<'table'> & {
    children: React.ReactNode;
}>;
export declare const Row: React.ForwardRefExoticComponent<Readonly<Omit<React.DetailedHTMLProps<React.TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>, "ref"> & {
    children: React.ReactNode;
}> & React.RefAttributes<HTMLTableElement>>;
