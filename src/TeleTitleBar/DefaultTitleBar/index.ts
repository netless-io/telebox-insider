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
import type { ReadonlyVal } from "value-enhancer";

export type DefaultTitleBarButton = TeleTitleBarEvent & {
    readonly iconClassName: string;
    readonly isActive?: (state: TeleBoxState) => boolean;
};

export interface DefaultTitleBarConfig extends TeleTitleBarConfig {
    buttons?: ReadonlyArray<DefaultTitleBarButton>;
}

export class DefaultTitleBar implements TeleTitleBar {
    public constructor({
        readonly$,
        state$,
        title$,
        buttons,
        onEvent,
        onDragStart,
        namespace = "telebox",
    }: DefaultTitleBarConfig) {
        this.readonly$ = readonly$;
        this.state$ = state$;
        this.title$ = title$;
        this.onEvent = onEvent;
        this.onDragStart = onDragStart;
        this.namespace = namespace;

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

        this.$dragArea = this.renderDragArea();
    }

    public readonly namespace: string;

    public $titleBar: HTMLElement | undefined;

    public $dragArea: HTMLElement;

    public render(): HTMLElement {
        if (!this.$titleBar) {
            this.$titleBar = document.createElement("div");
            this.$titleBar.className = this.wrapClassName("titlebar");

            const $titleArea = document.createElement("div");
            $titleArea.className = this.wrapClassName("title-area");
            $titleArea.dataset.teleBoxHandle = TeleBoxDragHandleType;

            const $title = document.createElement("h1");
            $title.className = this.wrapClassName("title");
            $title.dataset.teleBoxHandle = TeleBoxDragHandleType;

            $titleArea.appendChild($title);
            $titleArea.appendChild(this.$dragArea);

            const $buttonsContainer = document.createElement("div");
            $buttonsContainer.className = this.wrapClassName("titlebar-btns");

            this.buttons.forEach(({ iconClassName }, i) => {
                const teleTitleBarBtnIndex = String(i);

                const $btn = document.createElement("button");
                $btn.className = `${this.wrapClassName(
                    "titlebar-btn"
                )} ${iconClassName}`;
                $btn.dataset.teleTitleBarBtnIndex = teleTitleBarBtnIndex;
                $btn.dataset.teleTitleBarNoDblClick = "true";
                $buttonsContainer.appendChild($btn);
            });

            this.sideEffect.addDisposer(
                this.title$.subscribe((title) => {
                    $title.textContent = title;
                    $title.title = title;
                }),
                "render-title"
            );

            this.sideEffect.addDisposer(
                this.state$.subscribe((state) => {
                    this.buttons.forEach((btn, i) => {
                        if (btn.isActive) {
                            $buttonsContainer.children[i]?.classList.toggle(
                                "is-active",
                                btn.isActive(state)
                            );
                        }
                    });
                }),
                "render-state-btns"
            );

            this.sideEffect.addEventListener(
                $buttonsContainer,
                "click",
                (ev) => {
                    if (this.readonly$.value) {
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
                },
                {},
                "render-btns-container-click"
            );

            this.$titleBar.appendChild($titleArea);
            this.$titleBar.appendChild($buttonsContainer);
        }

        return this.$titleBar;
    }

    public renderDragArea(): HTMLElement {
        const $dragArea = document.createElement("div");
        $dragArea.className = this.wrapClassName("drag-area");
        $dragArea.dataset.teleBoxHandle = TeleBoxDragHandleType;
        this.sideEffect.addEventListener(
            $dragArea,
            "pointerdown",
            this.handleTitleBarClick
        );
        return $dragArea;
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
            this.onDragStart = void 0;
            this.onEvent = void 0;
        }
    }

    public onEvent?: TeleTitleBarConfig["onEvent"];

    public onDragStart?: TeleTitleBarConfig["onDragStart"];

    protected readonly$: TeleTitleBarConfig["readonly$"];

    protected title$: ReadonlyVal<string>;

    protected buttons: ReadonlyArray<DefaultTitleBarButton>;

    protected state$: TeleTitleBarConfig["state$"];

    protected sideEffect = new SideEffectManager();

    protected lastTitleBarClick = {
        timestamp: 0,
        clientX: -100,
        clientY: -100,
    };

    protected handleTitleBarClick = (ev: PointerEvent): void => {
        if (!ev.isPrimary || this.readonly$.value) {
            return;
        }

        if (ev.button !== 0) {
            return; // Not left mouse
        }

        if ((ev.target as HTMLElement).dataset?.teleTitleBarNoDblClick) {
            return; // btns
        }

        preventEvent(ev);

        const now = Date.now();
        if (now - this.lastTitleBarClick.timestamp <= 500) {
            if (
                Math.abs(ev.clientX - this.lastTitleBarClick.clientX) <= 5 &&
                Math.abs(ev.clientY - this.lastTitleBarClick.clientY) <= 5
            ) {
                // double click
                if (this.onEvent) {
                    this.onEvent({ type: TELE_BOX_DELEGATE_EVENT.Maximize });
                }
            }
        } else if (this.onDragStart) {
            this.onDragStart(ev);
        }
        this.lastTitleBarClick.timestamp = now;
        this.lastTitleBarClick.clientX = ev.clientX;
        this.lastTitleBarClick.clientY = ev.clientY;
    };

    // protected lastTitleBarTouch = {
    //     timestamp: 0,
    //     clientX: -100,
    //     clientY: -100,
    // };

    // protected handleTitleBarTouch = (ev: TouchEvent): void => {
    //     if (this.readonly$.value) {
    //         return;
    //     }

    //     if ((ev.target as HTMLElement).dataset?.teleTitleBarNoDblClick) {
    //         return; // btns
    //     }

    //     preventEvent(ev);

    //     const now = Date.now();
    //     const {
    //         clientX = this.lastTitleBarTouch.clientX + 100,
    //         clientY = this.lastTitleBarTouch.clientY + 100,
    //     } = ev.touches[0] || {};

    //     if (now - this.lastTitleBarTouch.timestamp <= 500) {
    //         if (
    //             Math.abs(clientX - this.lastTitleBarTouch.clientX) <= 10 &&
    //             Math.abs(clientY - this.lastTitleBarTouch.clientY) <= 10
    //         ) {
    //             // double click
    //             if (this.onEvent) {
    //                 this.onEvent({ type: TELE_BOX_DELEGATE_EVENT.Maximize });
    //             }
    //         }
    //     } else if (this.onDragStart) {
    //         this.onDragStart(ev);
    //     }
    //     this.lastTitleBarTouch.timestamp = now;
    //     this.lastTitleBarTouch.clientX = clientX;
    //     this.lastTitleBarTouch.clientY = clientY;
    // };
}
