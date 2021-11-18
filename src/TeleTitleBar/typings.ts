import type { TeleBoxDelegateEventConfig, TeleBoxState } from "../TeleBox";

export type TeleTitleBarEvent<U = keyof TeleBoxDelegateEventConfig> =
    U extends keyof TeleBoxDelegateEventConfig
        ? TeleBoxDelegateEventConfig[U] extends void
            ? { type: U; value?: TeleBoxDelegateEventConfig[U] }
            : { type: U; value: TeleBoxDelegateEventConfig[U] }
        : never;

export interface TeleTitleBarConfig {
    readonly?: boolean;
    title?: string;
    state?: TeleBoxState;
    namespace?: string;
    onEvent?: (event: TeleTitleBarEvent) => void;
    onDragStart?: (event: MouseEvent | TouchEvent) => void;
}

export interface TeleTitleBar {
    setTitle(title: string): void;

    setState(state: TeleBoxState): void;

    setReadonly(readonly: boolean): void;

    render(): HTMLElement;

    destroy(): void;
}
