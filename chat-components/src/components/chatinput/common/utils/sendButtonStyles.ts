import { IChatInputStyleProps } from "../../interfaces/IChatInputStyleProps";

// helper to keep CSS string-building terse and consistent
const toPx = (value?: string | number): string | undefined =>
    value === undefined ? undefined : typeof value === "number" ? `${value}px` : String(value);

const ruleWithFillAndShade = (
    selector: string,
    backgroundColor?: string,
    shade?: string,
    insetPx?: string,
    extra?: string
): string => {
    if (!backgroundColor && !shade && !extra) return "";
    let r = `${selector} {`;
    if (backgroundColor) r += ` background-color: ${backgroundColor} !important;`;
    
    // insetPx as ring thickness now (previously was x/y offset creating a bevel on top/left).
    if (shade) {
        if (insetPx && insetPx !== "0px") {
            r += ` box-shadow: inset 0 0 0 ${insetPx} ${shade} !important;`;
        } else {
            // No thickness specified -> fallback to a subtle 1px ring
            r += ` box-shadow: inset 0 0 0 1px ${shade} !important;`;
        }
    }
    if (extra) r += ` ${extra}`;
    r += " }\n";
    return r;
};

export const createChatInputSendButtonStyle = (styleProps: IChatInputStyleProps): string => {
    const {
        sendBoxButtonColor,
        sendBoxButtonColorOnActive,
        sendBoxButtonColorOnDisabled,
        sendBoxButtonColorOnFocus,
        sendBoxButtonColorOnHover,
        sendBoxButtonShadeColor,
        sendBoxButtonShadeColorOnActive,
        sendBoxButtonShadeColorOnDisabled,
        sendBoxButtonShadeColorOnFocus,
        sendBoxButtonShadeColorOnHover,
        sendBoxButtonShadeBorderRadius,
        sendBoxButtonShadeInset,
        sendBoxButtonKeyboardFocusIndicatorBorderColor,
        sendBoxButtonKeyboardFocusIndicatorBorderRadius,
        sendBoxButtonKeyboardFocusIndicatorBorderStyle,
        sendBoxButtonKeyboardFocusIndicatorBorderWidth,
        sendBoxButtonKeyboardFocusIndicatorInset
    } = styleProps;

    const inset = toPx(sendBoxButtonShadeInset) ?? "0px";
    let css = "";

    // Handle background colors and shades (separate from icon colors)
    const baseExtra = sendBoxButtonShadeBorderRadius !== undefined
        ? ` border-radius: ${toPx(sendBoxButtonShadeBorderRadius)} !important;`
        : " border-radius: inherit !important;";
    css += ruleWithFillAndShade(
        ".fai-SendButton .fai-SendButton__stopBackground",
        undefined,
        sendBoxButtonShadeColor,
        inset,
        baseExtra
    );

    // Disabled > Active > Hover > Focus
    css += ruleWithFillAndShade(
        ".fai-SendButton:disabled .fai-SendButton__stopBackground, .fai-SendButton[aria-disabled=\"true\"] .fai-SendButton__stopBackground",
        undefined,
        sendBoxButtonShadeColorOnDisabled,
        inset
    );

    css += ruleWithFillAndShade(
        ".fai-SendButton:not(:disabled):not([aria-disabled=\"true\"]):active .fai-SendButton__stopBackground",
        undefined,
        sendBoxButtonShadeColorOnActive,
        inset
    );

    css += ruleWithFillAndShade(
        ".fai-SendButton:not(:disabled):not([aria-disabled=\"true\"]):not(:active):hover .fai-SendButton__stopBackground",
        undefined,
        sendBoxButtonShadeColorOnHover,
        inset
    );

    css += ruleWithFillAndShade(
        ".fai-SendButton:not(:disabled):not([aria-disabled=\"true\"]):focus .fai-SendButton__stopBackground, .fai-SendButton[data-fui-focus-visible] .fai-SendButton__stopBackground, .fai-SendButton:focus .fai-SendButton__stopBackground",
        undefined,
        sendBoxButtonShadeColorOnFocus,
        inset
    );

    // Apply send button icon colors
    if (sendBoxButtonColor) {
        css += `.fai-SendButton svg, .fai-SendButton svg path, .fai-SendButton .fai-SendButton__sendIcon svg, .fai-SendButton .fai-SendButton__sendIcon svg path { fill: ${sendBoxButtonColor} !important; }\n`;
    }
    
    if (sendBoxButtonColorOnDisabled) {
        css += `.fai-SendButton:disabled svg, .fai-SendButton[aria-disabled="true"] svg, .fai-SendButton:disabled svg path, .fai-SendButton[aria-disabled="true"] svg path, .fai-SendButton:disabled .fai-SendButton__sendIcon svg, .fai-SendButton[aria-disabled="true"] .fai-SendButton__sendIcon svg, .fai-SendButton:disabled .fai-SendButton__sendIcon svg path, .fai-SendButton[aria-disabled="true"] .fai-SendButton__sendIcon svg path { fill: ${sendBoxButtonColorOnDisabled} !important; }\n`;
    }
    
    if (sendBoxButtonColorOnActive) {
        css += `.fai-SendButton:not(:disabled):not([aria-disabled="true"]):active svg, .fai-SendButton:not(:disabled):not([aria-disabled="true"]):active svg path, .fai-SendButton:not(:disabled):not([aria-disabled="true"]):active .fai-SendButton__sendIcon svg, .fai-SendButton:not(:disabled):not([aria-disabled="true"]):active .fai-SendButton__sendIcon svg path { fill: ${sendBoxButtonColorOnActive} !important; }\n`;
    }
    
    // Default background on hover
    css += ".fai-SendButton:not(:disabled):not([aria-disabled=\"true\"]):not(:active):hover { background-color: #f3f2f1 !important; }\n";
    
    if (sendBoxButtonColorOnHover) {
        css += `.fai-SendButton:not(:disabled):not([aria-disabled="true"]):not(:active):hover svg, .fai-SendButton:not(:disabled):not([aria-disabled="true"]):not(:active):hover svg path, .fai-SendButton:not(:disabled):not([aria-disabled="true"]):not(:active):hover .fai-SendButton__sendIcon svg, .fai-SendButton:not(:disabled):not([aria-disabled="true"]):not(:active):hover .fai-SendButton__sendIcon svg path { fill: ${sendBoxButtonColorOnHover} !important; }\n`;
    }
    
    if (sendBoxButtonColorOnFocus) {
        css += `.fai-SendButton:not(:disabled):not([aria-disabled="true"]):focus svg, .fai-SendButton[data-fui-focus-visible] svg, .fai-SendButton:not(:disabled):not([aria-disabled="true"]):focus svg path, .fai-SendButton[data-fui-focus-visible] svg path, .fai-SendButton:not(:disabled):not([aria-disabled="true"]):focus .fai-SendButton__sendIcon svg, .fai-SendButton[data-fui-focus-visible] .fai-SendButton__sendIcon svg, .fai-SendButton:not(:disabled):not([aria-disabled="true"]):focus .fai-SendButton__sendIcon svg path, .fai-SendButton[data-fui-focus-visible] .fai-SendButton__sendIcon svg path { fill: ${sendBoxButtonColorOnFocus} !important; }\n`;
    }

    // Keyboard focus indicator
    if (
        sendBoxButtonKeyboardFocusIndicatorBorderColor ||
    sendBoxButtonKeyboardFocusIndicatorBorderRadius ||
    sendBoxButtonKeyboardFocusIndicatorBorderStyle ||
    sendBoxButtonKeyboardFocusIndicatorBorderWidth ||
    sendBoxButtonKeyboardFocusIndicatorInset
    ) {
        const color = sendBoxButtonKeyboardFocusIndicatorBorderColor ?? "currentColor";
        const style = sendBoxButtonKeyboardFocusIndicatorBorderStyle ?? "solid";
        const width = toPx(sendBoxButtonKeyboardFocusIndicatorBorderWidth) ?? "2px";
        let extra = ` outline: ${width} ${style} ${color} !important;`;
        if (sendBoxButtonKeyboardFocusIndicatorBorderRadius) {
            extra += ` border-radius: ${toPx(sendBoxButtonKeyboardFocusIndicatorBorderRadius)} !important;`;
        }
        if (sendBoxButtonKeyboardFocusIndicatorInset) {
            extra += ` outline-offset: ${toPx(sendBoxButtonKeyboardFocusIndicatorInset)} !important;`;
        }
       
        css += ruleWithFillAndShade(
            ".fai-SendButton[data-fui-focus-visible], .fai-SendButton:not(:active):not(:hover):focus",
            undefined,
            undefined,
            inset,
            extra
        );

        css += ".fai-SendButton[data-fui-focus-visible], .fai-SendButton:focus { outline: none !important; box-shadow: none !important; border: none !important; }\n";
        css += ".fai-SendButton:focus-within { outline: none !important; border: none !important; box-shadow: none !important; }\n";
    }

    return css.trim();
};