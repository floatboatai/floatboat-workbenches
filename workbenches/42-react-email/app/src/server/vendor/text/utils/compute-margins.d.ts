type MarginType = string | number | undefined;
interface MarginProperties {
    margin?: MarginType;
    marginTop?: MarginType;
    marginRight?: MarginType;
    marginBottom?: MarginType;
    marginLeft?: MarginType;
}
interface MarginResult {
    marginTop: MarginType;
    marginRight: MarginType;
    marginBottom: MarginType;
    marginLeft: MarginType;
}
/**
 * Parses all the values out of a margin string to get the value for all margin props in the four margin properties
 * @example e.g. "10px" =\> mt: "10px", mr: "10px", mb: "10px", ml: "10px"
 */
export declare function computeMargins(properties: MarginProperties): MarginResult;
export {};
