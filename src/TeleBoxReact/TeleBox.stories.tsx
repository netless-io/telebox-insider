import React from "react";
import { Meta, Story } from "@storybook/react";
import faker from "faker";
import { TeleBoxReact } from ".";
import { TeleBoxState } from "../TeleBox/constants";

const storyMeta: Meta = {
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
        state: TeleBoxState.Normal,
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
    },
};

export default storyMeta;

export const Overview: Story = (args) => {
    return <TeleBoxReact {...args} />;
};

export const Resizable: Story = (args) => {
    return <TeleBoxReact {...args} />;
};

Resizable.args = {
    title: "No Resize",
    resizable: false,
};

export const Draggable: Story = (args) => {
    return <TeleBoxReact {...args} />;
};

Draggable.args = {
    title: "No Drag",
    draggable: false,
};
