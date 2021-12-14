import type EventEmitter from "eventemitter3";
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
    /** Prefers Box color scheme. Default light. */
    readonly prefersColorScheme?: TeleBoxColorScheme;
    /** Actual Box Dark Mode */
    readonly darkMode?: boolean;
    /** Box visible. Default true. */
    readonly visible?: boolean;
    /** Box width relative to root element. 0~1. Default 0.5. */
    readonly width?: number;
    /** Box height relative to root element. 0~1. Default 0.5. */
    readonly height?: number;
    /** Minimum box width relative to root element. 0~1. Default 0. */
    readonly minWidth?: number;
    /** Minimum box height relative to root element. 0~1. Default 0. */
    readonly minHeight?: number;
    /** x position relative to root element. 0~1. Default 0.1. */
    readonly x?: number;
    /** y position relative to root element. 0~1. Default 0.1. */
    readonly y?: number;
    /** Maximize box. Default false. */
    readonly maximized?: boolean;
    /** Minimize box. Overwrites maximized state. Default false. */
    readonly minimized?: boolean;
    /** The initial state of the box. Default normal. */
    readonly state?: TeleBoxState;
    /** Is box readonly */
    readonly readonly?: boolean;
    /** Able to resize box window. Default true. */
    readonly resizable?: boolean;
    /** Able to drag box window Default true. */
    readonly draggable?: boolean;
    /** Restrict box to always be within the containing area. Default true. */
    readonly fence?: boolean;
    /** Fixed width/height ratio for box window. Default false. */
    readonly fixRatio?: boolean;
    /** Box focused. */
    readonly focus?: boolean;
    /** Base z-index for box. */
    readonly zIndex?: number;
    /** Classname Prefix. For CSS styling. Default "telebox". */
    readonly namespace?: string;
    /** TeleTitleBar Instance. */
    readonly titleBar?: TeleTitleBar;
    /** Box content. */
    readonly content?: HTMLElement;
    /** Box footer. */
    readonly footer?: HTMLElement;
    /** Box content styles. */
    readonly styles?: HTMLStyleElement;
    /** Position and dimension of container */
    readonly containerRect?: TeleBoxRect;
    /** Position and dimension of collector */
    readonly collectorRect?: TeleBoxRect;
}

type CheckTeleBoxConfig<T extends Record<`${TELE_BOX_EVENT}`, any>> = T;

export type TeleBoxEventConfig = CheckTeleBoxConfig<{
    dark_mode: boolean;
    prefers_color_scheme: TeleBoxColorScheme;
    close: void;
    focus: void;
    blur: void;
    move: { x: number; y: number };
    resize: { width: number; height: number };
    intrinsic_move: { x: number; y: number };
    intrinsic_resize: { width: number; height: number };
    visual_resize: { width: number; height: number };
    state: TeleBoxState;
    minimized: boolean;
    maximized: boolean;
    readonly: boolean;
    destroyed: void;
}>;

export type TeleBoxEvent = keyof TeleBoxEventConfig;

export interface TeleBoxEvents extends EventEmitter<TeleBoxEvent> {
    on<U extends TeleBoxEvent>(
        event: U,
        listener: (value: TeleBoxEventConfig[U]) => void
    ): this;
    once<U extends TeleBoxEvent>(
        event: U,
        listener: (value: TeleBoxEventConfig[U]) => void
    ): this;
    addListener<U extends TeleBoxEvent>(
        event: U,
        listener: (value: TeleBoxEventConfig[U]) => void
    ): this;
    emit<U extends TeleBoxEvent>(
        event: U,
        ...value: TeleBoxEventConfig[U] extends void
            ? []
            : [TeleBoxEventConfig[U]]
    ): boolean;
}

export type TeleBoxHandleType =
    | TELE_BOX_RESIZE_HANDLE
    | typeof TeleBoxDragHandleType;

type CheckTeleBoxDelegateConfig<
    T extends Record<`${TELE_BOX_DELEGATE_EVENT}`, any>
> = T;

export type TeleBoxDelegateEventConfig = CheckTeleBoxDelegateConfig<{
    close: void;
    maximize: void;
    minimize: void;
}>;

export type TeleBoxDelegateEvent = keyof TeleBoxDelegateEventConfig;

export interface TeleBoxDelegateEvents
    extends EventEmitter<TeleBoxDelegateEvent> {
    on<U extends TeleBoxDelegateEvent>(
        event: U,
        listener: (value: TeleBoxDelegateEventConfig[U]) => void
    ): this;
    once<U extends TeleBoxDelegateEvent>(
        event: U,
        listener: (value: TeleBoxDelegateEventConfig[U]) => void
    ): this;
    addListener<U extends TeleBoxDelegateEvent>(
        event: U,
        listener: (value: TeleBoxDelegateEventConfig[U]) => void
    ): this;
    emit<U extends TeleBoxDelegateEvent>(
        event: U,
        ...value: TeleBoxDelegateEventConfig[U] extends void
            ? []
            : [TeleBoxDelegateEventConfig[U]]
    ): boolean;
}
