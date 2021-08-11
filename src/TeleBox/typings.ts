import type EventEmitter from "eventemitter3";
import type { TeleTitleBar } from "../TeleTitleBar";
import {
    TeleBoxDragHandleType,
    TeleBoxEventType,
    TeleBoxResizeHandle,
    TeleBoxState,
} from "./constants";

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
    /** The initial state of the box. Default normal. */
    readonly state?: TeleBoxState;
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
    /** Position and dimension of container */
    readonly containerRect?: TeleBoxRect;
    /** Position and dimension of collector */
    readonly collectorRect?: TeleBoxRect;
}

export type TeleBoxEventArgs = {
    [TeleBoxEventType.Close]: void;
    [TeleBoxEventType.Focus]: void;
    [TeleBoxEventType.Blur]: void;
    [TeleBoxEventType.Move]: { x: number; y: number };
    [TeleBoxEventType.Resize]: { width: number; height: number };
    [TeleBoxEventType.State]: TeleBoxState;
    [TeleBoxEventType.Snapshot]: TeleBoxRect;
};

export interface TeleBoxEvents extends EventEmitter<keyof TeleBoxEventArgs> {
    on<U extends keyof TeleBoxEventArgs>(
        event: U,
        listener: (value: TeleBoxEventArgs[U]) => void
    ): this;
    once<U extends keyof TeleBoxEventArgs>(
        event: U,
        listener: (value: TeleBoxEventArgs[U]) => void
    ): this;
    addListener<U extends keyof TeleBoxEventArgs>(
        event: U,
        listener: (value: TeleBoxEventArgs[U]) => void
    ): this;
    emit<U extends keyof TeleBoxEventArgs>(
        event: U,
        ...value: TeleBoxEventArgs[U] extends void ? [] : [TeleBoxEventArgs[U]]
    ): boolean;
}

export type TeleBoxHandleType =
    | TeleBoxResizeHandle
    | typeof TeleBoxDragHandleType;
