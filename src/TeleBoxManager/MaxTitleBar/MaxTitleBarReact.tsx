import React, { FC, useEffect, useState } from "react";
import { MaxTitleBar, MaxTitleBarConfig } from ".";

export type MaxTitleBarReactProps = MaxTitleBarConfig;

export const MaxTitleBarReact: FC<MaxTitleBarConfig> = (props) => {
    const [maxTitleBar] = useState(() => new MaxTitleBar(props));

    useEffect(() => {
        if (props.state != null) {
            maxTitleBar.setState(props.state);
        }
    }, [maxTitleBar, props.state]);

    useEffect(() => {
        if (props.boxes != null) {
            maxTitleBar.setBoxes(props.boxes);
        }
    }, [maxTitleBar, props.boxes]);

    useEffect(() => {
        if (props.containerRect != null) {
            maxTitleBar.setContainerRect(props.containerRect);
        }
    }, [maxTitleBar, props.containerRect]);

    useEffect(() => {
        maxTitleBar.focusBox(props.focusedBox);
    }, [maxTitleBar, props.focusedBox]);

    return (
        <div ref={(node) => node && node.appendChild(maxTitleBar.render())} />
    );
};
