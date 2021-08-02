import React from "react";
import { Meta, Story } from "@storybook/react";
import faker from "faker";
import { TeleBoxReact } from "../../TeleBoxReact";

const storyMeta: Meta = {
    title: "DefaultTitleBar",
    component: TeleBoxReact,
};

export default storyMeta;

export const LongTitle: Story = () => (
    <TeleBoxReact title={faker.lorem.words(50)} />
);
