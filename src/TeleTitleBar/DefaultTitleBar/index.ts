import "./style.scss";

import minimizeSVG from "./icons/minimize.svg";
import maximizeSVG from "./icons/maximize.svg";
import closeSVG from "./icons/close.svg";

import { TeleBox, TeleBoxEventArgs } from "../../TeleBox";
import {
    TeleBoxDragHandleType,
    TeleBoxEventType,
    TeleBoxState,
} from "../../TeleBox/constants";
import type { TeleTitleBar, TeleTitleBarEventType } from "../typings";
import { preventEvent } from "../../utils";

export interface DefaultTitleBarButton<
    T extends TeleTitleBarEventType = TeleTitleBarEventType
> {
    readonly type: T;
    readonly value: TeleBoxEventArgs[T];
    readonly icon: string;
}

export class DefaultTitleBar implements TeleTitleBar {
    public constructor(buttons?: ReadonlyArray<DefaultTitleBarButton>) {
        this.buttons = buttons || DefaultTitleBar.defaultButtons;
    }

    public $titleBar: HTMLElement | undefined;

    public $title: HTMLElement | undefined;

    public updateTitle(title: string): void {
        if (this.$title) {
            this.$title.textContent = title;
        }
    }

    public render(teleBox: TeleBox): HTMLElement {
        if (!this.$titleBar) {
            this.$titleBar = document.createElement("div");
            this.$titleBar.className = teleBox.wrapClassName("titlebar");
            this.$titleBar.dataset.teleBoxHandle = TeleBoxDragHandleType;

            this.$title = document.createElement("h1");
            this.$title.className = teleBox.wrapClassName("title");
            this.$title.dataset.teleBoxHandle = TeleBoxDragHandleType;
            this.$title.textContent = teleBox.title;
            this.$title.title = teleBox.title;

            const $buttons = document.createElement("div");
            $buttons.className = teleBox.wrapClassName("titlebar-btns");

            this.buttons.forEach(({ type, icon }) => {
                const $btn = document.createElement("button");
                $btn.className = teleBox.wrapClassName("titlebar-btn");
                $btn.dataset.teleBoxEventType = type;

                const $img = document.createElement("img");
                $img.className = teleBox.wrapClassName("titlebar-btn-icon");
                $img.src = icon;
                $btn.dataset.teleBoxEventType = type;

                $btn.appendChild($img);
                $buttons.appendChild($btn);
            });

            this.handleBtnClick = (ev: MouseEvent): void => {
                const target = ev.target as HTMLElement;
                const teleBoxEventType = target.dataset?.teleBoxEventType;
                const btn = this.buttons.find(
                    (btn) => btn.type === teleBoxEventType
                );
                if (btn) {
                    preventEvent(ev);
                    teleBox.events.emit(btn.type, ...btn.value);
                }
            };

            this.$titleBar.addEventListener("click", this.handleBtnClick);

            this.$titleBar.appendChild(this.$title);
            this.$titleBar.appendChild($buttons);
        }

        return this.$titleBar;
    }

    public dragHandle(): HTMLElement | undefined {
        return this.$titleBar;
    }

    public destroy(): void {
        if (this.$titleBar) {
            if (this.handleBtnClick) {
                this.$titleBar.removeEventListener(
                    "click",
                    this.handleBtnClick
                );
            }
            this.$titleBar = void 0;
            this.$title = void 0;
        }
    }

    protected buttons: ReadonlyArray<DefaultTitleBarButton>;

    protected handleBtnClick: ((ev: MouseEvent) => void) | undefined;

    protected static readonly defaultButtons: ReadonlyArray<DefaultTitleBarButton> =
        [
            {
                type: TeleBoxEventType.State,
                value: [TeleBoxState.Minimized],
                icon: minimizeSVG,
            },
            {
                type: TeleBoxEventType.State,
                value: [TeleBoxState.Maximized],
                icon: maximizeSVG,
            },
            {
                type: TeleBoxEventType.Close,
                value: [],
                icon: closeSVG,
            },
        ];
}
