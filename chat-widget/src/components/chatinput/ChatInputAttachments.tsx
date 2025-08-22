import React from "react";
import { 
    Attachment, 
    AttachmentList, 
    AttachmentOverflowMenuButton 
} from "@fluentui-copilot/react-attachments";
import { 
    Document20Filled, 
    DocumentPdf20Filled, 
    Image20Filled, 
    Video20Filled,
    Archive20Filled,
    DocumentData20Filled 
} from "@fluentui/react-icons";
import type { AttachmentListProps } from "@fluentui-copilot/react-attachments";

export type WebChatAttachment = Readonly<{ blob: File | Blob; thumbnailURL?: URL }>;

type Props = {
  attachments: ReadonlyArray<WebChatAttachment>;
  onRemove: (index: number) => void;
  maxVisibleAttachments?: number;
};

const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split(".").pop() || "";
    
    switch (ext) {
        case "pdf":
            return <DocumentPdf20Filled style={{ color: "#D32F2F" }} />;
        case "doc":
        case "docx":
        case "txt":
        case "rtf":
            return <Document20Filled style={{ color: "#2E7D32" }} />;
        case "jpg":
        case "jpeg":
        case "png":
        case "gif":
        case "bmp":
        case "svg":
            return <Image20Filled style={{ color: "#1976D2" }} />;
        case "mp4":
        case "avi":
        case "mov":
        case "wmv":
        case "flv":
            return <Video20Filled style={{ color: "#7B1FA2" }} />;
        case "zip":
        case "rar":
        case "7z":
        case "tar":
            return <Archive20Filled style={{ color: "#F57C00" }} />;
        case "xls":
        case "xlsx":
        case "csv":
            return <DocumentData20Filled style={{ color: "#388E3C" }} />;
        default:
            return <Document20Filled style={{ color: "#616161" }} />;
    }
};

const ChatInputAttachments: React.FC<Props> = ({ 
    attachments, 
    onRemove, 
    maxVisibleAttachments = 3 
}) => {
    // Handle dismiss using the built-in onAttachmentDismiss
    const handleDismiss: AttachmentListProps["onAttachmentDismiss"] = (_, data) => {
        // Find the attachment index by the id
        const index = attachments.findIndex((_, i) => {
            const file = attachments[i].blob as File | undefined;
            const name = file?.name ?? `file-${i + 1}`;
            const id = `${i}-${name}`;
            return id === data.id;
        });
        
        if (index >= 0) {
            console.log(`Removing attachment at index ${index}`);
            onRemove(index);
        }
    };

    // Return null if no attachments
    if (attachments.length === 0) {
        return null;
    }

    return (
        <AttachmentList
            onAttachmentDismiss={handleDismiss}
            maxVisibleAttachments={maxVisibleAttachments}
            overflowMenuButton={
                <AttachmentOverflowMenuButton 
                    aria-label="View and remove additional attachments" 
                />
            }
        >
            {attachments.map((attachment, index) => {
                const file = attachment.blob as File | undefined;
                const name = file?.name ?? `file-${index + 1}`;
                const id = `${index}-${name}`;

                return (
                    <Attachment 
                        id={id} 
                        key={id} 
                        media={getFileIcon(name)}
                        // style={{ 
                        //     minWidth: "120px", 
                        //     fontSize: "12px" 
                        // }}
                        size="small"
                        progress={{ value: undefined }}
                        dismissButton={undefined}
                        imageOnly={false}
                    >
                        {name}
                    </Attachment>
                );
            })}
        </AttachmentList>
    );
};

export default ChatInputAttachments;