export const elementMarker = Symbol.for('react-email.element');
export const markAsElement = (component, options = {}) => {
    component[elementMarker] = options;
};
export const getElementOptions = (type) => {
    if (typeof type !== 'function' && typeof type !== 'object')
        return undefined;
    if (type === null)
        return undefined;
    return type[elementMarker];
};
