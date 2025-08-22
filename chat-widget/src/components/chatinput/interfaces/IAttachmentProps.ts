export interface IAttachmentProps {
    // File restrictions
    acceptedFileTypes?: string[];
    maxFileSize?: number;
    maxFiles?: number;
    
    // UI customization
    attachmentIconRenderer?: (file: File) => React.ReactNode;
    attachmentPreviewRenderer?: (file: File) => React.ReactNode;
    
    // Callbacks
    onAttachmentAdd?: (files: File[]) => void;
    onAttachmentRemove?: (index: number) => void;
    onAttachmentError?: (error: Error) => void;
    
    // Backward compatibility with WebChat
    accept?: string;
    multiple?: boolean;
    disabled?: boolean;
}

// Enhanced attachment component props
export interface IChatInputAttachmentsProps {
    attachments: ReadonlyArray<{ blob: File | Blob; thumbnailURL?: URL }>;
    onRemove: (index: number) => void;
    maxVisibleAttachments?: number;
    
    // Enhanced features
    showFileSize?: boolean;
    showFileType?: boolean;
    allowPreview?: boolean;
    
    // Styling
    className?: string;
    styles?: React.CSSProperties;
}

// Backward compatibility mapper for WebChat attachment props
export const mapWebChatAttachmentProps = (legacyProps: { accept?: string; multiple?: boolean; disabled?: boolean }): Partial<IAttachmentProps> => {
    return {
        acceptedFileTypes: legacyProps.accept?.split(","),
        maxFiles: legacyProps.multiple ? 10 : 1,
        disabled: legacyProps.disabled,
        accept: legacyProps.accept,
        multiple: legacyProps.multiple,
    };
};
