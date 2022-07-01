import type Emittery from "emittery";
import type { ReadonlyVal } from "value-enhancer";
import type { TeleTitleBar } from "../TeleTitleBar";
import type {
    TeleBoxDragHandleType,
    TELE_BOX_EVENT,
    TELE_BOX_DELEGATE_EVENT,
    TELE_BOX_RESIZE_HANDLE,
    TELE_BOX_STATE,
    TELE_BOX_COLOR_SCHEME,
} from "./constants";

export type TeleBoxColorScheme = `${TELE_BOX_COLOR_SCHEME}`;

export type TeleBoxCoord = { x: number; y: number };

export type TeleBoxSize = { width: number; height: number };

export type TeleBoxState = `${TELE_BOX_STATE}`;

export interface TeleBoxRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export interface TeleBoxConfig {
    /** Box ID. */
    readonly id?: string;
    /** Box title. Default empty. */
    readonly title?: string;
    /** Box visible. Default true. */
    readonly visible?: boolean;
    /** Box width relative to stage area. 0~1. Default 0.5. */
    readonly width?: number;
    /** Box height relative to stage area. 0~1. Default 0.5. */
    readonly height?: number;
    /** Minimum box width relative to stage area. 0~1. Default 0. */
    readonly minWidth?: number;
    /** Minimum box height relative to stage area. 0~1. Default 0. */
    readonly minHeight?: number;
    /** x position relative to stage area. 0~1. Default 0.1. */
    readonly x?: number;
    /** y position relative to stage area. 0~1. Default 0.1. */
    readonly y?: number;
    /** The initial state of the box. Default normal. */
    readonly state?: TeleBoxState;
    /** Able to resize box window. Default true. */
    readonly resizable?: boolean;
    /** Able to drag box window Default true. */
    readonly draggable?: boolean;
    /** Fixed height/width ratio for box window. No ratio limit if <= 0. Default -1. */
    readonly boxRatio?: number;
    /** Box focused. */
    readonly focus?: boolean;
    /** Base z-index for box. */
    readonly zIndex?: number;
    /** Box content stage ratio. Follow manager stage ratio if null. Default null. */
    readonly stageRatio?: number | null;
    /** Classname Prefix. For CSS styling. Default "telebox". */
    readonly namespace?: string;
    /** TeleTitleBar Instance. */
    readonly titleBar?: TeleTitleBar;
    /** Box content element. */
    readonly content?: HTMLElement;
    /** Stage element. */
    readonly stage?: HTMLElement;
    /** Box footer element. */
    readonly footer?: HTMLElement;
    /** Box content styles. */
    readonly styles?: string;
    /** Box content styles from end users. */
    readonly userStyles?: string;
    /** Custom styles for box content container. Inherit from manager container style if null. Default null. */
    readonly bodyStyle?: string | null;
    /** Custom styles for box content stage. Inherit from manager stage style if null. Default null. */
    readonly stageStyle?: string | null;
    /** Actual Box Dark Mode */
    readonly darkMode$: ReadonlyVal<boolean, boolean>;
    /** Restrict box to always be within the stage area. Default false. */
    readonly fence$: ReadonlyVal<boolean, boolean>;
    /** Maximize box. Default false. */
    readonly maximized$: ReadonlyVal<boolean, boolean>;
    /** Minimize box. Overwrites maximized state. Default false. */
    readonly minimized$: ReadonlyVal<boolean, boolean>;
    /** Is box readonly */
    readonly readonly$: ReadonlyVal<boolean, boolean>;
    /** Root element to mount boxes */
    readonly root: HTMLElement;
    /** Position and dimension of root element */
    readonly rootRect$: ReadonlyVal<TeleBoxRect>;
    /** Position and dimension of stage area */
    readonly managerStageRect$: ReadonlyVal<TeleBoxRect>;
    /** Stage area height/with ratio. No ratio if <= 0. */
    readonly managerStageRatio$: ReadonlyVal<number, boolean>;
    /** Default content styles for all boxes */
    readonly defaultBoxBodyStyle$: ReadonlyVal<string | null>;
    /** Default stage styles for all boxes */
    readonly defaultBoxStageStyle$: ReadonlyVal<string | null>;
    /** Position and dimension of collector */
    readonly collectorRect$: ReadonlyVal<TeleBoxRect | undefined>;
}

type CheckTeleBoxConfig<T extends Record<`${TELE_BOX_EVENT}`, any>> = T;

export type TeleBoxEventConfig = CheckTeleBoxConfig<{
    dark_mode: boolean;
    prefers_color_scheme: TeleBoxColorScheme;
    close: undefined;
    focus: undefined;
    blur: undefined;
    intrinsic_move: { x: number; y: number };
    intrinsic_resize: { width: number; height: number };
    z_index: number;
    state: TeleBoxState;
    minimized: boolean;
    maximized: boolean;
    readonly: boolean;
    destroyed: undefined;
}>;

export type TeleBoxEvent = keyof TeleBoxEventConfig;

export type TeleBoxEvents = Emittery<TeleBoxEventConfig>;

export type TeleBoxHandleType =
    | TELE_BOX_RESIZE_HANDLE
    | typeof TeleBoxDragHandleType;

type CheckTeleBoxDelegateConfig<
    T extends Record<`${TELE_BOX_DELEGATE_EVENT}`, any>
> = T;

export type TeleBoxDelegateEventConfig = CheckTeleBoxDelegateConfig<{
    close: undefined;
    maximize: undefined;
    minimize: undefined;
}>;

export type TeleBoxDelegateEvent = keyof TeleBoxDelegateEventConfig;

export type TeleBoxDelegateEvents = Emittery<TeleBoxDelegateEventConfig>;
