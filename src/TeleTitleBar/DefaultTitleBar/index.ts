import "./style.scss";

import minimizeSVG from "./icons/minimize.svg";
import maximizeActiveSVG from "./icons/maximize-active.svg";
import maximizeSVG from "./icons/maximize.svg";
import closeSVG from "./icons/close.svg";

import {
    TeleBoxDragHandleType,
    TELE_BOX_EVENT,
    TELE_BOX_STATE,
} from "../../TeleBox/constants";
import type { TeleBoxState } from "../../TeleBox/typings";
import type {
    TeleTitleBar,
    TeleTitleBarConfig,
    TeleTitleBarEvent,
} from "../typings";
import { preventEvent } from "../../utils";

export type DefaultTitleBarButton = TeleTitleBarEvent & {
    readonly icon: string | ((state: TeleBoxState) => string);
};

export interface DefaultTitleBarConfig extends TeleTitleBarConfig {
    buttons?: ReadonlyArray<DefaultTitleBarButton>;
}

export class DefaultTitleBar implements TeleTitleBar {
    public constructor({
        readonly = false,
        title,
        buttons,
        onEvent,
        onDragStart,
        namespace = "telebox",
        state = TELE_BOX_STATE.Normal,
    }: DefaultTitleBarConfig = {}) {
        this.readonly = readonly;
        this.buttons = buttons || DefaultTitleBar.defaultButtons;
        this.onEvent = onEvent;
        this.onDragStart = onDragStart;
        this.namespace = namespace;
        this.title = title;
        this.state = state;
    }

    public readonly namespace: string;

    public $titleBar: HTMLElement | undefined;

    public $title: HTMLElement | undefined;

    public $buttons: HTMLElement | undefined;

    public setTitle(title: string): void {
        this.title = title;
        if (this.$title) {
            this.$title.textContent = title;
            this.$title.title = title;
        }
    }

    public setState(state: TeleBoxState): void {
        if (this.state !== state) {
            this.state = state;

            this.buttons.forEach((btn, i) => {
                if (typeof btn.icon === "function") {
                    const $img = this.$btnImgs[i];
                    if ($img) {
                        $img.src = btn.icon(state);
                    }
                }
            });
        }
    }

    public setReadonly(readonly: boolean): void {
        if (this.readonly !== readonly) {
            this.readonly = readonly;
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
                this.handleTitleBarClick,
                { passive: true }
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

            this.$btnImgs.length = 0;
            this.buttons.forEach(({ icon }, i) => {
                const teleTitleBarBtnIndex = String(i);

                const $btn = document.createElement("button");
                $btn.className = this.wrapClassName("titlebar-btn");
                $btn.dataset.teleTitleBarBtnIndex = teleTitleBarBtnIndex;
                $btn.dataset.teleTitleBarNoDblClick = "true";

                const $img = document.createElement("img");
                $img.className = this.wrapClassName("titlebar-btn-icon");
                $img.src = typeof icon === "function" ? icon(this.state) : icon;
                $img.dataset.teleTitleBarBtnIndex = teleTitleBarBtnIndex;
                $img.dataset.teleTitleBarNoDblClick = "true";

                this.$btnImgs.push($img);

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
            this.$btnImgs.length = 0;
            this.onDragStart = void 0;
            this.onEvent = void 0;
        }
    }

    public onEvent?: TeleTitleBarConfig["onEvent"];

    public onDragStart?: TeleTitleBarConfig["onDragStart"];

    protected readonly: boolean;

    protected title?: string;

    protected buttons: ReadonlyArray<DefaultTitleBarButton>;

    protected state: TeleBoxState;

    protected $btnImgs: HTMLImageElement[] = [];

    protected handleBtnClick = (ev: MouseEvent): void => {
        if (this.readonly) {
            return;
        }

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
        if (this.readonly) {
            return;
        }

        if (
            (ev as MouseEvent).button != null &&
            (ev as MouseEvent).button !== 0
        ) {
            return; // Not left mouse
        }

        if ((ev.target as HTMLElement).dataset?.teleTitleBarNoDblClick) {
            return; // btns
        }

        preventEvent(ev);

        const now = Date.now();
        if (now - this.lastTitleBarClick <= 500) {
            // double click
            if (this.onEvent) {
                this.onEvent({
                    type: TELE_BOX_EVENT.State,
                    value: TELE_BOX_STATE.Maximized,
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
                type: TELE_BOX_EVENT.State,
                value: TELE_BOX_STATE.Minimized,
                icon: minimizeSVG,
            },
            {
                type: TELE_BOX_EVENT.State,
                value: TELE_BOX_STATE.Maximized,
                icon: (state) =>
                    state === TELE_BOX_STATE.Maximized
                        ? maximizeActiveSVG
                        : maximizeSVG,
            },
            {
                type: TELE_BOX_EVENT.Close,
                icon: closeSVG,
            },
        ];
}
