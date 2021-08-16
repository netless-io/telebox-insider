import type { TeleBoxEventConfig, TeleBoxState } from "../TeleBox";

export type TeleTitleBarEvent<U = keyof TeleBoxEventConfig> =
    U extends keyof TeleBoxEventConfig
        ? TeleBoxEventConfig[U] extends void
            ? { type: U; value?: TeleBoxEventConfig[U] }
            : { type: U; value: TeleBoxEventConfig[U] }
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
