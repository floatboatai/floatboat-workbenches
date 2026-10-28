type PaddingType = string | number | undefined;
interface PaddingProperties {
    padding?: PaddingType;
    paddingTop?: PaddingType;
    paddingRight?: PaddingType;
    paddingBottom?: PaddingType;
    paddingLeft?: PaddingType;
}
/**
 * converts padding value to `px` equivalent.
 * @example "1em" =\> 16
 */
export declare function convertToPx(value: PaddingType): number;
/**
 * Parses all the values out of a padding string to get the value for all padding props in `px`
 * @example e.g. "10px" =\> pt: 10, pr: 10, pb: 10, pl: 10
 */
export declare function parsePadding(properties: PaddingProperties): {
    paddingTop: number | undefined;
    paddingRight: number | undefined;
    paddingBottom: number | undefined;
    paddingLeft: number | undefined;
};
export {};
