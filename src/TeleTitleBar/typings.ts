import type { TeleBox, TeleBoxEventType } from "../TeleBox";

export interface TeleTitleBar {
    updateTitle(title: string): void;

    render(teleBox: TeleBox): HTMLElement;

    dragHandle(): HTMLElement | undefined;

    destroy(): void;
}

export type TeleTitleBarEventType =
    | TeleBoxEventType.State
    | TeleBoxEventType.Close;
