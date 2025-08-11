import { LogLevel, TelemetryEvent } from "../../common/telemetry/TelemetryConstants";
import React, { Dispatch, useEffect } from "react";
import { createTimer, findAllFocusableElement, findParentFocusableElementsWithoutChildContainer, preventFocusToMoveOutOfElement, setFocusOnElement, setFocusOnSendBox, setTabIndices } from "../../common/utils";
import { ConfirmationPane } from "@microsoft/omnichannel-chat-components";
import { ConfirmationState } from "../../common/Constants";
import { ConversationState } from "../../contexts/common/ConversationState";
import { DimLayer } from "../dimlayer/DimLayer";
import { IConfirmationPaneControlProps } from "@microsoft/omnichannel-chat-components/lib/types/components/confirmationpane/interfaces/IConfirmationPaneControlProps";
import { IConfirmationPaneStatefulParams } from "./interfaces/IConfirmationPaneStatefulParams";
import { ILiveChatWidgetAction } from "../../contexts/common/ILiveChatWidgetAction";
import { ILiveChatWidgetContext } from "../../contexts/common/ILiveChatWidgetContext";
import { ITimer } from "../../common/interfaces/ITimer";
import { LiveChatWidgetActionType } from "../../contexts/common/LiveChatWidgetActionType";
import { TelemetryHelper } from "../../common/telemetry/TelemetryHelper";
import useChatContextStore from "../../hooks/useChatContextStore";

let uiTimer : ITimer;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ConfirmationPaneStateful = (props: IConfirmationPaneStatefulParams) => {
    useEffect(() => {
        uiTimer = createTimer();
        TelemetryHelper.logLoadingEvent(LogLevel.INFO, {
            Event: TelemetryEvent.UXConfirmationPaneStart
        });
    }, []);

    const initialTabIndexMap: Map<string, number> = new Map();
    let elements: HTMLElement[] | null = [];

    const [state, dispatch]: [ILiveChatWidgetContext, Dispatch<ILiveChatWidgetAction>] = useChatContextStore();
    const isConfirmInProgress = state?.domainStates?.confirmationState === ConfirmationState.Ok;
    const baseControl = props?.controlProps;
    const controlProps: IConfirmationPaneControlProps = {
        ...baseControl,
        id: baseControl?.id ?? "oc-lcw-confirmation-pane",
        dir: state.domainStates.globalDir,
        onConfirm: async () => {
            if (state?.domainStates?.confirmationState === ConfirmationState.Ok) {
                return;
            }
            TelemetryHelper.logActionEvent(LogLevel.INFO, {
                Event: TelemetryEvent.ConfirmationConfirmButtonClicked,
                Description: "Confirmation pane Confirm button clicked"
            });
            // Keep the pane open; endChat will run via state change observed by LiveChatWidgetStateful
            dispatch({ type: LiveChatWidgetActionType.SET_CONFIRMATION_STATE, payload: ConfirmationState.Ok });
            TelemetryHelper.logActionEvent(LogLevel.INFO, {
                Event: TelemetryEvent.ConversationEndedByCustomer,
                Description: "Conversation is ended by customer."
            });
        },
        onCancel: () => {
            if (state?.domainStates?.confirmationState === ConfirmationState.Ok) {
                return;
            }
            TelemetryHelper.logActionEvent(LogLevel.INFO, {
                Event: TelemetryEvent.ConfirmationCancelButtonClicked,
                Description: "Confirmation pane Cancel button clicked."
            });
            dispatch({ type: LiveChatWidgetActionType.SET_SHOW_CONFIRMATION, payload: false });
            dispatch({ type: LiveChatWidgetActionType.SET_CONFIRMATION_STATE, payload: ConfirmationState.Cancel });
            const previousFocusedElementId = state.appStates.previousElementIdOnFocusBeforeModalOpen;
            if (previousFocusedElementId) {
                setFocusOnElement("#" + previousFocusedElementId);
                dispatch({ type: LiveChatWidgetActionType.SET_PREVIOUS_FOCUSED_ELEMENT_ID, payload: null });
            } else {
                setFocusOnSendBox();
            }
            setTabIndices(elements, initialTabIndexMap, true);
        }
    };

    // Move focus to the first button
    useEffect(() => {
        preventFocusToMoveOutOfElement(controlProps.id as string);
        const focusableElements: HTMLElement[] | null = findAllFocusableElement(`#${controlProps.id}`);
        requestAnimationFrame(() => {
            if (focusableElements && focusableElements.length > 0 && focusableElements[0]) {
                focusableElements[0].focus({ preventScroll: true });
            }
        });

        elements = findParentFocusableElementsWithoutChildContainer(controlProps.id as string);
        setTabIndices(elements, initialTabIndexMap, false);
        TelemetryHelper.logLoadingEvent(LogLevel.INFO, { Event: TelemetryEvent.ConfirmationPaneLoaded });
        TelemetryHelper.logLoadingEvent(LogLevel.INFO, {
            Event: TelemetryEvent.UXConfirmationPaneCompleted,
            ElapsedTimeInMilliseconds: uiTimer.milliSecondsElapsed
        });
    }, []);

    // Auto-close only AFTER user confirmed (Ok) and conversation state transitions away from Active/Loading
    // This ensures endChat completes before allowing new interactions
    useEffect(() => {
        if (!state?.uiStates?.showConfirmationPane) {
            return;
        }
        if (state?.domainStates?.confirmationState !== ConfirmationState.Ok) {
            // User hasn't confirmed yet; keep the pane visible even if convo already InActive.
            return;
        }

        const conv = state?.appStates?.conversationState;
        const endChatCompleted = conv === ConversationState.Closed ||
                        conv === ConversationState.PostchatLoading ||
                        conv === ConversationState.Postchat ||
                        conv === ConversationState.Error ||
                        (conv === ConversationState.Loading && state?.appStates?.startChatFailed);

        // Only dismiss when endChat has fully completed 
        if (!endChatCompleted) {
            return;
        }

        // Release the focus trap before closing the pane
        setTabIndices(elements, initialTabIndexMap, true);
        dispatch({ type: LiveChatWidgetActionType.SET_SHOW_CONFIRMATION, payload: false });
    }, [state?.appStates?.conversationState, state?.uiStates?.showConfirmationPane, state?.domainStates?.confirmationState]);

    // Keep buttons visible but non-clickable via style overrides (no layout shift)
    const localStyleProps = React.useMemo(() => {
        if (!isConfirmInProgress) {
            return props?.styleProps;
        }
        const disabledStyle = { pointerEvents: "none", cursor: "not-allowed", opacity: (props?.styleProps as any)?.disabledOpacity ?? 0.9 } as const; // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
            ...props?.styleProps,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            confirmButtonStyleProps: Object.assign({}, (props?.styleProps as any)?.confirmButtonStyleProps || {}, disabledStyle),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cancelButtonStyleProps: Object.assign({}, (props?.styleProps as any)?.cancelButtonStyleProps || {}, disabledStyle)
        };
    }, [isConfirmInProgress, props?.styleProps]);

    return (
        <>
            <DimLayer brightness={controlProps?.brightnessValueOnDim ?? "0.2"} />
            <ConfirmationPane
                componentOverrides={props?.componentOverrides}
                controlProps={controlProps}
                styleProps={localStyleProps}
            />
        </>
    );
};

export default ConfirmationPaneStateful;
