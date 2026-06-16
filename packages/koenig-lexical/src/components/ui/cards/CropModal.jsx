import 'react-image-crop/dist/ReactCrop.css';
import PropTypes from 'prop-types';
import React from 'react';
import ReactCrop, {centerCrop, makeAspectCrop} from 'react-image-crop';
import {Modal} from '../Modal';

const DEFAULT_ASPECT_RATIOS = [
    {label: 'Free', value: undefined},
    {label: '1:1', value: 1},
    {label: '4:3', value: 4 / 3},
    {label: '16:9', value: 16 / 9}
];

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
    if (!aspect) {
        return {
            unit: '%',
            x: 0,
            y: 0,
            width: 100,
            height: 100
        };
    }

    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90
            },
            aspect,
            mediaWidth,
            mediaHeight
        ),
        mediaWidth,
        mediaHeight
    );
}

function getCropInNaturalPixels(crop, image) {
    if (!crop?.width || !crop?.height) {
        return null;
    }

    if (crop.unit === '%') {
        return {
            x: Math.round((crop.x / 100) * image.naturalWidth),
            y: Math.round((crop.y / 100) * image.naturalHeight),
            width: Math.round((crop.width / 100) * image.naturalWidth),
            height: Math.round((crop.height / 100) * image.naturalHeight)
        };
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    return {
        x: Math.round(crop.x * scaleX),
        y: Math.round(crop.y * scaleY),
        width: Math.round(crop.width * scaleX),
        height: Math.round(crop.height * scaleY)
    };
}

function getOutputType(src) {
    try {
        const {pathname} = new URL(src, window.location.href);
        if (pathname.toLowerCase().endsWith('.png')) {
            return {
                extension: 'png',
                mimeType: 'image/png'
            };
        }
    } catch (e) {
        // Fall back to JPEG below for malformed or data URLs.
    }

    return {
        extension: 'jpg',
        mimeType: 'image/jpeg'
    };
}

function canvasToBlob(canvas, mimeType) {
    return new Promise((resolve) => {
        canvas.toBlob(resolve, mimeType, mimeType === 'image/jpeg' ? 0.92 : undefined);
    });
}

async function cropImageToFile({image, crop, src, maxWidth}) {
    const pixelCrop = getCropInNaturalPixels(crop, image);
    if (!pixelCrop) {
        return null;
    }

    const scale = maxWidth && pixelCrop.width > maxWidth ? maxWidth / pixelCrop.width : 1;
    const outputWidth = Math.max(1, Math.round(pixelCrop.width * scale));
    const outputHeight = Math.max(1, Math.round(pixelCrop.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        outputWidth,
        outputHeight
    );

    const {extension, mimeType} = getOutputType(src);
    const blob = await canvasToBlob(canvas, mimeType);
    if (!blob) {
        return null;
    }

    return new File([blob], `cropped-image-${Date.now()}.${extension}`, {type: mimeType});
}

export function CropModal({isOpen, src, altText, aspectRatios = DEFAULT_ASPECT_RATIOS, maxWidth = 2400, onClose, onSave}) {
    const imageRef = React.useRef(null);
    const [selectedAspect, setSelectedAspect] = React.useState(aspectRatios[0]?.value);
    const [crop, setCrop] = React.useState();
    const [completedCrop, setCompletedCrop] = React.useState();
    const [error, setError] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (!isOpen) {
            setCrop(undefined);
            setCompletedCrop(undefined);
            setError('');
            setIsSaving(false);
            setSelectedAspect(aspectRatios[0]?.value);
        }
    }, [aspectRatios, isOpen]);

    const handleImageLoad = React.useCallback((event) => {
        const {naturalWidth, naturalHeight} = event.currentTarget;
        const initialCrop = centerAspectCrop(naturalWidth, naturalHeight, selectedAspect);
        imageRef.current = event.currentTarget;
        setCrop(initialCrop);
        setCompletedCrop(initialCrop);
    }, [selectedAspect]);

    const selectAspectRatio = (aspect) => {
        setSelectedAspect(aspect);
        if (imageRef.current) {
            const nextCrop = centerAspectCrop(imageRef.current.naturalWidth, imageRef.current.naturalHeight, aspect);
            setCrop(nextCrop);
            setCompletedCrop(nextCrop);
        }
    };

    const saveCrop = async () => {
        if (!imageRef.current || !completedCrop) {
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            const file = await cropImageToFile({
                image: imageRef.current,
                crop: completedCrop,
                src,
                maxWidth
            });

            if (!file) {
                throw new Error('Unable to crop image');
            }

            await onSave(file);
            onClose();
        } catch (e) {
            setError('Could not crop this image. Try downloading it and uploading a local copy.');
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="p-8 font-sans">
                <h2 className="m-0 pr-8 text-xl font-semibold text-black dark:text-white">Crop image</h2>
                <div className="mt-6 max-h-[65vh] overflow-auto rounded-md bg-grey-100 p-3 dark:bg-grey-950">
                    <ReactCrop
                        aspect={selectedAspect}
                        crop={crop}
                        keepSelection={true}
                        minHeight={20}
                        minWidth={20}
                        onChange={(_crop, percentCrop) => setCrop(percentCrop)}
                        onComplete={(_crop, percentCrop) => setCompletedCrop(percentCrop)}
                    >
                        <img
                            alt={altText || ''}
                            className="max-h-[56vh] max-w-full"
                            crossOrigin="anonymous"
                            src={src}
                            onLoad={handleImageLoad}
                        />
                    </ReactCrop>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                    {aspectRatios.map((ratio) => (
                        <button
                            key={ratio.label}
                            className={`rounded-md px-3 py-2 text-sm font-medium transition ${selectedAspect === ratio.value ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-grey-100 text-black hover:bg-grey-200 dark:bg-grey-900 dark:text-white dark:hover:bg-grey-800'}`}
                            type="button"
                            onClick={() => selectAspectRatio(ratio.value)}
                        >
                            {ratio.label}
                        </button>
                    ))}
                </div>
                {error ? (
                    <p className="mt-4 text-sm text-red">{error}</p>
                ) : null}
                <div className="mt-8 flex justify-end gap-3">
                    <button className="rounded-md bg-grey-100 px-4 py-2 text-md font-medium text-black transition hover:bg-grey-200 dark:bg-grey-900 dark:text-white dark:hover:bg-grey-800" type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="rounded-md bg-black px-4 py-2 text-md font-medium text-white transition hover:bg-grey-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-grey-200" disabled={isSaving || !completedCrop} type="button" onClick={saveCrop}>
                        {isSaving ? 'Cropping...' : 'Apply crop'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

CropModal.propTypes = {
    isOpen: PropTypes.bool,
    src: PropTypes.string,
    altText: PropTypes.string,
    aspectRatios: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.number
    })),
    maxWidth: PropTypes.number,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired
};
