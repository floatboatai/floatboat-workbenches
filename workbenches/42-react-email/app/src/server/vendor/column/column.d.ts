import * as React from 'react';
export type ColumnProps = Readonly<React.ComponentPropsWithoutRef<'td'>>;
export declare const Column: React.ForwardRefExoticComponent<Readonly<Omit<React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableDataCellElement>, HTMLTableDataCellElement>, "ref">> & React.RefAttributes<HTMLTableCellElement>>;
