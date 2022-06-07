import type { TeleBoxColorScheme } from "..";
import type { ReadonlyTeleBox, TeleBoxState } from "../TeleBox";
import type { TeleBoxConfig, TeleBoxRect } from "../TeleBox/typings";
import type { TeleBoxCollector } from "../TeleBoxCollector";
import type { TELE_BOX_MANAGER_EVENT } from "./constants";

export interface TeleBoxManagerConfig extends Pick<TeleBoxConfig, "namespace"> {
    /** Element to mount boxes. */
    root?: HTMLElement;
    /** Stage area height/with ratio. No ratio if <= 0. Default -1. */
    stageRatio?: number;
    /** Where the minimized boxes go. */
    collector?: TeleBoxCollector;
    /** Restrict box to always be within the containing area. Default true. */
    fence?: boolean;
    /** Prefers Box color scheme. Default light. */
    prefersColorScheme?: TeleBoxColorScheme;
    /** Maximize box. Default false. */
    readonly maximized?: boolean;
    /** Minimize box. Overwrites maximized state. Default false. */
    readonly minimized?: boolean;
    /** Is box readonly */
    readonly readonly?: boolean;
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
    | "zIndex";

export type TeleBoxManagerCreateConfig = Pick<
    TeleBoxConfig,
    TeleBoxManagerBoxConfigBaseProps | "content" | "footer" | "id" | "focus"
>;

export type TeleBoxManagerQueryConfig = Pick<
    TeleBoxConfig,
    TeleBoxManagerBoxConfigBaseProps | "id" | "focus"
>;

export type TeleBoxManagerUpdateConfig = Pick<
    TeleBoxConfig,
    TeleBoxManagerBoxConfigBaseProps | "content" | "footer"
>;

type CheckTeleBoxManagerConfig<
    T extends Record<`${TELE_BOX_MANAGER_EVENT}`, any>
> = T;

export type TeleBoxManagerEventConfig = CheckTeleBoxManagerConfig<{
    focused: ReadonlyTeleBox | undefined;
    blurred: ReadonlyTeleBox | undefined;
    created: ReadonlyTeleBox;
    removed: ReadonlyTeleBox[];
    state: TeleBoxState;
    maximized: boolean;
    minimized: boolean;
    move: ReadonlyTeleBox;
    resize: ReadonlyTeleBox;
    intrinsic_move: ReadonlyTeleBox;
    intrinsic_resize: ReadonlyTeleBox;
    visual_resize: ReadonlyTeleBox;
    z_index: ReadonlyTeleBox;
    prefers_color_scheme: TeleBoxColorScheme;
    dark_mode: boolean;
}>;

export type TeleBoxManagerEvent = keyof TeleBoxManagerEventConfig;
