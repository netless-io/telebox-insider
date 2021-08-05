import type { TeleBoxEventArgs, TeleBoxState } from "../TeleBox";

export type TeleTitleBarEvent<U = keyof TeleBoxEventArgs> =
    U extends keyof TeleBoxEventArgs
        ? TeleBoxEventArgs[U] extends void
            ? { type: U; value?: TeleBoxEventArgs[U] }
            : { type: U; value: TeleBoxEventArgs[U] }
        : never;

export interface TeleTitleBarConfig {
    title?: string;
    state?: TeleBoxState;
    namespace?: string;
    onEvent?: (event: TeleTitleBarEvent) => void;
    onDragStart?: (event: MouseEvent | TouchEvent) => void;
}

export interface TeleTitleBar {
    setTitle(title: string): void;

    setState(state: TeleBoxState): void;

    render(): HTMLElement;

    destroy(): void;
}
