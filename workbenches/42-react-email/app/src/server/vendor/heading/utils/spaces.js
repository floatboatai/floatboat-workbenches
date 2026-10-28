export const withMargin = (props) => {
    const candidates = [
        withSpace(props.m, ['margin']),
        withSpace(props.mx, ['marginLeft', 'marginRight']),
        withSpace(props.my, ['marginTop', 'marginBottom']),
        withSpace(props.mt, ['marginTop']),
        withSpace(props.mr, ['marginRight']),
        withSpace(props.mb, ['marginBottom']),
        withSpace(props.ml, ['marginLeft']),
    ];
    const mergedStyles = {};
    for (const style of candidates) {
        if (Object.keys(style).length > 0) {
            Object.assign(mergedStyles, style);
        }
    }
    return mergedStyles;
};
export const withSpace = (value, properties) => {
    const styles = {};
    if (value === undefined) {
        return styles;
    }
    // Check to ensure string value is a valid number
    if (Number.isNaN(Number.parseFloat(String(value)))) {
        return styles;
    }
    for (const property of properties) {
        styles[property] = `${value}px`;
    }
    return styles;
};
