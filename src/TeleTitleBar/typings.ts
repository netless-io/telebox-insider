import type { TeleBoxEventArgs } from "../TeleBox";

export interface TeleTitleBarConfig {
    title?: string;
    namespace?: string;
    onEvent?: <U extends keyof TeleBoxEventArgs>(
        event: U,
        ...args: TeleBoxEventArgs[U]
    ) => void;
}

export interface TeleTitleBar {
    updateTitle(title: string): void;

    render(): HTMLElement;

    dragHandle(): HTMLElement | undefined;

    destroy(): void;
}
