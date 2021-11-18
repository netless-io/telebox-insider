import "./style.scss";

import { SideEffectManager } from "side-effect-manager";

import {
    TeleBoxDragHandleType,
    TELE_BOX_DELEGATE_EVENT,
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
    readonly iconClassName: string;
    readonly isActive?: (state: TeleBoxState) => boolean;
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
        this.onEvent = onEvent;
        this.onDragStart = onDragStart;
        this.namespace = namespace;
        this.title = title;
        this.state = state;

        this.buttons = buttons || [
            {
                type: TELE_BOX_DELEGATE_EVENT.Minimize,
                iconClassName: this.wrapClassName("titlebar-icon-minimize"),
            },
            {
                type: TELE_BOX_DELEGATE_EVENT.Maximize,
                iconClassName: this.wrapClassName("titlebar-icon-maximize"),
                isActive: (state) => state === TELE_BOX_STATE.Maximized,
            },
            {
                type: TELE_BOX_DELEGATE_EVENT.Close,
                iconClassName: this.wrapClassName("titlebar-icon-close"),
            },
        ];
    }

    public readonly namespace: string;

    public $titleBar: HTMLElement | undefined;

    public $title: HTMLElement | undefined;

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
                if (btn.isActive) {
                    this.$btns[i].classList.toggle(
                        "is-active",
                        btn.isActive(state)
                    );
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
            this.sideEffect.addEventListener(
                this.$titleBar,
                "mousedown",
                this.handleTitleBarClick
            );
            this.sideEffect.addEventListener(
                this.$titleBar,
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

            const $buttonsContainer = document.createElement("div");
            $buttonsContainer.className = this.wrapClassName("titlebar-btns");

            this.buttons.forEach(({ iconClassName, isActive }, i) => {
                const teleTitleBarBtnIndex = String(i);

                const $btn = document.createElement("button");
                $btn.className = `${this.wrapClassName(
                    "titlebar-btn"
                )} ${iconClassName}`;
                $btn.dataset.teleTitleBarBtnIndex = teleTitleBarBtnIndex;
                $btn.dataset.teleTitleBarNoDblClick = "true";

                if (isActive) {
                    $btn.classList.toggle("is-active", isActive(this.state));
                }

                this.$btns.push($btn);

                $buttonsContainer.appendChild($btn);
            });

            this.sideEffect.addEventListener(
                $buttonsContainer,
                "click",
                (ev) => {
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
                }
            );

            this.$titleBar.appendChild(this.$title);
            this.$titleBar.appendChild($buttonsContainer);
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
        this.sideEffect.flushAll();
        if (this.$titleBar) {
            this.$titleBar = void 0;
            this.$title = void 0;
            this.$btns.length = 0;
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

    protected $btns: HTMLButtonElement[] = [];

    protected sideEffect = new SideEffectManager();

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
                this.onEvent({ type: TELE_BOX_DELEGATE_EVENT.Maximize });
            }
        } else if (this.onDragStart) {
            this.onDragStart(ev);
        }
        this.lastTitleBarClick = now;
    };
}
