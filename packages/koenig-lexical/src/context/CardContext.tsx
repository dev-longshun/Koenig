import React from 'react';

export interface CardContextType {
    isSelected: boolean;
    captionHasFocus: boolean | null;
    isEditing: boolean;
    cardWidth: string;
    setCardWidth: (width: string) => void;
    setCaptionHasFocus: (hasFocus: boolean | null) => void;
    setEditing: (editing: boolean) => void;
    nodeKey: string;
    cardContainerRef: React.RefObject<HTMLDivElement | null>;
}

const noop = () => {};

const CardContext = React.createContext<CardContextType>({
    isSelected: false,
    captionHasFocus: null,
    isEditing: false,
    cardWidth: '',
    setCardWidth: noop,
    setCaptionHasFocus: noop,
    setEditing: noop,
    nodeKey: '',
    cardContainerRef: React.createRef<HTMLDivElement>()
});

export default CardContext;
