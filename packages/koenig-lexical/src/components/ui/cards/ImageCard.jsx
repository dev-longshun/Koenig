import ImageUploadForm from '../ImageUploadForm';
import PropTypes from 'prop-types';
import React from 'react';
import WandIcon from '../../../assets/icons/kg-wand.svg?react';
import {CardCaptionEditor} from '../CardCaptionEditor';
import {CardText, MediaPlaceholder} from '../MediaPlaceholder';
import {IconButton} from '../IconButton';
import {ProgressBar} from '../ProgressBar';
import {isGif} from '../../../utils/isGif';
import {openFileSelection} from '../../../utils/openFileSelection';

const RESIZE_HANDLES = [
    {name: 'nw', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize', direction: -1},
    {name: 'ne', className: 'right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize', direction: 1},
    {name: 'sw', className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize', direction: -1},
    {name: 'se', className: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize', direction: 1}
];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function PopulatedImageCard({
    src,
    alt,
    previewSrc,
    imageUploader,
    imageCardDragHandler,
    imageFileDragHandler,
    isPinturaEnabled,
    openImageEditor,
    onFileChange,
    imageWidth,
    imageHeight,
    displayWidth,
    isSelected,
    isResizeEnabled,
    resizeConfig,
    onDisplayWidthChange,
    onResetDisplayWidth
}) {
    const imageRef = React.useRef(null);
    const resizeStateRef = React.useRef(null);
    const [liveDisplayWidth, setLiveDisplayWidth] = React.useState(displayWidth || null);
    const [isResizing, setIsResizing] = React.useState(false);

    React.useEffect(() => {
        setLiveDisplayWidth(displayWidth || null);
    }, [displayWidth]);

    const progressStyle = {
        width: `${imageUploader.progress?.toFixed(0)}%`
    };

    const progressAlt = imageUploader.progress.toFixed(0) < 100 ? `upload in progress, ${imageUploader.progress}` : '';
    const effectiveDisplayWidth = liveDisplayWidth || displayWidth;
    const imageStyle = effectiveDisplayWidth ? {
        width: `${Math.round(effectiveDisplayWidth)}px`,
        maxWidth: '100%',
        height: 'auto'
    } : undefined;
    const displayHeight = effectiveDisplayWidth && imageWidth && imageHeight
        ? Math.round((effectiveDisplayWidth / imageWidth) * imageHeight)
        : null;

    function setRef(element) {
        imageFileDragHandler?.setRef(element);
        imageCardDragHandler?.setRef(element);
    }

    const getResizeBounds = React.useCallback(() => {
        const minWidth = resizeConfig?.minWidth || 100;
        const configuredMaxWidth = resizeConfig?.maxWidth;
        const measuredMaxWidth = imageRef.current?.parentElement?.clientWidth;
        const maxWidth = configuredMaxWidth || measuredMaxWidth || imageWidth || 2400;

        return {
            minWidth,
            maxWidth: Math.max(minWidth, maxWidth)
        };
    }, [imageWidth, resizeConfig]);

    const handleResizeMove = React.useCallback((event) => {
        const state = resizeStateRef.current;
        if (!state) {
            return;
        }

        const delta = (event.clientX - state.startX) * state.direction;
        const nextWidth = clamp(state.startWidth + delta, state.minWidth, state.maxWidth);
        state.latestWidth = nextWidth;
        setLiveDisplayWidth(nextWidth);
    }, []);

    const stopResize = React.useCallback(() => {
        const state = resizeStateRef.current;
        window.removeEventListener('pointermove', handleResizeMove);
        resizeStateRef.current = null;
        setIsResizing(false);

        if (state?.latestWidth) {
            onDisplayWidthChange(Math.round(state.latestWidth));
        }
    }, [handleResizeMove, onDisplayWidthChange]);

    const startResize = React.useCallback((event, handle) => {
        if (!isResizeEnabled || imageUploader.isLoading) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const measuredWidth = imageRef.current?.getBoundingClientRect().width;
        const startWidth = displayWidth || liveDisplayWidth || measuredWidth || imageWidth || 0;
        const {minWidth, maxWidth} = getResizeBounds();

        resizeStateRef.current = {
            startX: event.clientX,
            startWidth,
            direction: handle.direction,
            minWidth,
            maxWidth,
            latestWidth: startWidth
        };
        setIsResizing(true);

        window.addEventListener('pointermove', handleResizeMove);
        window.addEventListener('pointerup', stopResize, {once: true});
    }, [displayWidth, getResizeBounds, handleResizeMove, imageUploader.isLoading, imageWidth, isResizeEnabled, liveDisplayWidth, stopResize]);

    React.useEffect(() => {
        return () => {
            window.removeEventListener('pointermove', handleResizeMove);
            window.removeEventListener('pointerup', stopResize);
        };
    }, [handleResizeMove, stopResize]);

    return (
        <div ref={setRef} className="not-kg-prose group/image relative">
            <img
                ref={imageRef}
                alt={alt ? alt : progressAlt}
                className={`mx-auto block ${previewSrc ? 'opacity-40' : ''}`}
                data-testid={imageUploader.isLoading ? 'image-card-loading' : 'image-card-populated'}
                src={previewSrc ? previewSrc : src}
                style={imageStyle}
            />
            {(isSelected && isResizeEnabled && !previewSrc && !imageUploader.isLoading) ? (
                <>
                    {RESIZE_HANDLES.map(handle => (
                        <button
                            key={handle.name}
                            aria-label="Resize image"
                            className={`absolute size-4 rounded-full border-2 border-white bg-black shadow-md transition dark:border-black dark:bg-white ${displayWidth || isResizing || isSelected ? 'opacity-100' : 'opacity-0'} ${handle.className}`}
                            data-testid={`image-resize-handle-${handle.name}`}
                            type="button"
                            onDoubleClick={onResetDisplayWidth}
                            onPointerDown={(event) => startResize(event, handle)}
                        />
                    ))}
                    {(displayWidth || isResizing) && displayHeight ? (
                        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-black/80 px-2 py-1 font-sans text-xs font-medium text-white">
                            {Math.round(effectiveDisplayWidth)} x {displayHeight}
                        </div>
                    ) : null}
                </>
            ) : null}
            {imageUploader.isLoading ?
                <div className="absolute inset-0 flex min-w-full items-center justify-center overflow-hidden bg-white/50" data-testid="upload-progress">
                    <ProgressBar style={progressStyle} />
                </div>
                : <></>
            }
            {imageCardDragHandler?.isDraggedOver ? (
                <div className={`absolute inset-0 flex items-center justify-center border border-grey/20 bg-black/80 dark:border-grey/10 dark:bg-grey-950`}>
                    <CardText text="Drop to convert to a gallery" />
                </div>
            ) : null}
            {imageFileDragHandler?.isDraggedOver ? (
                <div className={`absolute inset-0 flex items-center justify-center border border-grey/20 bg-black/80 dark:border-grey/10 dark:bg-grey-950`} data-testid="drag-overlay">
                    <CardText text="Drop to replace image" />
                </div>
            ) : null}
            {(isPinturaEnabled && !isGif(src)) &&
                <div className={`pointer-events-none invisible absolute inset-0 bg-gradient-to-t from-black/0 via-black/5 to-black/30 p-3 opacity-0 transition-all group-hover/image:visible group-hover/image:opacity-100`}>
                    <div className="flex flex-row-reverse">
                        <IconButton Icon={WandIcon} label="Edit" onClick={() => openImageEditor({
                            image: src,
                            handleSave: (editedImage) => {
                                onFileChange({
                                    target: {
                                        files: [editedImage]
                                    }
                                });
                            }
                        })} />
                    </div>
                </div>
            }
        </div>
    );
}

function EmptyImageCard({onFileChange, setFileInputRef, imageFileDragHandler, errors}) {
    const fileInputRef = React.useRef(null);

    const onFileInputRef = (element) => {
        fileInputRef.current = element;
        setFileInputRef(fileInputRef);
    };

    return (
        <>
            <MediaPlaceholder
                desc="Click to select an image"
                errors={errors}
                filePicker={() => openFileSelection({fileInputRef})}
                icon='image'
                isDraggedOver={imageFileDragHandler?.isDraggedOver}
                placeholderRef={imageFileDragHandler?.setRef}
            />
            <ImageUploadForm
                fileInputRef={onFileInputRef}
                filePicker={() => openFileSelection({fileInputRef})}
                onFileChange={onFileChange}
            />
        </>
    );
}

const ImageHolder = ({
    src,
    altText,
    previewSrc,
    imageUploader,
    onFileChange,
    setFileInputRef,
    imageCardDragHandler,
    imageFileDragHandler,
    isPinturaEnabled,
    openImageEditor,
    imageWidth,
    imageHeight,
    displayWidth,
    isSelected,
    isResizeEnabled,
    resizeConfig,
    onDisplayWidthChange,
    onResetDisplayWidth
}) => {
    if (previewSrc || src) {
        return (
            <PopulatedImageCard
                alt={altText}
                displayWidth={displayWidth}
                imageCardDragHandler={imageCardDragHandler}
                imageFileDragHandler={imageFileDragHandler}
                imageHeight={imageHeight}
                imageUploader={imageUploader}
                imageWidth={imageWidth}
                isPinturaEnabled={isPinturaEnabled}
                isResizeEnabled={isResizeEnabled}
                isSelected={isSelected}
                openImageEditor={openImageEditor}
                previewSrc={previewSrc}
                resizeConfig={resizeConfig}
                src={src}
                onDisplayWidthChange={onDisplayWidthChange}
                onFileChange={onFileChange}
                onResetDisplayWidth={onResetDisplayWidth}
            />
        );
    } else {
        return (
            <EmptyImageCard
                errors={imageUploader.errors}
                imageFileDragHandler={imageFileDragHandler}
                setFileInputRef={setFileInputRef}
                onFileChange={onFileChange}
            />
        );
    }
};

export function ImageCard({
    isSelected,
    src,
    onFileChange,
    captionEditor,
    captionEditorInitialState,
    altText,
    setAltText,
    setFigureRef,
    fileInputRef,
    cardWidth,
    previewSrc,
    imageUploader,
    imageCardDragHandler,
    imageFileDragHandler,
    isPinturaEnabled,
    openImageEditor,
    imageWidth,
    imageHeight,
    displayWidth,
    resizeConfig,
    isResizeEnabled,
    onDisplayWidthChange,
    onResetDisplayWidth
}) {
    const figureRef = React.useRef(null);
    const figureStyle = displayWidth ? {
        maxWidth: `${Math.round(displayWidth)}px`,
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto'
    } : undefined;

    React.useEffect(() => {
        if (setFigureRef) {
            setFigureRef(figureRef);
        }
    }, [figureRef, setFigureRef]);

    const setFileInputRef = (ref) => {
        if (fileInputRef) {
            fileInputRef.current = ref.current;
        }
    };
    return (
        <>
            <figure ref={figureRef} data-kg-card-width={cardWidth} style={figureStyle}>
                <ImageHolder
                    altText={altText}
                    displayWidth={displayWidth}
                    imageCardDragHandler={imageCardDragHandler}
                    imageFileDragHandler={imageFileDragHandler}
                    imageHeight={imageHeight}
                    imageUploader={imageUploader}
                    imageWidth={imageWidth}
                    isPinturaEnabled={isPinturaEnabled}
                    isResizeEnabled={isResizeEnabled}
                    isSelected={isSelected}
                    openImageEditor={openImageEditor}
                    previewSrc={previewSrc}
                    resizeConfig={resizeConfig}
                    setFileInputRef={setFileInputRef}
                    src={src}
                    onDisplayWidthChange={onDisplayWidthChange}
                    onFileChange={onFileChange}
                    onResetDisplayWidth={onResetDisplayWidth}
                />
                <CardCaptionEditor
                    altText={altText || ''}
                    altTextPlaceholder="Type alt text for image (optional)"
                    captionEditor={captionEditor}
                    captionEditorInitialState={captionEditorInitialState}
                    captionPlaceholder="Type caption for image (optional)"
                    dataTestId="image-caption-editor"
                    isSelected={isSelected}
                    readOnly={!isSelected}
                    setAltText={setAltText}
                />
            </figure>
        </>
    );
}

ImageHolder.propTypes = {
    src: PropTypes.string,
    altText: PropTypes.string,
    previewSrc: PropTypes.string,
    imageUploader: PropTypes.object,
    onFileChange: PropTypes.func,
    setFileInputRef: PropTypes.func,
    imageFileDragHandler: PropTypes.object,
    imageCardDragHandler: PropTypes.object,
    isPinturaEnabled: PropTypes.bool,
    openImageEditor: PropTypes.func,
    imageWidth: PropTypes.number,
    imageHeight: PropTypes.number,
    displayWidth: PropTypes.number,
    isSelected: PropTypes.bool,
    isResizeEnabled: PropTypes.bool,
    resizeConfig: PropTypes.object,
    onDisplayWidthChange: PropTypes.func,
    onResetDisplayWidth: PropTypes.func
};

PopulatedImageCard.propTypes = {
    src: PropTypes.string,
    alt: PropTypes.string,
    previewSrc: PropTypes.string,
    imageUploader: PropTypes.object,
    imageCardDragHandler: PropTypes.object,
    imageFileDragHandler: PropTypes.object,
    isPinturaEnabled: PropTypes.bool,
    openImageEditor: PropTypes.func,
    onFileChange: PropTypes.func,
    imageWidth: PropTypes.number,
    imageHeight: PropTypes.number,
    displayWidth: PropTypes.number,
    isSelected: PropTypes.bool,
    isResizeEnabled: PropTypes.bool,
    resizeConfig: PropTypes.object,
    onDisplayWidthChange: PropTypes.func,
    onResetDisplayWidth: PropTypes.func
};

EmptyImageCard.propTypes = {
    onFileChange: PropTypes.func,
    setFileInputRef: PropTypes.func,
    errors: PropTypes.array,
    imageFileDragHandler: PropTypes.object
};

ImageCard.propTypes = {
    isSelected: PropTypes.bool,
    src: PropTypes.string,
    onFileChange: PropTypes.func,
    captionEditor: PropTypes.object,
    captionEditorInitialState: PropTypes.object,
    altText: PropTypes.string,
    setAltText: PropTypes.func,
    setFigureRef: PropTypes.func,
    fileInputRef: PropTypes.object,
    cardWidth: PropTypes.string,
    previewSrc: PropTypes.string,
    imageUploader: PropTypes.object,
    imageFileDragHandler: PropTypes.object,
    imageCardDragHandler: PropTypes.object,
    isPinturaEnabled: PropTypes.bool,
    openImageEditor: PropTypes.func,
    imageWidth: PropTypes.number,
    imageHeight: PropTypes.number,
    displayWidth: PropTypes.number,
    resizeConfig: PropTypes.object,
    isResizeEnabled: PropTypes.bool,
    onDisplayWidthChange: PropTypes.func,
    onResetDisplayWidth: PropTypes.func
};
