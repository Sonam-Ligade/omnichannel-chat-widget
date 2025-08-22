export interface IFluentChatInputProps {
    // Core functionality
    onSubmitText: (value: string) => void;
    disabled?: boolean;
    maxLength?: number;
    placeholder?: string;
    
    // Input textbox props
    inputProps?: {
        autoFocus?: boolean;
        spellCheck?: boolean;
        ariaLabel?: string;
        ariaDescribedBy?: string;
    };
    
    // Send button props
    sendButtonProps?: {
        ariaLabel?: string;
        icon?: React.ReactNode;
        disabled?: boolean;
    };
    
    // Attachment button props
    attachmentButtonProps?: {
        ariaLabel?: string;
        icon?: React.ReactNode;
        disabled?: boolean;
        accept?: string;
        multiple?: boolean;
        maxSize?: number;
        onAttachmentClick?: () => void;
    };
    
    // Mic button props
    micButtonProps?: {
        ariaLabel?: string;
        icon?: React.ReactNode;
        disabled?: boolean;
        onMicClick?: () => void;
        enabled?: boolean;
    };
    
    // Styling
    styles?: React.CSSProperties;
    className?: string;
    
    // Features
    showAttachButton?: boolean;
    showMicButton?: boolean;
    
    // Attachment handling
    attachments?: JSX.Element | null;
    onFilesChange?: (files: File[]) => void;
    
    // Drag and drop
    enableDragDrop?: boolean;
    onDragEnter?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (files: File[]) => void;
    
    // Backward compatibility
    contentBefore?: JSX.Element | null;
}

// Backward compatibility mapper for existing WebChat sendbox props
export interface IWebChatSendboxProps {
    placeholder?: string;
    disabled?: boolean;
    sendBoxButtonProps?: {
        disabled?: boolean;
    };
    hideUploadButton?: boolean;
    accept?: string;
    multiple?: boolean;
}

export const mapWebChatPropsToFluentProps = (webChatProps: IWebChatSendboxProps): Partial<IFluentChatInputProps> => {
    return {
        placeholder: webChatProps.placeholder,
        disabled: webChatProps.disabled || webChatProps.sendBoxButtonProps?.disabled,
        showAttachButton: !webChatProps.hideUploadButton,
        attachmentButtonProps: {
            accept: webChatProps.accept,
            multiple: webChatProps.multiple,
        },
    };
};
