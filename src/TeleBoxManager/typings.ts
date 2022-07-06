import type { TeleBoxColorScheme } from "..";
import type { ReadonlyTeleBox, TeleBoxState } from "../TeleBox";
import type { TeleBoxConfig } from "../TeleBox/typings";
import type { TeleBoxCollector } from "../TeleBoxCollector";
import type { TELE_BOX_MANAGER_EVENT } from "./constants";

export interface TeleBoxManagerConfig extends Pick<TeleBoxConfig, "namespace"> {
    /** Element to mount boxes. */
    readonly root?: HTMLElement | null;
    /** Stage area height/with ratio. No ratio if <= 0. Default -1. */
    readonly stageRatio?: number;
    /** Where the minimized boxes go. */
    readonly collector?: TeleBoxCollector;
    /** Restrict box to always be within the stage area. Default false. */
    readonly fence?: boolean;
    /** Prefers Box color scheme. Default light. */
    readonly prefersColorScheme?: TeleBoxColorScheme;
    /** Maximize box. Default false. */
    readonly maximized?: boolean;
    /** Minimize box. Overwrites maximized state. Default false. */
    readonly minimized?: boolean;
    /** Is box readonly */
    readonly readonly?: boolean;
    /** Custom styles for telebox manager container */
    readonly containerStyle?: string;
    /** Custom styles for telebox manager stage */
    readonly stageStyle?: string;
    /** Custom `style` attribute value for content area of all boxes. Can be overwritten by box. */
    readonly defaultBoxBodyStyle?: string | null;
    /** Custom `style` attribute value for stage area of all boxes. Can be overwritten by box. */
    readonly defaultBoxStageStyle?: string | null;
    /** Theme variable */
    readonly theme?: TeleBoxManagerThemeConfig;
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
    | "boxRatio"
    | "zIndex"
    | "stageRatio";

export type TeleBoxManagerCreateConfig = Pick<
    TeleBoxConfig,
    | TeleBoxManagerBoxConfigBaseProps
    | "content"
    | "stage"
    | "footer"
    | "styles"
    | "bodyStyle"
    | "stageStyle"
    | "id"
    | "focus"
    | "enableShadowDOM"
>;

export type TeleBoxManagerQueryConfig = Pick<
    TeleBoxConfig,
    | "title"
    | "visible"
    | "resizable"
    | "draggable"
    | "boxRatio"
    | "stageRatio"
    | "zIndex"
    | "id"
    | "focus"
>;

export type TeleBoxManagerUpdateConfig = Pick<
    TeleBoxConfig,
    TeleBoxManagerBoxConfigBaseProps | "content" | "stage" | "footer"
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

export type TeleBoxManagerThemeConfig = {
    managerContainerBackground?: string | null;
    managerStageBackground?: string | null;
    managerStageShadow?: string | null;

    boxContainerBackground?: string | null;
    boxStageBackground?: string | null;
    boxStageShadow?: string | null;

    boxColor?: string | null;
    boxBorder?: string | null;
    boxShadow?: string | null;
    boxFooterColor?: string | null;
    boxFooterBackground?: string | null;

    titlebarColor?: string | null;
    titlebarBackground?: string | null;
    titlebarBorderBottom?: string | null;
    titlebarTabColor?: string | null;
    titlebarTabFocusColor?: string | null;
    titlebarTabBackground?: string | null;
    titlebarTabDividerColor?: string | null;

    collectorBackground?: string | null;
    collectorShadow?: string | null;

    titlebarIconMinimize?: string | null;
    titlebarIconMaximize?: string | null;
    titlebarIconMaximizeActive?: string | null;
    titlebarIconClose?: string | null;
};
