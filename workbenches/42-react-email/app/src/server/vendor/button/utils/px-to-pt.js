export const pxToPt = (px) => typeof px === 'number' && !Number.isNaN(Number(px))
    ? (px * 3) / 4
    : undefined;
