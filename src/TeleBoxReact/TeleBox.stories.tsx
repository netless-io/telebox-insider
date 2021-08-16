import React from "react";
import { Meta, Story } from "@storybook/react";
import faker from "faker";
import { TeleBoxReact, TeleBoxReactProps } from ".";
import { TELE_BOX_STATE } from "../TeleBox/constants";

const storyMeta: Meta<TeleBoxReactProps> = {
    title: "TeleBox",
    component: TeleBoxReact,
    args: {
        title: faker.commerce.productName(),
        width: 0.5,
        height: 0.5,
        minWidth: 0.05,
        minHeight: 0.05,
        x: 0.1,
        y: 0.1,
        state: TELE_BOX_STATE.Normal,
        readonly: false,
        draggable: true,
        resizable: true,
    },
    argTypes: {
        width: { control: { type: "range", min: 0, max: 1, step: 0.01 } },
        height: { control: { type: "range", min: 0, max: 1, step: 0.01 } },
        minWidth: { control: { type: "range", min: 0, max: 1, step: 0.01 } },
        minHeight: { control: { type: "range", min: 0, max: 1, step: 0.01 } },
        x: { control: { type: "range", min: 0, max: 1, step: 0.01 } },
        y: { control: { type: "range", min: 0, max: 1, step: 0.01 } },
        fixRatio: { control: { type: "number" } },
    },
};

export default storyMeta;

export const Overview: Story<TeleBoxReactProps> = (args) => {
    return <TeleBoxReact {...args} />;
};

export const Resizable: Story<TeleBoxReactProps> = (args) => {
    return <TeleBoxReact {...args} />;
};

Resizable.args = {
    title: "No Resize",
    resizable: false,
};

export const Draggable: Story<TeleBoxReactProps> = (args) => {
    return <TeleBoxReact {...args} />;
};

Draggable.args = {
    title: "No Drag",
    draggable: false,
};

export const FixRatio: Story<TeleBoxReactProps> = (args) => {
    return <TeleBoxReact {...args} />;
};

FixRatio.args = {
    title: "Fix Ratio",
    fixRatio: true,
};

export const Readonly: Story<TeleBoxReactProps> = (args) => {
    return <TeleBoxReact {...args} />;
};

Readonly.args = {
    title: "Readonly",
    readonly: true,
};
