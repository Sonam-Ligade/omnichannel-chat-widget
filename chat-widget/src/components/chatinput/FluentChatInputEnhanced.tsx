import React, { useEffect, useState, useCallback } from "react";
import { Button, webLightTheme } from "@fluentui/react-components";
import { ChatInput } from "@fluentui-copilot/react-chat-input";
import { Add20Regular, Add24Regular } from "@fluentui/react-icons";
import {
    CopilotMode,
    CopilotProvider,
    DesignVersion,
    useCopilotMode,
    useDesignVersion,
} from "@fluentui-copilot/react-provider";
import { CopilotTheme } from "@fluentui-copilot/react-copilot";
import { IFluentChatInputProps } from "./interfaces/IFluentChatInputProps";

function FluentChatInputInternal(props: IFluentChatInputProps) {
    // const mode = useCopilotMode();
    // const designVersion = useDesignVersion();
    const mode: CopilotMode["mode"] = useCopilotMode();
    const designVersion: DesignVersion["designVersion"] = useDesignVersion();
    const [isDragOver, setIsDragOver] = useState(false);

    // Issue 5: Drag and drop handlers
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (props.enableDragDrop && e.dataTransfer.types.includes("Files")) {
            setIsDragOver(true);
            props.onDragEnter?.(e);
        }
    }, [props]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (props.enableDragDrop) {
            setIsDragOver(false);
            props.onDragLeave?.(e);
        }
    }, [props]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDropFiles = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (props.enableDragDrop) {
            setIsDragOver(false);
            const files = Array.from(e.dataTransfer.files);
            props.onDrop?.(files);
            props.onFilesChange?.(files);
        }
    }, [props]);

    const renderDefaultContentBefore = (): JSX.Element | null => {
        const hideAttachmentButton = !props.showAttachButton;

        if (hideAttachmentButton) return null;

        const attachmentProps = props.attachmentButtonProps || {};
        
        const common = {
            "aria-label": attachmentProps.ariaLabel || "Add attachment",
            shape: "circular" as const,
            appearance: "transparent" as const,
            onClick: attachmentProps.onAttachmentClick,
            disabled: props.disabled || attachmentProps.disabled || false
        };

        if (designVersion === "next") {
            if (mode === "sidecar") {
                return <Button {...common} icon={<Add20Regular />} />;
            }
            
        }
        return <Button {...common} size="large" icon={<Add24Regular />} />;
    };

    const handleSubmit = (_e: React.FormEvent, data: { value: string }) => {
        props.onSubmitText?.(data.value);
        // Issue 1: Let ChatInput handle clearing naturally
        // The ChatInput component should clear itself after successful submit
    };

    const maxLength = props.maxLength ?? 20;
    const contentBefore: JSX.Element | null = props.contentBefore ?? renderDefaultContentBefore();
    const attachmentsEl: JSX.Element | null = props.attachments ?? null;

    // Issue 5: Drag over visual feedback
    const dragOverlayStyle: React.CSSProperties = isDragOver ? {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 120, 212, 0.1)",
        border: "2px dashed #0078d4",
        borderRadius: 4,
        pointerEvents: "none",
        zIndex: 10
    } : {};

    return (
        <div
            onDragEnter={props.enableDragDrop ? handleDragEnter : undefined}
            onDragLeave={props.enableDragDrop ? handleDragLeave : undefined}
            onDragOver={props.enableDragDrop ? handleDragOver : undefined}
            onDrop={props.enableDragDrop ? handleDropFiles : undefined}
            style={{ position: "relative", padding: 0, backgroundColor: "transparent", ...props.styles }}
            className={props.className}
        >
            {isDragOver && <div style={dragOverlayStyle} />}
            <ChatInput
                contentBefore={contentBefore ?? undefined}
                attachments={attachmentsEl ?? undefined}
                aria-label={props.inputProps?.ariaLabel || "Copilot Chat"}
                placeholderValue={props.placeholder ?? "Type a message..."}
                onSubmit={handleSubmit}
                disabled={props.disabled ?? false}
                className="ai-fluent-chat-input"
                style={{ 
                    borderRadius: 0,
                    padding: 0
                }}
                // maxLength={20}
                // showCount
                characterLimitErrorMessage="Character limit exceeded"
                charactersRemainingMessage={(remaining: number) => `${remaining} characters remaining`}
                appearance="responsive"
                disableSend={props.sendButtonProps?.disabled || false}

            />
        </div>
    );
}

// Inject minimal CSS at runtime so builds that reference lib/* don't require copying CSS files.
function InjectChatInputStyles() {
    useEffect(() => {
        if (typeof document === "undefined") return;
        if (document.getElementById("ai-fluent-chat-input-styles")) return;
        const style = document.createElement("style");
        style.id = "ai-fluent-chat-input-styles";
        style.innerHTML = `
            /* Issue 3: Complete border radius removal */
            .ai-fluent-chat-input,
            .ai-fluent-chat-input *,
            .ai-fluent-chat-input input, 
            .ai-fluent-chat-input textarea,
            .ai-fluent-chat-input .fui-Input,
            .ai-fluent-chat-input .fui-Input__input,
            .ai-fluent-chat-input .fui-ChatInput,
            .ai-fluent-chat-input .fui-ChatInput__root,
            .ai-fluent-chat-input .fui-Field,
            .ai-fluent-chat-input .fui-Field__root { 
                border-radius: 0 !important; 
                padding: 0 !important;
                background-color: #ffffff !important; 
            }
            /* Issue 2: Send button should be rounded */
            .ai-fluent-chat-input button[type="submit"],
            .ai-fluent-chat-input button[aria-label*="Send"],
            .ai-fluent-chat-input button[data-testid*="send"] {
                border-radius: 50% !important;
            }
            /* Issue 4: Remove typing effect at bottom and validation */
            .ai-fluent-chat-input .fui-Field__validationMessage,
            .ai-fluent-chat-input .fui-Field__hint,
            .ai-fluent-chat-input .fui-Input__contentAfter,
            .ai-fluent-chat-input .fui-Field__description,
            .ai-fluent-chat-input .fui-ChatInput__validation,
            .ai-fluent-chat-input .fui-ChatInput__hint {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }, []);
    return null;
}

function InjectChatInputWrapperStyles() {
    useEffect(() => {
        if (typeof document === "undefined") return;
        if (document.getElementById("ai-fluent-chat-input-wrapper-styles")) return;
        const style = document.createElement("style");
        style.id = "ai-fluent-chat-input-wrapper-styles";
        style.innerHTML = `
            .fai-ChatInput__inputWrapper { 
                border-radius: 0 !important;
            }
        `;
        document.head.appendChild(style);
    }, []);
    return null;
}

function FluentChatInput(props: IFluentChatInputProps) {
    return (
        <CopilotProvider {...CopilotTheme} theme={webLightTheme}>
            <InjectChatInputWrapperStyles />
            <FluentChatInputInternal {...props} />
        </CopilotProvider>
    );
}

export default FluentChatInput;
export { FluentChatInput };
