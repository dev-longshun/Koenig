import CardContext from '../context/CardContext';
import KoenigComposerContext from '../context/KoenigComposerContext';
import React from 'react';
import useCardDragAndDrop from '../hooks/useCardDragAndDrop';
import useFileDragAndDrop from '../hooks/useFileDragAndDrop';
import usePinturaEditor from '../hooks/usePinturaEditor';
import {$createGalleryNode} from './GalleryNode';
import {$createNodeSelection, $getNodeByKey, $setSelection} from 'lexical';
import {ActionToolbar} from '../components/ui/ActionToolbar';
import {CropModal} from '../components/ui/cards/CropModal';
import {ImageCard} from '../components/ui/cards/ImageCard';
import {ImageUploadForm} from '../components/ui/ImageUploadForm';
import {LinkInput} from '../components/ui/LinkInput';
import {SnippetActionToolbar} from '../components/ui/SnippetActionToolbar';
import {ToolbarMenu, ToolbarMenuItem, ToolbarMenuSeparator} from '../components/ui/ToolbarMenu';
import {dataSrcToFile} from '../utils/dataSrcToFile.js';
import {getAllowedImageCardWidths, getDefaultImageCardWidth} from '../utils/image-card-widths';
import {getImageDimensions} from '../utils/getImageDimensions.js';
import {getImageFilenameFromSrc} from '../utils/getImageFilenameFromSrc';
import {imageUploadHandler} from '../utils/imageUploadHandler';
import {isGif} from '../utils/isGif';
import {openFileSelection} from '../utils/openFileSelection';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';

const DEFAULT_IMAGE_CROP_CONFIG = {
    enabled: false,
    aspectRatios: [
        {label: 'Free', value: undefined},
        {label: '1:1', value: 1},
        {label: '4:3', value: 4 / 3},
        {label: '16:9', value: 16 / 9}
    ],
    maxWidth: 2400
};

const DEFAULT_IMAGE_RESIZE_CONFIG = {
    enabled: false,
    minWidth: 100,
    lockAspectRatio: true
};

