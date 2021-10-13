import React, { useState } from "react";
import { Meta, Story } from "@storybook/react";
import { TeleBoxCollector, TeleBoxCollectorConfig } from ".";

const storyMeta: Meta = {
    title: "TeleBoxCollector",
};

export default storyMeta;

export const Overview: Story<TeleBoxCollectorConfig> = (args) => {
    const [collector] = useState(() => new TeleBoxCollector(args));
    return <div ref={(dom) => dom && dom.appendChild(collector.render())} />;
};

Overview.args = {
    visible: true,
    readonly: false,
};

Overview.argTypes = {
    onClick: { action: "onClick" },
};
