import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { LogLevel, TelemetryEvent } from "../../common/telemetry/TelemetryConstants";
import { TelemetryHelper } from "../../common/telemetry/TelemetryHelper";
import { ITimer } from "../../common/interfaces/ITimer";
import { createTimer } from "../../common/utils";
import FluentChatInput from "./FluentChatInputEnhanced";
import { hooks as WebChatHooks } from "botframework-webchat";
import ChatInputAttachments from "./ChatInputAttachments";
import { IFluentChatInputProps } from "./interfaces/IFluentChatInputProps";
import useChatContextStore from "../../hooks/useChatContextStore";
import { ConversationState } from "../../contexts/common/ConversationState";

let uiTimer: ITimer;

type Props = {
    disabled?: boolean;
    maxLength?: number;
    // Optionally allow parent to override accept attribute for file picking
    accept?: string;
    placeholder?: string;
    // Enhanced props
    enableDragDrop?: boolean;
    showAttachButton?: boolean;
    showMicButton?: boolean;
    // Backward compatibility
    hideUploadButton?: boolean;
    sendBoxButtonProps?: {
        disabled?: boolean;
    };
    // Styling
    styles?: React.CSSProperties;
    className?: string;
};

const AIFluentSendboxStateful: React.FC<Props> = (props) => {
    // Widget context for hide logic
    const [widgetState] = useChatContextStore();
    const sendMessage = WebChatHooks.useSendMessage();
    // const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    // Use Web Chat's send box attachments as source of truth
    const [wcAttachments, setWCAttachments] = WebChatHooks.useSendBoxAttachments();

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const accept = useMemo(() => props.accept ?? "*", [props.accept]);

    useEffect(() => {
        uiTimer = createTimer();
        TelemetryHelper.logLoadingEvent(LogLevel.INFO, { Event: TelemetryEvent.UXFooterStart });
    }, []);

    useEffect(() => {
        TelemetryHelper.logLoadingEvent(LogLevel.INFO, {
            Event: TelemetryEvent.UXFooterCompleted,
            ElapsedTimeInMilliseconds: uiTimer.milliSecondsElapsed
        });
    }, []);

    const onAttachmentClick = () => fileInputRef.current?.click();

    // Validation configuration (could be externalized later)
    const MAX_FILES = 10;
    const MAX_FILE_SIZE_MB = 25; // example cap
    const acceptTypes = (props.accept || "").split(",").map(t => t.trim()).filter(Boolean);

    const [liveRegionMsg, setLiveRegionMsg] = useState("");

    interface EnrichedAttachment { blob: File | Blob; name?: string; contentType?: string; thumbnailURL?: URL }

    const validateAndAddFiles = (files: File[]) => {
        if (!files.length) return;
        const current = wcAttachments || [];
        const remainingSlots = MAX_FILES - current.length;
        const slice = files.slice(0, remainingSlots);
        const accepted: EnrichedAttachment[] = [];
        let rejectedCount = 0;
        slice.forEach(f => {
            const sizeOk = (f.size / (1024 * 1024)) <= MAX_FILE_SIZE_MB;
            const typeOk = acceptTypes.length === 0 || acceptTypes.some(a => f.type.includes(a) || f.name.endsWith(a.replace("*","")));
            if (sizeOk && typeOk) {
                accepted.push(Object.freeze({ blob: f as Blob, name: f.name, contentType: f.type }));
            } else {
                rejectedCount++;
            }
        });
        if (accepted.length) {
            const merged: EnrichedAttachment[] = [...(current as unknown as EnrichedAttachment[]), ...accepted];
            // WebChat's hook type is broader; cast to its expected readonly shape
            type WebChatAttachmentInternal = { blob: File | Blob; name?: string; contentType?: string; thumbnailURL?: URL };
            setWCAttachments(merged as unknown as ReadonlyArray<WebChatAttachmentInternal>);
            setLiveRegionMsg(`${accepted.length} file${accepted.length>1?"s":""} added`);
        }
        if (rejectedCount) {
            setLiveRegionMsg(`${rejectedCount} file${rejectedCount>1?"s":""} rejected`);
        }
    };

    const onFilesPicked = (files: FileList | null) => {
        if (!files?.length) return;
        validateAndAddFiles(Array.from(files));
        // reset input value so picking the same file again still triggers change
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeAttachmentAt = (index: number) => {
        const next = (wcAttachments || []).filter((_, i) => i !== index);
        setWCAttachments(next);
        setLiveRegionMsg("Attachment removed");
    };

    const onSubmitText = (value: string) => {
        const text = value?.trim();
        // Ensure name/contentType fields for WebChat & transcripts
        const attachments = (wcAttachments || []).map(att => {
            const a = att as EnrichedAttachment;
            const f = a.blob as File | undefined;
            return {
                ...a,
                name: a.name || f?.name,
                contentType: a.contentType || f?.type || "application/octet-stream"
            };
        });
        // Either text or attachments must be provided
        if (!text && attachments.length === 0) return;

        sendMessage(text || undefined, undefined, { attachments });
        setWCAttachments([]);
        setLiveRegionMsg("Message sent");
    };

    // const accept = useMemo(() => props.accept ?? "*", [props.accept]);

    const attachmentsNode = (
        <ChatInputAttachments
            attachments={wcAttachments || []}
            onRemove={removeAttachmentAt}
            maxVisibleAttachments={2}
        />
    );

    const onFilesDropped = useCallback((files: File[]) => {
        validateAndAddFiles(files);
    }, [wcAttachments]);

    // Map props to enhanced interface for backward compatibility
    const fluentProps: IFluentChatInputProps = {
        disabled: props.disabled || props.sendBoxButtonProps?.disabled,
        maxLength: props.maxLength ?? 500,
        placeholder: props.placeholder,
        onSubmitText,
        showAttachButton: !props.hideUploadButton && (props.showAttachButton !== false),
        showMicButton: props.showMicButton,
        enableDragDrop: props.enableDragDrop,
        onDrop: onFilesDropped,
        onFilesChange: onFilesDropped,
        attachmentButtonProps: {
            ariaLabel: "Add attachment",
            accept: props.accept,
            multiple: true,
            onAttachmentClick: onAttachmentClick,
        },
        attachments: attachmentsNode,
        styles: props.styles,
        className: props.className,
    };

    // Hide logic: follow existing widget state rules (active only)
    const conversationState = widgetState.appStates.conversationState;
    const isMinimized = widgetState.appStates.isMinimized;
    const shouldShowSendbox = !isMinimized && conversationState === ConversationState.Active;
    if (!shouldShowSendbox) {
        return null;
    }

    return (
        <div style={{ width: "100%", boxSizing: "border-box", position: "relative", backgroundColor: "transparent", padding: 0 }}>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={accept}
                style={{ display: "none" }}
                onChange={(e) => onFilesPicked(e.target.files)}
            />
            <FluentChatInput {...fluentProps} />
            <div aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{liveRegionMsg}</div>
        </div>
    );
};

export default AIFluentSendboxStateful;
export { AIFluentSendboxStateful };

// <div style={{ width: "100%", backgroundColor: "transparent", boxSizing: "border-box" }}>
