import type EventEmitter from "eventemitter3";
import type { TeleTitleBar } from "../TeleTitleBar";
import {
    TeleBoxDragHandleType,
    TeleBoxEventType,
    TeleBoxResizeHandle,
    TeleBoxState,
} from "./constants";

export interface TeleBoxConfig {
    /** Box ID. */
    readonly id?: string;
    /** Box title. Default empty. */
    readonly title?: string;
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
    /** Able to resize box window */
    readonly resizable?: boolean;
    /** Able to drag box window */
    readonly draggable?: boolean;
    /** Fixed width/height ratio for box window. */
    readonly fixRatio?: boolean;
    /** Classname Prefix. For CSS styling. Default "telebox" */
    readonly namespace?: string;
    /** TeleTitleBar Instance */
    readonly titleBar?: TeleTitleBar;
}

export type TeleBoxEventArgs = {
    [TeleBoxEventType.Close]: [];
    [TeleBoxEventType.Focus]: [];
    [TeleBoxEventType.Blur]: [];
    [TeleBoxEventType.Move]: [number, number];
    [TeleBoxEventType.Resize]: [number, number];
    [TeleBoxEventType.State]: [TeleBoxState];
};

export interface TeleBoxEvents extends EventEmitter<keyof TeleBoxEventArgs> {
    on<U extends keyof TeleBoxEventArgs>(
        event: U,
        listener: (...args: TeleBoxEventArgs[U]) => void
    ): this;
    once<U extends keyof TeleBoxEventArgs>(
        event: U,
        listener: (...args: TeleBoxEventArgs[U]) => void
    ): this;
    addListener<U extends keyof TeleBoxEventArgs>(
        event: U,
        listener: (...args: TeleBoxEventArgs[U]) => void
    ): this;
    emit<U extends keyof TeleBoxEventArgs>(
        event: U,
        ...args: TeleBoxEventArgs[U]
    ): boolean;
}

export type TeleBoxHandleType =
    | TeleBoxResizeHandle
    | typeof TeleBoxDragHandleType;
