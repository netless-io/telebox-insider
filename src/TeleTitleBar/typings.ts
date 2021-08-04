import type { TeleBoxEventArgs } from "../TeleBox";

export type TeleTitleBarEvent<U = keyof TeleBoxEventArgs> =
    U extends keyof TeleBoxEventArgs
        ? TeleBoxEventArgs[U] extends void
            ? { type: U; value?: TeleBoxEventArgs[U] }
            : { type: U; value: TeleBoxEventArgs[U] }
        : never;

export interface TeleTitleBarConfig {
    title?: string;
    namespace?: string;
    onEvent?: (event: TeleTitleBarEvent) => void;
    onDragStart?: (event: MouseEvent | TouchEvent) => void;
}

export interface TeleTitleBar {
    updateTitle(title: string): void;

    render(): HTMLElement;

    destroy(): void;
}
