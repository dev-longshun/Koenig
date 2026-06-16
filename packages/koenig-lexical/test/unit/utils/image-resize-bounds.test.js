import {describe, expect, it} from 'vitest';
import {getImageResizeBounds, getImageResizeLayoutWidth} from '../../../src/utils/image-resize-bounds';

function setClientWidth(element, width) {
    Object.defineProperty(element, 'clientWidth', {
        configurable: true,
        value: width
    });
}

describe('image-resize-bounds utils', () => {
    it('limits resize width by the available layout width', () => {
        expect(getImageResizeBounds({
            imageWidth: 1200,
            layoutWidth: 720
        })).toEqual({
            minWidth: 100,
            maxWidth: 720
        });
    });

    it('limits resize width by the image resource width', () => {
        expect(getImageResizeBounds({
            imageWidth: 600,
            layoutWidth: 720
        })).toEqual({
            minWidth: 100,
            maxWidth: 600
        });
    });

    it('applies configured min and max widths as resize bounds', () => {
        expect(getImageResizeBounds({
            imageWidth: 1200,
            layoutWidth: 720,
            resizeConfig: {
                minWidth: 160,
                maxWidth: 640
            }
        })).toEqual({
            minWidth: 160,
            maxWidth: 640
        });
    });

    it('keeps the max width above the current shrunken image wrapper width', () => {
        const cardElement = document.createElement('div');
        cardElement.dataset.kgCard = 'image';
        setClientWidth(cardElement, 720);

        const figure = document.createElement('figure');
        setClientWidth(figure, 300);

        const imageWrapper = document.createElement('div');
        setClientWidth(imageWrapper, 300);

        const image = document.createElement('img');

        imageWrapper.appendChild(image);
        figure.appendChild(imageWrapper);
        cardElement.appendChild(figure);

        expect(getImageResizeLayoutWidth(image)).toBe(720);
        expect(getImageResizeBounds({
            imageWidth: 1200,
            layoutWidth: getImageResizeLayoutWidth(image)
        })).toEqual({
            minWidth: 100,
            maxWidth: 720
        });
    });

    it('falls back to the figure parent when a card wrapper is unavailable', () => {
        const layoutElement = document.createElement('div');
        setClientWidth(layoutElement, 680);

        const figure = document.createElement('figure');
        const image = document.createElement('img');

        figure.appendChild(image);
        layoutElement.appendChild(figure);

        expect(getImageResizeLayoutWidth(image)).toBe(680);
    });
});
