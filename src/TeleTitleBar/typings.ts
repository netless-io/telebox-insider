import type { TeleBoxDelegateEventConfig, TeleBoxState } from "../TeleBox";

export type TeleTitleBarEvent<U = keyof TeleBoxDelegateEventConfig> =
    U extends keyof TeleBoxDelegateEventConfig
        ? TeleBoxDelegateEventConfig[U] extends void
            ? { type: U; value?: TeleBoxDelegateEventConfig[U]; boxId?: string }
            : { type: U; value: TeleBoxDelegateEventConfig[U]; boxId?: string }
        : never;

export interface TeleTitleBarConfig {
    readonly?: boolean;
    title?: string;
    state?: TeleBoxState;
    namespace?: string;
    forceTop?: boolean;
    forceNormal?: boolean;
    onEvent?: (event: TeleTitleBarEvent) => void;
    onDragStart?: (event: MouseEvent | TouchEvent) => void;
}

export interface TeleTitleBar {
    readonly $dragArea: HTMLElement;
    setTitle(title: string): void;

    setState(state: TeleBoxState): void;

    setReadonly(readonly: boolean): void;

    render(): HTMLElement;

    destroy(): void;

    setBoxStatus(boxStatus?: TeleBoxState): void;
}
