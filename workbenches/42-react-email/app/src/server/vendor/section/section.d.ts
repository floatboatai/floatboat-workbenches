import * as React from 'react';
export type SectionProps = Readonly<React.ComponentPropsWithoutRef<'table'>>;
export declare const Section: React.ForwardRefExoticComponent<Readonly<Omit<React.DetailedHTMLProps<React.TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>, "ref">> & {
    tdClassName?: string;
} & React.RefAttributes<HTMLTableElement>>;
