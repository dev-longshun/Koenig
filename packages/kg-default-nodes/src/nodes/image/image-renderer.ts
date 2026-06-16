import {getAvailableImageWidths} from '../../utils/get-available-image-widths.js';
import {isLocalContentImage} from '../../utils/is-local-content-image.js';
import {setSrcsetAttribute} from '../../utils/srcset-attribute.js';
import {getResizedImageDimensions} from '../../utils/get-resized-image-dimensions.js';
import {addCreateDocumentOption} from '../../utils/add-create-document-option.js';
import type {ExportDOMOptions} from '../../export-dom.js';
import {renderEmptyContainer} from '../../utils/render-empty-container.js';

interface ImageNodeData {
    src: string;
    width: number;
    height: number;
    alt: string;
    title: string;
    caption: string;
    cardWidth: string;
    displayWidth: number | null;
    href: string;
}

interface ImageRenderOptions extends ExportDOMOptions {
    imageOptimization?: {
        defaultMaxWidth?: number;
        contentImageSizes?: Record<string, { width: number }>;
        [key: string]: unknown;
    };
}

export function renderImageNode(node: ImageNodeData, options: ImageRenderOptions = {}) {
    addCreateDocumentOption(options);

    const document = options.createDocument!();

    if (!node.src || node.src.trim() === '') {
        return renderEmptyContainer(document);
    }

    const figure = document.createElement('figure');

    let figureClasses = 'kg-card kg-image-card';
    if (node.cardWidth !== 'regular') {
        figureClasses += ` kg-width-${node.cardWidth}`;
    }
    if (node.caption) {
        figureClasses += ' kg-card-hascaption';
    }

    figure.setAttribute('class', figureClasses);

    const img = document.createElement('img');
    img.setAttribute('src', node.src);
    img.setAttribute('class', 'kg-image');
    img.setAttribute('alt', node.alt);
    img.setAttribute('loading', 'lazy');

    if (node.title) {
        img.setAttribute('title', node.title);
    }

    const hasDisplayWidth = Boolean(node.displayWidth && node.cardWidth === 'regular');
    const imageDimensions = {
        width: node.width,
        height: node.height
    };
    const displayedDimensions = hasDisplayWidth && node.width && node.height
        ? getResizedImageDimensions(imageDimensions, {width: node.displayWidth!})
        : null;

    if (displayedDimensions) {
        img.setAttribute('width', String(displayedDimensions.width));
        img.setAttribute('height', String(displayedDimensions.height));
        if (options.target !== 'email') {
            img.setAttribute('style', `width: ${displayedDimensions.width}px; max-width: 100%; height: auto;`);
        }
    } else if (node.width && node.height) {
        img.setAttribute('width', String(node.width));
        img.setAttribute('height', String(node.height));
    }

    // images can be resized to max width, if that's the case output
    // the resized width/height attrs to ensure 3rd party gallery plugins
    // aren't affected by differing sizes
    const {canTransformImage} = options;
    const {defaultMaxWidth} = options.imageOptimization || {};
    if (
        !displayedDimensions &&
        defaultMaxWidth &&
            node.width > defaultMaxWidth &&
            isLocalContentImage(node.src, options.siteUrl) &&
            canTransformImage &&
            canTransformImage(node.src)
    ) {
        const {width, height} = getResizedImageDimensions(imageDimensions, {width: defaultMaxWidth});
        img.setAttribute('width', String(width));
        img.setAttribute('height', String(height));
    }

    if (options.target !== 'email') {
        const imgAttributes = {
            src: node.src,
            width: node.width,
            height: node.height
        };
        setSrcsetAttribute(img, imgAttributes, options);

        if (img.getAttribute('srcset') && node.width && node.width >= 720) {
            // standard size
            if (hasDisplayWidth) {
                img.setAttribute('sizes', `(min-width: ${node.displayWidth}px) ${node.displayWidth}px, 100vw`);
            } else if (!node.cardWidth || node.cardWidth === 'regular') {
                img.setAttribute('sizes', '(min-width: 720px) 720px');
            }

            if (node.cardWidth === 'wide' && node.width >= 1200) {
                img.setAttribute('sizes', '(min-width: 1200px) 1200px');
            }
        }
    }

    // Outlook is unable to properly resize images without a width/height
    // so we add that at the expected size in emails (600px) and use a higher
    // resolution image to keep images looking good on retina screens
    if (options.target === 'email' && node.width && node.height) {
        let emailDimensions = {
            width: node.width,
            height: node.height
        };
        const targetEmailWidth = node.displayWidth && node.cardWidth === 'regular' ? Math.min(node.displayWidth, 600) : 600;
        if (node.width >= targetEmailWidth) {
            emailDimensions = getResizedImageDimensions(emailDimensions, {width: targetEmailWidth});
        }
        img.setAttribute('width', String(emailDimensions.width));
        img.setAttribute('height', String(emailDimensions.height));

        const contentImageSizes = options.imageOptimization?.contentImageSizes;
        if (contentImageSizes && isLocalContentImage(node.src, options.siteUrl) && options.canTransformImage?.(node.src)) {
            // find available image size next up from 2x600 so we can use it for the "retina" src
            const availableImageWidths = getAvailableImageWidths(node, contentImageSizes);
            const srcWidth = availableImageWidths.find(width => width >= emailDimensions.width * 2);

            if (!srcWidth || srcWidth === node.width) {
                // do nothing, width is smaller than retina or matches the original node src
            } else {
                const match = node.src.match(/(.*\/content\/images)\/(.*)/);
                if (match) {
                    const [, imagesPath, filename] = match;
                    img.setAttribute('src', `${imagesPath}/size/w${srcWidth}/${filename}`);
                }
            }
        }
    }

    if (node.href) {
        const a = document.createElement('a');
        a.setAttribute('href', node.href);
        a.appendChild(img);
        figure.appendChild(a);
    } else {
        figure.appendChild(img);
    }

    if (node.caption) {
        const caption = document.createElement('figcaption');
        caption.innerHTML = node.caption;
        figure.appendChild(caption);
    }

    return {element: figure, type: 'outer' as const};
}
