import * as React from 'react';
import type { As } from './utils/as.js';
import type { Margin } from './utils/spaces.js';
export type HeadingAs = As<'h1', 'h2', 'h3', 'h4', 'h5', 'h6'>;
export type HeadingProps = HeadingAs & Margin;
export declare const Heading: React.ForwardRefExoticComponent<(Omit<Readonly<React.ClassAttributes<HTMLHeadingElement> & React.HTMLAttributes<HTMLHeadingElement> & {
    as?: "h1" | undefined;
} & Margin>, "ref"> | Omit<Readonly<React.ClassAttributes<HTMLHeadingElement> & React.HTMLAttributes<HTMLHeadingElement> & {
    as: "h2";
} & Margin>, "ref"> | Omit<Readonly<React.ClassAttributes<HTMLHeadingElement> & React.HTMLAttributes<HTMLHeadingElement> & {
    as: "h3";
} & Margin>, "ref"> | Omit<Readonly<React.ClassAttributes<HTMLHeadingElement> & React.HTMLAttributes<HTMLHeadingElement> & {
    as: "h4";
} & Margin>, "ref"> | Omit<Readonly<React.ClassAttributes<HTMLHeadingElement> & React.HTMLAttributes<HTMLHeadingElement> & {
    as: "h5";
} & Margin>, "ref"> | Omit<Readonly<React.ClassAttributes<HTMLHeadingElement> & React.HTMLAttributes<HTMLHeadingElement> & {
    as: "h6";
} & Margin>, "ref">) & React.RefAttributes<HTMLHeadingElement>>;
