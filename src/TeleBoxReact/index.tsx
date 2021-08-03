import React, { FC, useState, useEffect } from "react";
import { TeleBox } from "../TeleBox";
import { TeleBoxConfig } from "../TeleBox/typings";
import { TeleBoxState, TeleBoxEventType } from "../TeleBox/constants";
import { useUpdateEffect } from "./utils";

export type TeleBoxReactProps = TeleBoxConfig & {
    onResize?: (width: number, height: number) => void;
    onMove?: (x: number, y: number) => void;
    onClose?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    onStateChanged?: (state: TeleBoxState) => void;
};

export const TeleBoxReact: FC<TeleBoxReactProps> = (props) => {
    const [teleBox] = useState(() => new TeleBox(props));

    useUpdateEffect(() => {
        if (props.minWidth != null) {
            teleBox.setMinWidth(props.minWidth);
        }
    }, [teleBox, props.minWidth]);

    useUpdateEffect(() => {
        if (props.minHeight != null) {
            teleBox.setMinHeight(props.minHeight);
        }
    }, [teleBox, props.minHeight]);

    useUpdateEffect(() => {
        teleBox.resize(
            props.width ?? teleBox.width,
            props.height ?? teleBox.height,
            true
        );
    }, [teleBox, props.width, props.height]);

    useUpdateEffect(() => {
        teleBox.move(props.x ?? teleBox.x, props.y ?? teleBox.y, true);
    }, [teleBox, props.x, props.y]);

    useUpdateEffect(() => {
        if (props.title != null) {
            teleBox.setTitle(props.title);
        }
    }, [teleBox, props.title]);

    useUpdateEffect(() => {
        if (props.state != null) {
            teleBox.setState(props.state, true);
        }
    }, [teleBox, props.state]);

    useUpdateEffect(() => {
        if (props.draggable != null) {
            teleBox.setDraggable(props.draggable);
        }
    }, [teleBox, props.draggable]);

    useUpdateEffect(() => {
        if (props.resizable != null) {
            teleBox.setResizable(props.resizable);
        }
    }, [teleBox, props.resizable]);

    useUpdateEffect(() => {
        if (props.fixRatio != null) {
            teleBox.setFixRatio(props.fixRatio);
        }
    }, [teleBox, props.fixRatio]);

    useEffect(() => {
        if (props.onResize) {
            teleBox.events.on(TeleBoxEventType.Resize, props.onResize);
            return () => {
                teleBox.events.off(TeleBoxEventType.Resize, props.onResize);
            };
        }
        return;
    }, [teleBox, props.onResize]);

    useEffect(() => {
        if (props.onMove) {
            teleBox.events.on(TeleBoxEventType.Move, props.onMove);
            return () => {
                teleBox.events.off(TeleBoxEventType.Move, props.onMove);
            };
        }
        return;
    }, [teleBox, props.onMove]);

    useEffect(() => {
        if (props.onClose) {
            teleBox.events.on(TeleBoxEventType.Close, props.onClose);
            return () => {
                teleBox.events.off(TeleBoxEventType.Close, props.onClose);
            };
        }
        return;
    }, [teleBox, props.onClose]);

    useEffect(() => {
        if (props.onFocus) {
            teleBox.events.on(TeleBoxEventType.Focus, props.onFocus);
            return () => {
                teleBox.events.off(TeleBoxEventType.Focus, props.onFocus);
            };
        }
        return;
    }, [teleBox, props.onFocus]);

    useEffect(() => {
        if (props.onBlur) {
            teleBox.events.on(TeleBoxEventType.Blur, props.onBlur);
            return () => {
                teleBox.events.off(TeleBoxEventType.Blur, props.onBlur);
            };
        }
        return;
    }, [teleBox, props.onBlur]);

    useEffect(() => {
        if (props.onStateChanged) {
            teleBox.events.on(TeleBoxEventType.State, props.onStateChanged);
            return () => {
                teleBox.events.off(
                    TeleBoxEventType.State,
                    props.onStateChanged
                );
            };
        }
        return;
    }, [teleBox, props.onStateChanged]);

    return (
        <div
            ref={(node) => node && teleBox.render(node)}
            className={teleBox.wrapClassName("box")}
        />
    );
};
