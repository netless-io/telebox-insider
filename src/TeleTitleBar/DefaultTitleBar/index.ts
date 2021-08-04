import "./style.scss";

import minimizeSVG from "./icons/minimize.svg";
import maximizeSVG from "./icons/maximize.svg";
import closeSVG from "./icons/close.svg";

import {
    TeleBoxDragHandleType,
    TeleBoxEventType,
    TeleBoxState,
} from "../../TeleBox/constants";
import type {
    TeleTitleBar,
    TeleTitleBarConfig,
    TeleTitleBarEvent,
} from "../typings";
import { preventEvent } from "../../utils";

export type DefaultTitleBarButton = TeleTitleBarEvent & {
    readonly icon: string;
};

export interface DefaultTitleBarConfig extends TeleTitleBarConfig {
    buttons?: ReadonlyArray<DefaultTitleBarButton>;
}

export class DefaultTitleBar implements TeleTitleBar {
    public constructor({
        title,
        buttons,
        onEvent,
        onDragStart,
        namespace = "telebox",
    }: DefaultTitleBarConfig = {}) {
        this.buttons = buttons || DefaultTitleBar.defaultButtons;
        this.onEvent = onEvent;
        this.onDragStart = onDragStart;
        this.namespace = namespace;
        this.title = title;
    }

    public readonly namespace: string;

    public $titleBar: HTMLElement | undefined;

    public $title: HTMLElement | undefined;

    public $buttons: HTMLElement | undefined;

    public updateTitle(title: string): void {
        this.title = title;
        if (this.$title) {
            this.$title.textContent = title;
            this.$title.title = title;
        }
    }

    public render(): HTMLElement {
        if (!this.$titleBar) {
            this.$titleBar = document.createElement("div");
            this.$titleBar.className = this.wrapClassName("titlebar");
            this.$titleBar.dataset.teleBoxHandle = TeleBoxDragHandleType;
            this.$titleBar.addEventListener(
                "mousedown",
                this.handleTitleBarClick
            );
            this.$titleBar.addEventListener(
                "touchstart",
                this.handleTitleBarClick
            );

            this.$title = document.createElement("h1");
            this.$title.className = this.wrapClassName("title");
            this.$title.dataset.teleBoxHandle = TeleBoxDragHandleType;
            if (this.title) {
                this.$title.textContent = this.title;
                this.$title.title = this.title;
            }

            const $buttons = document.createElement("div");
            $buttons.className = this.wrapClassName("titlebar-btns");
            this.$buttons = $buttons;

            this.buttons.forEach(({ icon }, i) => {
                const teleTitleBarBtnIndex = String(i);

                const $btn = document.createElement("button");
                $btn.className = this.wrapClassName("titlebar-btn");
                $btn.dataset.teleTitleBarBtnIndex = teleTitleBarBtnIndex;

                const $img = document.createElement("img");
                $img.className = this.wrapClassName("titlebar-btn-icon");
                $img.src = icon;
                $img.dataset.teleTitleBarBtnIndex = teleTitleBarBtnIndex;

                $btn.appendChild($img);
                $buttons.appendChild($btn);
            });

            this.$buttons.addEventListener("click", this.handleBtnClick);

            this.$titleBar.appendChild(this.$title);
            this.$titleBar.appendChild($buttons);
        }

        return this.$titleBar;
    }

    public dragHandle(): HTMLElement | undefined {
        return this.$titleBar;
    }

    public wrapClassName(className: string): string {
        return `${this.namespace}-${className}`;
    }

    public destroy(): void {
        if (this.$titleBar) {
            this.$titleBar.removeEventListener(
                "mousedown",
                this.handleTitleBarClick
            );
            this.$titleBar.removeEventListener(
                "touchstart",
                this.handleTitleBarClick
            );
            if (this.$buttons) {
                this.$buttons.removeEventListener("click", this.handleBtnClick);
                this.$buttons = void 0;
            }
            this.$titleBar = void 0;
            this.$title = void 0;
        }
    }

    public onEvent?: TeleTitleBarConfig["onEvent"];

    public onDragStart?: TeleTitleBarConfig["onDragStart"];

    protected title?: string;

    protected buttons: ReadonlyArray<DefaultTitleBarButton>;

    protected handleBtnClick = (ev: MouseEvent): void => {
        const target = ev.target as HTMLElement;
        const teleTitleBarBtnIndex = Number(
            target.dataset?.teleTitleBarBtnIndex
        );
        if (
            !Number.isNaN(teleTitleBarBtnIndex) &&
            teleTitleBarBtnIndex < this.buttons.length
        ) {
            preventEvent(ev);
            const btn = this.buttons[teleTitleBarBtnIndex];
            if (this.onEvent) {
                this.onEvent({
                    type: btn.type,
                    value: btn.value,
                } as TeleTitleBarEvent);
            }
        }
    };

    protected lastTitleBarClick = 0;

    protected handleTitleBarClick = (ev: MouseEvent | TouchEvent): void => {
        if (
            (ev as MouseEvent).button != null &&
            (ev as MouseEvent).button !== 0
        ) {
            return; // Not left mouse
        }

        if ((ev.target as HTMLElement).dataset?.teleTitleBarBtnIndex) {
            return; // btns
        }

        preventEvent(ev);

        const now = Date.now();
        if (now - this.lastTitleBarClick <= 500) {
            // double click
            if (this.onEvent) {
                this.onEvent({
                    type: TeleBoxEventType.State,
                    value: TeleBoxState.Maximized,
                });
            }
        } else if (this.onDragStart) {
            this.onDragStart(ev);
        }
        this.lastTitleBarClick = now;
    };

    protected static readonly defaultButtons: ReadonlyArray<DefaultTitleBarButton> =
        [
            {
                type: TeleBoxEventType.State,
                value: TeleBoxState.Minimized,
                icon: minimizeSVG,
            },
            {
                type: TeleBoxEventType.State,
                value: TeleBoxState.Maximized,
                icon: maximizeSVG,
            },
            {
                type: TeleBoxEventType.Close,
                icon: closeSVG,
            },
        ];
}
