export interface IConfirmationPaneControlProps {
    id?: string;
    dir?: "ltr" | "rtl" | "auto";
    hideConfirmationPane?: boolean;
    hideTitle?: boolean;
    titleText?: string;
    hideSubtitle?: boolean;
    subtitleText?: string;
    hideConfirmButton?: boolean;
    confirmButtonDisabled?: boolean; //When true, confirm button remains visible but cannot be clicked
    confirmButtonText?: string;
    confirmButtonAriaLabel?: string;
    hideCancelButton?: boolean;
    cancelButtonDisabled?: boolean; //When true, cancel button remains visible but cannot be clicked
    cancelButtonText?: string;
    cancelButtonAriaLabel?: string;
    brightnessValueOnDim?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}