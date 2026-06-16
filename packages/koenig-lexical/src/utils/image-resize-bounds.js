const DEFAULT_MIN_WIDTH = 100;
const DEFAULT_MAX_WIDTH = 2400;

function toPositiveNumber(value) {
    return Number.isFinite(value) && value > 0 ? value : null;
}

export function getImageResizeLayoutWidth(imageElement) {
    const cardElementWidth = toPositiveNumber(imageElement?.closest?.('[data-kg-card]')?.clientWidth);
    if (cardElementWidth) {
        return cardElementWidth;
    }

    const figureParentWidth = toPositiveNumber(imageElement?.closest?.('figure')?.parentElement?.clientWidth);
    if (figureParentWidth) {
        return figureParentWidth;
    }

    return toPositiveNumber(imageElement?.parentElement?.clientWidth);
}

export function getImageResizeBounds({imageWidth, layoutWidth, resizeConfig = {}, fallbackMaxWidth = DEFAULT_MAX_WIDTH} = {}) {
    const minWidth = toPositiveNumber(resizeConfig?.minWidth) || DEFAULT_MIN_WIDTH;
    const maxWidthCandidates = [
        resizeConfig?.maxWidth,
        imageWidth,
        layoutWidth,
        fallbackMaxWidth
    ].map(toPositiveNumber).filter(Boolean);

    const maxWidth = maxWidthCandidates.length > 0
        ? Math.min(...maxWidthCandidates)
        : fallbackMaxWidth;

    return {
        minWidth,
        maxWidth: Math.max(minWidth, maxWidth)
    };
}
