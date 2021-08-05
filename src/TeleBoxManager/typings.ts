import type EventEmitter from "eventemitter3";
import type { ReadonlyTeleBox, TeleBoxState } from "../TeleBox";
import type { TeleBoxConfig } from "../TeleBox/typings";
import type { TeleBoxCollector } from "../TeleBoxCollector";
import type { TeleBoxManagerEventType } from "./constants";

export interface TeleBoxManagerConfig
    extends Pick<TeleBoxConfig, "fence" | "containerRect" | "state"> {
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

export type TeleBoxManagerQueryConfig = Pick<
    TeleBoxConfig,
    TeleBoxManagerBoxConfigBaseProps | "id"
>;

export type TeleBoxManagerUpdateConfig = Pick<
    TeleBoxConfig,
    TeleBoxManagerBoxConfigBaseProps | "content"
>;

export type TeleBoxManagerEventArgs = {
    /** current focused box and last focused box */
    [TeleBoxManagerEventType.Focused]: [
        ReadonlyTeleBox | undefined,
        ReadonlyTeleBox | undefined
    ];
    [TeleBoxManagerEventType.Created]: [ReadonlyTeleBox];
    [TeleBoxManagerEventType.Removed]: [ReadonlyTeleBox[]];
    [TeleBoxManagerEventType.State]: [TeleBoxState];
    [TeleBoxManagerEventType.Move]: [ReadonlyTeleBox];
    [TeleBoxManagerEventType.Resize]: [ReadonlyTeleBox];
};

export interface TeleBoxManagerEvents
    extends EventEmitter<keyof TeleBoxManagerEventArgs> {
    on<U extends keyof TeleBoxManagerEventArgs>(
        event: U,
        listener: (...value: TeleBoxManagerEventArgs[U]) => void
    ): this;
    once<U extends keyof TeleBoxManagerEventArgs>(
        event: U,
        listener: (...value: TeleBoxManagerEventArgs[U]) => void
    ): this;
    addListener<U extends keyof TeleBoxManagerEventArgs>(
        event: U,
        listener: (...value: TeleBoxManagerEventArgs[U]) => void
    ): this;
    emit<U extends keyof TeleBoxManagerEventArgs>(
        event: U,
        ...value: TeleBoxManagerEventArgs[U]
    ): boolean;
}
