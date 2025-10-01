import { IChatInputStyleProps } from "../../interfaces/IChatInputStyleProps";

/**
 * Generates CSS rules for the attachment (upload) button based on a subset of Web Chat style options.
 */
export function createChatInputUploadButtonStyles(styleProps: IChatInputStyleProps): string {
    const {
        sendBoxButtonColor,
        sendBoxButtonColorOnHover,
        sendBoxButtonColorOnFocus,
        sendBoxButtonColorOnDisabled
    } = styleProps;

    // If none provided, skip.
    if (!sendBoxButtonColor && !sendBoxButtonColorOnHover && !sendBoxButtonColorOnFocus && !sendBoxButtonColorOnDisabled) {
        return "";
    }

    let css = "";
    const baseSelector = ".fai-ChatInput__attachmentButton";

    // Base size and icon color
    css += `${baseSelector} { 
        width: 40px !important; 
        height: 40px !important;
        box-sizing: border-box !important;
    }\n`;
    
    // Ensure icon container maintains proper dimensions
    css += `${baseSelector} .fui-Button__icon { 
        width: 24px !important; 
        height: 24px !important; 
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    }\n`;
    
    // Apply icon colors
    if (sendBoxButtonColor) {
        css += `${baseSelector} svg, ${baseSelector} svg path, ${baseSelector} .fui-Button__icon svg, ${baseSelector} .fui-Button__icon svg path { fill: ${sendBoxButtonColor} !important; }\n`;
    }

    // Disabled state
    if (sendBoxButtonColorOnDisabled) {
        css += `${baseSelector}:disabled svg, ${baseSelector}[aria-disabled="true"] svg, ${baseSelector}:disabled svg path, ${baseSelector}[aria-disabled="true"] svg path, ${baseSelector}:disabled .fui-Button__icon svg, ${baseSelector}[aria-disabled="true"] .fui-Button__icon svg, ${baseSelector}:disabled .fui-Button__icon svg path, ${baseSelector}[aria-disabled="true"] .fui-Button__icon svg path { fill: ${sendBoxButtonColorOnDisabled} !important; }\n`;
    }

    // Default background on hover
    css += `${baseSelector}:not(:disabled):not([aria-disabled="true"]):hover { background-color: #f3f2f1 !important; }\n`;
    
    // Hover
    if (sendBoxButtonColorOnHover) {
        css += `${baseSelector}:not(:disabled):not([aria-disabled="true"]):hover svg, ${baseSelector}:not(:disabled):not([aria-disabled="true"]):hover svg path, ${baseSelector}:not(:disabled):not([aria-disabled="true"]):hover .fui-Button__icon svg, ${baseSelector}:not(:disabled):not([aria-disabled="true"]):hover .fui-Button__icon svg path { fill: ${sendBoxButtonColorOnHover} !important; }\n`;
    }

    // Focus
    if (sendBoxButtonColorOnFocus) {
        css += `${baseSelector}:focus svg, ${baseSelector}[data-fui-focus-visible] svg, ${baseSelector}:focus svg path, ${baseSelector}[data-fui-focus-visible] svg path, ${baseSelector}:focus .fui-Button__icon svg, ${baseSelector}[data-fui-focus-visible] .fui-Button__icon svg, ${baseSelector}:focus .fui-Button__icon svg path, ${baseSelector}[data-fui-focus-visible] .fui-Button__icon svg path {
            fill: ${sendBoxButtonColorOnFocus} !important;
        }\n`;
    }

    return css.trim();
}