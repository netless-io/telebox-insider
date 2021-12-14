import type EventEmitter from "eventemitter3";
import { TeleBoxColorScheme } from "..";
import type { ReadonlyTeleBox, TeleBoxState } from "../TeleBox";
import type { TeleBoxConfig } from "../TeleBox/typings";
import type { TeleBoxCollector } from "../TeleBoxCollector";
import type { TELE_BOX_MANAGER_EVENT } from "./constants";

export interface TeleBoxManagerConfig
    extends Pick<
        TeleBoxConfig,
        | "prefersColorScheme"
        | "fence"
        | "containerRect"
        | "maximized"
        | "minimized"
        | "namespace"
        | "zIndex"
        | "readonly"
    > {
    /** Element to mount boxes. */
    root?: HTMLElement;
    /** Where the minimized boxes go. */
    collector?: TeleBoxCollector;
}

type TeleBoxManagerBoxConfigBaseProps =
    | "title"
    | "visible"
    | "width"
    | "height"
    | "minWidth"
    | "minHeight"
    | "x"
    | "y"
    | "resizable"
    | "draggable"
    | "fixRatio"
    | "focus";

export type TeleBoxManagerCreateConfig = Pick<
    TeleBoxConfig,
    TeleBoxManagerBoxConfigBaseProps | "content" | "footer" | "id"
>;

export type TeleBoxManagerQueryConfig = Pick<
    TeleBoxConfig,
    TeleBoxManagerBoxConfigBaseProps | "id"
>;

export type TeleBoxManagerUpdateConfig = Pick<
    TeleBoxConfig,
    TeleBoxManagerBoxConfigBaseProps | "content" | "footer"
>;

type CheckTeleBoxManagerConfig<
    T extends Record<`${TELE_BOX_MANAGER_EVENT}`, any>
> = T;

export type TeleBoxManagerEventConfig = CheckTeleBoxManagerConfig<{
    /** current focused box and last focused box */
    focused: [ReadonlyTeleBox | undefined, ReadonlyTeleBox | undefined];
    created: [ReadonlyTeleBox];
    removed: [ReadonlyTeleBox[]];
    state: [TeleBoxState];
    maximized: [boolean];
    minimized: [boolean];
    move: [ReadonlyTeleBox];
    resize: [ReadonlyTeleBox];
    intrinsic_move: [ReadonlyTeleBox];
    intrinsic_resize: [ReadonlyTeleBox];
    visual_resize: [ReadonlyTeleBox];
    prefers_color_scheme: [TeleBoxColorScheme];
    dark_mode: [boolean];
}>;

export type TeleBoxManagerEvent = keyof TeleBoxManagerEventConfig;

export interface TeleBoxManagerEvents
    extends EventEmitter<TeleBoxManagerEvent> {
    on<U extends TeleBoxManagerEvent>(
        event: U,
        listener: (...value: TeleBoxManagerEventConfig[U]) => void
    ): this;
    once<U extends TeleBoxManagerEvent>(
        event: U,
        listener: (...value: TeleBoxManagerEventConfig[U]) => void
    ): this;
    addListener<U extends TeleBoxManagerEvent>(
        event: U,
        listener: (...value: TeleBoxManagerEventConfig[U]) => void
    ): this;
    emit<U extends TeleBoxManagerEvent>(
        event: U,
        ...value: TeleBoxManagerEventConfig[U]
    ): boolean;
}
