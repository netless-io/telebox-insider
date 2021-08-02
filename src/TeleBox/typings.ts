import type EventEmitter from "eventemitter3";
import type { TeleTitleBar } from "../TeleTitleBar";
import {
    TeleBoxDragHandleType,
    TeleBoxEventType,
    TeleBoxResizeHandle,
    TeleBoxState,
} from "./constants";

export interface TeleBoxConfig {
    /** Board ID. */
    readonly id?: string;
    /** Board title. Default empty. */
    readonly title?: string;
    /** Board width relative to root element. 0~1. Default 0.5. */
    readonly width?: number;
    /** Board height relative to root element. 0~1. Default 0.5. */
    readonly height?: number;
    /** Minimum window width relative to root element. 0~1. Default 0. */
    readonly minWidth?: number;
    /** Minimum window height relative to root element. 0~1. Default 0. */
    readonly minHeight?: number;
    /** x position relative to root element. 0~1. Default 0.1. */
    readonly x?: number;
    /** y position relative to root element. 0~1. Default 0.1. */
    readonly y?: number;
    /** The initial state of the window. Default normal. */
    readonly state?: TeleBoxState;
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
