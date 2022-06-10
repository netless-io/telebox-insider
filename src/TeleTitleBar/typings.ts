import type { ReadonlyVal } from "value-enhancer";
import type { TeleBoxDelegateEventConfig, TeleBoxState } from "../TeleBox";

export type TeleTitleBarEvent<U = keyof TeleBoxDelegateEventConfig> =
    U extends keyof TeleBoxDelegateEventConfig
        ? TeleBoxDelegateEventConfig[U] extends void
            ? { type: U; value?: TeleBoxDelegateEventConfig[U] }
            : { type: U; value: TeleBoxDelegateEventConfig[U] }
        : never;

export interface TeleTitleBarConfig {
    readonly$: ReadonlyVal<boolean, boolean>;
    title$: ReadonlyVal<string, boolean>;
    state$: ReadonlyVal<TeleBoxState, boolean>;
    namespace?: string;
    onEvent?: (event: TeleTitleBarEvent) => void;
    onDragStart?: (event: MouseEvent | TouchEvent) => void;
}

export interface TeleTitleBar {
    render(): HTMLElement;
    destroy(): void;
}