export function ImageNodeComponent({nodeKey, initialFile, src, altText, captionEditor, captionEditorInitialState, triggerFileDialog, previewSrc, href, width, height, displayWidth}) {
    const [editor] = useLexicalComposerContext();
    const [showLink, setShowLink] = React.useState(false);
    const {fileUploader, cardConfig} = React.useContext(KoenigComposerContext);
    const {isSelected, cardWidth, setCardWidth} = React.useContext(CardContext);
    const fileInputRef = React.useRef();
    const toolbarFileInputRef = React.useRef();
    const [showSnippetToolbar, setShowSnippetToolbar] = React.useState(false);
    const [showCropModal, setShowCropModal] = React.useState(false);

    const imageUploader = fileUploader.useFileUpload('image');
    const imageFileDragHandler = useFileDragAndDrop({handleDrop: handleImageDrop});
    const imageCropConfig = React.useMemo(() => ({
        ...DEFAULT_IMAGE_CROP_CONFIG,
        ...cardConfig?.imageCrop
    }), [cardConfig?.imageCrop]);
    const imageResizeConfig = React.useMemo(() => ({
        ...DEFAULT_IMAGE_RESIZE_CONFIG,
        ...cardConfig?.imageResize
    }), [cardConfig?.imageResize]);
    const isImageCropEnabled = Boolean(imageCropConfig.enabled);
    const isImageResizeEnabled = Boolean(imageResizeConfig.enabled);

    // stable fn refs to avoid excessive re-inits of the drag/drop handler effects
    // which can cause unexpected side-effects with event handling
    const canDropImageCard = React.useCallback((draggable) => {
        return draggable.type === 'card'
            && draggable.cardName === 'image'
            && draggable.nodeKey !== nodeKey;
    }, [nodeKey]);
    const onDropImageCard = React.useCallback((draggable) => {
        const {type, cardName, nodeKey: draggedNodeKey, dataset} = draggable;

        if (type === 'card' && cardName === 'image' && draggedNodeKey && dataset) {
            editor.update(() => {
                const targetImageNode = $getNodeByKey(nodeKey);
                const droppedImageNode = $getNodeByKey(draggedNodeKey);
                const galleryNode = $createGalleryNode();

                // images don't contain the filename dataset property so we need to add it
                dataset.fileName = dataset?.fileName || getImageFilenameFromSrc(dataset.src);
                const targetImageDataset = targetImageNode.getDataset();
                targetImageDataset.fileName = targetImageDataset?.fileName || getImageFilenameFromSrc(targetImageDataset.src);

                galleryNode.addImages([targetImageDataset, dataset]);

                targetImageNode.replace(galleryNode);
                droppedImageNode.remove();
            });
        }
    }, [editor, nodeKey]);
    const imageCardDragHandler = useCardDragAndDrop({
        canDrop: canDropImageCard,
        onDrop: onDropImageCard
    });

    const {isEnabled: isPinturaEnabled, openEditor: openImageEditor}
        = usePinturaEditor({config: cardConfig?.pinturaConfig});
        
    const allowedImageCardWidths = React.useMemo(() => {
        return getAllowedImageCardWidths(cardConfig?.image?.allowedWidths);
    }, [cardConfig?.image?.allowedWidths]);
    const defaultImageCardWidth = React.useMemo(() => {
        return getDefaultImageCardWidth(allowedImageCardWidths);
    }, [allowedImageCardWidths]);
    const hasMultipleImageCardWidths = allowedImageCardWidths.length > 1;

    React.useEffect(() => {
        if (!src?.startsWith('data:') || imageUploader.isLoading) {
            return;
        }

        let isMounted = true;

        // When copy/pasting from Google Docs it's possible for images to be transferred with data: URLs.
        // Convert `data:` URL to File and upload it
        const uploadFile = async () => {
            const file = await dataSrcToFile(src);
            if (isMounted) {
                await imageUploadHandler([file], nodeKey, editor, imageUploader.upload);
            }
        };

        uploadFile();

        return () => isMounted = false;
    }, [editor, imageUploader.isLoading, imageUploader.upload, nodeKey, src]);

    React.useEffect(() => {
        // If an initial file is provided, upload it
        const uploadInitialFile = async (file) => {
            if (file && !src) {
                await imageUploadHandler([file], nodeKey, editor, imageUploader.upload);
            }
        };

        uploadInitialFile(initialFile);

        // Populate missing image dimensions, occurs when images are
        // pasted/dragged/inserted as external or when loaded from serialized
        // state that has missing images
        const populateImageDimensions = async () => {
            if (src && !initialFile && !triggerFileDialog) {
                const {width, height} = await getImageDimensions(src);
                editor.update(() => {
                    const node = $getNodeByKey(nodeKey);
                    node.width = width;
                    node.height = height;
                });
            }
        };

        const hasMissingDimensions = editor.getEditorState().read(() => {
            const node = $getNodeByKey(nodeKey);
            if (!node.width || !node.height) {
                return true;
            }
            return false;
        });

        if (hasMissingDimensions) {
            populateImageDimensions();
        }

        // We only do this for init
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onFileChange = async (e) => {
        const files = e.target.files;

        // reset original src so it can be replaced with preview and upload progress
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            node.src = '';
        });

        return await imageUploadHandler(files, nodeKey, editor, imageUploader.upload);
    };

    const setHref = (newHref) => {
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            node.href = newHref;
        });
    };

    const setAltText = (newAltText) => {
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            node.alt = newAltText;
        });
    };

    // when card is inserted from the card menu or slash command we want to show the file picker immediately
    // uses a setTimeout to avoid issues with React rendering the component twice in dev mode 🙈
    React.useEffect(() => {
        if (!triggerFileDialog) {
            return;
        }

        const renderTimeout = setTimeout(() => {
            // trigger dialog
            openFileSelection({fileInputRef});

            // clear the property on the node so we don't accidentally trigger anything with a re-render
            editor.update(() => {
                const node = $getNodeByKey(nodeKey);
                node.triggerFileDialog = false;
            });
        });

        return (() => {
            clearTimeout(renderTimeout);
        });
    });

    const handleImageCardResize = React.useCallback((newWidth) => {
        if (!allowedImageCardWidths.includes(newWidth)) {
            return;
        }

        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            node.cardWidth = newWidth; // this is a property on the node, not the card
            if (newWidth !== 'regular') {
                node.displayWidth = null;
            }
            setCardWidth(newWidth); // sets the state of the toolbar component
        });
    }, [allowedImageCardWidths, editor, nodeKey, setCardWidth]);

    const handleDisplayWidthChange = React.useCallback((newDisplayWidth) => {
        if (!Number.isFinite(newDisplayWidth)) {
            return;
        }

        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            node.cardWidth = 'regular';
            node.displayWidth = newDisplayWidth;
            setCardWidth('regular');
        });
    }, [editor, nodeKey, setCardWidth]);

    const handleResetDisplayWidth = React.useCallback(() => {
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            node.displayWidth = null;
        });
    }, [editor, nodeKey]);

    const handleStartResize = React.useCallback(() => {
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            node.cardWidth = 'regular';
            setCardWidth('regular');
        });
    }, [editor, nodeKey, setCardWidth]);

    const handleCropImage = React.useCallback(async (file) => {
        await imageUploadHandler([file], nodeKey, editor, imageUploader.upload);
        handleResetDisplayWidth();
    }, [editor, handleResetDisplayWidth, imageUploader.upload, nodeKey]);

    React.useEffect(() => {
        if (!allowedImageCardWidths.includes(cardWidth)) {
            handleImageCardResize(defaultImageCardWidth);
        }
    }, [allowedImageCardWidths, cardWidth, defaultImageCardWidth, handleImageCardResize]);

    const cancelLinkAndReselect = () => {
        setShowLink(false);
        reselectImageCard();
    };

    const reselectImageCard = () => {
        editor.update(() => {
            const nodeSelection = $createNodeSelection();
            nodeSelection.add(nodeKey);
            $setSelection(nodeSelection);
        });
    };

    async function handleImageDrop(files) {
        await imageUploadHandler(files, nodeKey, editor, imageUploader.upload);
    }

    return (
        <>
            <ImageCard
                altText={altText}
                captionEditor={captionEditor}
                captionEditorInitialState={captionEditorInitialState}
                cardWidth={cardWidth}
                displayWidth={displayWidth}
                fileInputRef={fileInputRef}
                imageCardDragHandler={imageCardDragHandler}
                imageFileDragHandler={imageFileDragHandler}
                imageHeight={height}
                imageUploader={imageUploader}
                imageWidth={width}
                isPinturaEnabled={isPinturaEnabled}
                isResizeEnabled={isImageResizeEnabled}
                isSelected={isSelected}
                openImageEditor={openImageEditor}
                previewSrc={previewSrc}
                resizeConfig={imageResizeConfig}
                setAltText={setAltText}
                src={src}
                onDisplayWidthChange={handleDisplayWidthChange}
                onFileChange={onFileChange}
                onResetDisplayWidth={handleResetDisplayWidth}
            />

            <CropModal
                altText={altText}
                aspectRatios={imageCropConfig.aspectRatios}
                isOpen={showCropModal && isImageCropEnabled}
                maxWidth={imageCropConfig.maxWidth}
                src={src}
                onClose={() => {
                    setShowCropModal(false);
                    reselectImageCard();
                }}
                onSave={handleCropImage}
            />

            <ActionToolbar
                data-kg-card-toolbar="image"
                isVisible={showLink}
            >
                <LinkInput
                    cancel={cancelLinkAndReselect}
                    href={href}
                    update={(_href) => {
                        setHref(_href);
                        cancelLinkAndReselect();
                    }}
                />
            </ActionToolbar>

            <ActionToolbar
                data-kg-card-toolbar="image"
                isVisible={showSnippetToolbar}
            >
                <SnippetActionToolbar onClose={() => setShowSnippetToolbar(false)} />
            </ActionToolbar>

            <ActionToolbar
                data-kg-card-toolbar="image"
                isVisible={src && isSelected && !showLink && !showSnippetToolbar}
            >
                <ImageUploadForm
                    fileInputRef={toolbarFileInputRef}
                    mimeTypes={fileUploader.fileTypes.image?.mimeTypes}
                    onFileChange={onFileChange}
                />
                <ToolbarMenu>
                    <ToolbarMenuItem
                        hide={isGif(src) || !hasMultipleImageCardWidths || !allowedImageCardWidths.includes('regular')}
                        icon="imgRegular"
                        isActive={cardWidth === 'regular'}
                        label="Regular width"
                        onClick={() => handleImageCardResize('regular')}
                    />
                    <ToolbarMenuItem
                        hide={isGif(src) || !hasMultipleImageCardWidths || !allowedImageCardWidths.includes('wide')}
                        icon="imgWide"
                        isActive={cardWidth === 'wide'}
                        label="Wide width"
                        onClick={() => handleImageCardResize('wide')}
                    />
                    <ToolbarMenuItem
                        hide={isGif(src) || !hasMultipleImageCardWidths || !allowedImageCardWidths.includes('full')}
                        icon="imgFull"
                        isActive={cardWidth === 'full'}
                        label="Full width"
                        onClick={() => handleImageCardResize('full')}
                    />
                    <ToolbarMenuSeparator hide={isGif(src) || !hasMultipleImageCardWidths} />
                    <ToolbarMenuItem
                        dataTestId="crop-image"
                        hide={!isImageCropEnabled || isGif(src)}
                        icon="crop"
                        isActive={showCropModal}
                        label="Crop"
                        onClick={() => setShowCropModal(true)}
                    />
                    <ToolbarMenuItem
                        dataTestId="resize-image"
                        hide={!isImageResizeEnabled || isGif(src)}
                        icon="resize"
                        isActive={Boolean(displayWidth)}
                        label="Resize"
                        onClick={handleStartResize}
                    />
                    <ToolbarMenuItem
                        dataTestId="restore-image-size"
                        hide={!isImageResizeEnabled || !displayWidth || isGif(src)}
                        icon="restore"
                        isActive={false}
                        label="Restore size"
                        onClick={handleResetDisplayWidth}
                    />
                    <ToolbarMenuSeparator hide={(!isImageCropEnabled && !isImageResizeEnabled) || isGif(src)} />
                    <ToolbarMenuItem icon="link" isActive={href || false} label="Link" onClick = {() => {
                        setShowLink(true);
                    }} />
                    <ToolbarMenuSeparator hide={!cardConfig?.createSnippet} />
                    <ToolbarMenuItem
                        dataTestId="create-snippet"
                        hide={!cardConfig?.createSnippet}
                        icon="snippet"
                        isActive={false}
                        label="Save as snippet"
                        onClick={() => setShowSnippetToolbar(true)}
                    />
                </ToolbarMenu>
            </ActionToolbar>
        </>
    );
}
