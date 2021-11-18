import "./style.scss";

import EventEmitter from "eventemitter3";
import styler from "stylefire";
import shallowequal from "shallowequal";
import { DefaultTitleBar, TeleTitleBar } from "../TeleTitleBar";
import {
    clamp,
    flattenEvent,
    genUniqueKey,
    getBoxDefaultName,
    isFalsy,
    isTruthy,
    preventEvent,
} from "../utils";
import {
    TELE_BOX_EVENT,
    TELE_BOX_STATE,
    TELE_BOX_RESIZE_HANDLE,
    TELE_BOX_DELEGATE_EVENT,
} from "./constants";
import type {
    TeleBoxConfig,
    TeleBoxRect,
    TeleBoxEvents,
    TeleBoxHandleType,
    TeleBoxState,
    TeleBoxDelegateEvents,
    TeleBoxCoord,
    TeleBoxSize,
} from "./typings";
import { SideEffectManager } from "side-effect-manager";
import { Val, CombinedVal } from "../Val";

export * from "./constants";
export * from "./typings";

export class TeleBox {
    public constructor({
        id = genUniqueKey(),
        title = getBoxDefaultName(),
        visible = true,
        width = 0.5,
        height = 0.5,
        minWidth = 0,
        minHeight = 0,
        x = 0.1,
        y = 0.1,
        minimized = false,
        maximized = false,
        readonly = false,
        resizable = true,
        draggable = true,
        fence = true,
        fixRatio = false,
        focus = false,
        zIndex = 100,
        namespace = "telebox",
        titleBar,
        content,
        footer,
        styles,
        containerRect = {
            x: 0,
            y: 0,
            width: window.innerWidth,
            height: window.innerHeight,
        },
        collectorRect,
    }: TeleBoxConfig = {}) {
        this._sideEffect = new SideEffectManager();

        this.id = id;
        this.namespace = namespace;
        this.events = new EventEmitter();
        this._delegateEvents = new EventEmitter();

        this._containerRect = new Val(containerRect, shallowequal);
        this._collectorRect = new Val(collectorRect, shallowequal);

        this._title = new Val(title);

        this._visible = new Val(visible);
        this._visible.reaction((visible, skipUpdate) => {
            if (!skipUpdate && !visible) {
                this.events.emit(TELE_BOX_EVENT.Close);
            }
        });

        this._readonly = new Val(readonly);
        this._readonly.reaction((readonly, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.Readonly, readonly);
            }
        });

        this._resizable = new Val(resizable);
        this._draggable = new Val(draggable);
        this._fence = new Val(fence);
        this._fixRatio = new Val(fixRatio);
        this._zIndex = new Val(zIndex);

        this._focus = new Val(focus);
        this._focus.reaction((focus, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(
                    focus ? TELE_BOX_EVENT.Focus : TELE_BOX_EVENT.Blur
                );
            }
        });

        this._minimized = new Val(minimized);
        this._minimized.reaction((minimized, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.Minimized, minimized);
            }
        });

        this._maximized = new Val(maximized);
        this._maximized.reaction((maximized, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.Maximized, maximized);
            }
        });

        this._state = new CombinedVal(
            [this._minimized, this._maximized],
            ([minimized, maximized]): TeleBoxState =>
                minimized
                    ? TELE_BOX_STATE.Minimized
                    : maximized
                    ? TELE_BOX_STATE.Maximized
                    : TELE_BOX_STATE.Normal
        );
        this._state.reaction((state, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.State, state);
            }
        });

        this._minSize = new Val(
            {
                width: clamp(minWidth, 0, 1),
                height: clamp(minHeight, 0, 1),
            },
            shallowequal
        );

        this._intrinsicSize = new Val(
            {
                width: clamp(width, this._minSize.value.width, 1),
                height: clamp(height, this._minSize.value.height, 1),
            },
            shallowequal
        );
        this._minSize.reaction((minSize, skipUpdate) => {
            this._intrinsicSize.setValue(
                {
                    width: clamp(width, minSize.width, 1),
                    height: clamp(height, minSize.height, 1),
                },
                skipUpdate
            );
        });
        this._intrinsicSize.reaction((size, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.IntrinsicResize, size);
            }
        });

        this._size = new CombinedVal(
            [this._intrinsicSize, this._maximized],
            ([intrinsicSize, maximized]) => {
                if (maximized) {
                    return { width: 1, height: 1 };
                }
                return intrinsicSize;
            },
            shallowequal
        );
        this._size.reaction((size, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.Resize, size);
            }
        });

        this._visualSize = new CombinedVal(
            [
                this._size,
                this._minimized,
                this._containerRect,
                this._collectorRect,
            ],
            ([size, minimized, containerRect, collectorRect]) => {
                if (minimized && collectorRect) {
                    return {
                        width:
                            collectorRect.width /
                            size.width /
                            containerRect.width,
                        height:
                            collectorRect.height /
                            size.height /
                            containerRect.height,
                    };
                }
                return size;
            },
            shallowequal
        );
        this._visualSize.reaction((size, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.VisualResize, size);
            }
        });

        this._intrinsicCoord = new Val(
            { x: clamp(x, 0, 1), y: clamp(y, 0, 1) },
            shallowequal
        );
        this._intrinsicCoord.reaction((coord, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.IntrinsicMove, coord);
            }
        });

        this._coord = new CombinedVal(
            [
                this._intrinsicCoord,
                this._intrinsicSize,
                this._containerRect,
                this._collectorRect,
                this._minimized,
                this._maximized,
            ],
            ([
                intrinsicCoord,
                intrinsicSize,
                containerRect,
                collectorRect,
                minimized,
                maximized,
            ]) => {
                if (minimized && collectorRect) {
                    if (maximized) {
                        return {
                            x:
                                (collectorRect.x + collectorRect.width / 2) /
                                    containerRect.width -
                                1 / 2,
                            y:
                                (collectorRect.y + collectorRect.height / 2) /
                                    containerRect.height -
                                1 / 2,
                        };
                    }
                    return {
                        x:
                            (collectorRect.x + collectorRect.width / 2) /
                                containerRect.width -
                            intrinsicSize.width / 2,
                        y:
                            (collectorRect.y + collectorRect.height / 2) /
                                containerRect.height -
                            intrinsicSize.height / 2,
                    };
                }
                if (maximized) {
                    return { x: 0, y: 0 };
                }
                return intrinsicCoord;
            },
            shallowequal
        );
        this._coord.reaction((coord, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.Move, coord);
            }
        });

        this.titleBar =
            titleBar ||
            new DefaultTitleBar({
                readonly: this.readonly,
                title: this.title,
                namespace: this.namespace,
                onDragStart: (event) => this._handleTrackStart?.(event),
                onEvent: (event): void => {
                    if (this._delegateEvents.listeners.length > 0) {
                        this._delegateEvents.emit(event.type);
                    } else {
                        switch (event.type) {
                            case TELE_BOX_DELEGATE_EVENT.Maximize: {
                                this._maximized.setValue(!this._maximized);
                                break;
                            }
                            case TELE_BOX_DELEGATE_EVENT.Minimize: {
                                this._minimized.setValue(true);
                                break;
                            }
                            case TELE_BOX_DELEGATE_EVENT.Close: {
                                this._visible.setValue(false);
                                break;
                            }
                            default: {
                                console.error(
                                    "Unsupported titleBar event:",
                                    event
                                );
                                break;
                            }
                        }
                    }
                },
            });
        this._readonly.reaction((readonly) => {
            this.titleBar.setReadonly(readonly);
        });

        this._$userContent = new Val(content);
        this._$userFooter = new Val(footer);
        this._$userStyles = new Val(styles);

        if (this.fixRatio) {
            this.transform(this.x, this.y, this.width, this.height, true);
        }

        this.$box = this.render();
    }

    public readonly id: string;

    /** Classname Prefix. For CSS styling. Default "telebox" */
    public readonly namespace: string;

    public readonly events: TeleBoxEvents;

    public readonly _delegateEvents: TeleBoxDelegateEvents;

    protected _sideEffect: SideEffectManager;

    public titleBar: TeleTitleBar;

    protected _containerRect: Val<TeleBoxRect, boolean>;

    public get containerRect(): TeleBoxRect {
        return this._containerRect.value;
    }

    public setContainerRect(rect: TeleBoxRect, skipUpdate = false): this {
        this._containerRect.setValue(rect, skipUpdate);
        return this;
    }

    protected _collectorRect: Val<TeleBoxRect | undefined, boolean>;

    public get collectorRect(): TeleBoxRect | undefined {
        return this._collectorRect.value;
    }

    public setCollectorRect(rect: TeleBoxRect, skipUpdate = false): this {
        this._collectorRect.setValue(rect, skipUpdate);
        return this;
    }

    protected _title: Val<string, boolean>;

    /** Box title. Default empty. */
    public get title(): string {
        return this._title.value;
    }

    /**
     * Update box title.
     * @param title new box title
     * @returns this
     */
    public setTitle(title: string): this {
        this._title.setValue(title);
        return this;
    }

    protected _visible: Val<boolean, boolean>;

    public get visible(): boolean {
        return this._visible.value;
    }

    public setVisible(visible: boolean, skipUpdate = false): this {
        this._visible.setValue(visible, skipUpdate);
        return this;
    }

    protected _readonly: Val<boolean, boolean>;

    /** Is box readonly */
    public get readonly(): boolean {
        return this._readonly.value;
    }

    public setReadonly(readonly: boolean, skipUpdate = false): this {
        this._readonly.setValue(readonly, skipUpdate);
        return this;
    }

    protected _resizable: Val<boolean, boolean>;

    /** Able to resize box window */
    public get resizable(): boolean {
        return this._resizable.value;
    }

    public setResizable(resizable: boolean, skipUpdate = false): this {
        this._resizable.setValue(resizable, skipUpdate);
        return this;
    }

    protected _draggable: Val<boolean, boolean>;

    /** Able to drag box window */
    public get draggable(): boolean {
        return this._draggable.value;
    }

    public setDraggable(draggable: boolean, skipUpdate = false): this {
        this._draggable.setValue(draggable, skipUpdate);
        return this;
    }

    protected _fence: Val<boolean, boolean>;

    /** Restrict box to always be within the containing area. */
    public get fence(): boolean {
        return this._fence.value;
    }

    public setFence(fence: boolean, skipUpdate = false): this {
        this._fence.setValue(fence, skipUpdate);
        return this;
    }

    protected _fixRatio: Val<boolean, boolean>;

    /** Fixed width/height ratio for box window. */
    public get fixRatio(): boolean {
        return this._fixRatio.value;
    }

    public setFixRatio(fixRatio: boolean, skipUpdate = false): this {
        this._fixRatio.setValue(fixRatio, skipUpdate);
        return this;
    }

    protected _focus: Val<boolean, boolean>;

    public get focus(): boolean {
        return this._focus.value;
    }

    public setFocus(focus: boolean, skipUpdate = false): this {
        this._focus.setValue(focus, skipUpdate);
        return this;
    }

    protected _zIndex: Val<number, boolean>;

    public get zIndex(): number {
        return this._zIndex.value;
    }

    public setZIndex(zIndex: number, skipUpdate = false): this {
        this._zIndex.setValue(zIndex, skipUpdate);
        return this;
    }

    protected _minimized: Val<boolean, boolean>;

    public get minimized(): boolean {
        return this._minimized.value;
    }

    public setMinimized(minimized: boolean, skipUpdate = false): this {
        this._minimized.setValue(minimized, skipUpdate);
        return this;
    }

    protected _maximized: Val<boolean, boolean>;

    public get maximized(): boolean {
        return this._maximized.value;
    }

    public setMaximized(maximized: boolean, skipUpdate = false): this {
        this._maximized.setValue(maximized, skipUpdate);
        return this;
    }

    protected _state: Val<TeleBoxState, boolean>;

    /** Is box maximized. Default false. */
    public get state(): TeleBoxState {
        return this._state.value;
    }

    /** @deprecated use setMaximized and setMinimized instead */
    public setState(state: TeleBoxState, skipUpdate = false): this {
        switch (state) {
            case TELE_BOX_STATE.Maximized: {
                this.setMinimized(false, skipUpdate);
                this.setMaximized(true, skipUpdate);
                break;
            }
            case TELE_BOX_STATE.Minimized: {
                this.setMinimized(true, skipUpdate);
                this.setMaximized(false, skipUpdate);
                break;
            }
            default: {
                this.setMinimized(false, skipUpdate);
                this.setMaximized(false, skipUpdate);
                break;
            }
        }
        return this;
    }

    protected _minSize: Val<TeleBoxSize, boolean>;

    /** Minimum box width relative to container element. 0~1. Default 0. */
    public get minWidth(): number {
        return this._minSize.value.width;
    }

    /** Minimum box height relative to container element. 0~1. Default 0. */
    public get minHeight(): number {
        return this._minSize.value.height;
    }

    public setMinSize(size: TeleBoxSize, skipUpdate = false): this {
        this._minSize.setValue(size, skipUpdate);
        return this;
    }

    /**
     * @param minWidth Minimum box width relative to container element. 0~1.
     * @returns this
     */
    public setMinWidth(minWidth: number, skipUpdate = false): this {
        this._minSize.setValue(
            { width: minWidth, height: this.minHeight },
            skipUpdate
        );
        return this;
    }

    /**
     * @param minHeight Minimum box height relative to container element. 0~1.
     * @returns this
     */
    public setMinHeight(minHeight: number, skipUpdate = false): this {
        this._minSize.setValue(
            { width: this.minWidth, height: minHeight },
            skipUpdate
        );
        return this;
    }

    protected _intrinsicSize: Val<TeleBoxSize, boolean>;

    /** Intrinsic box width relative to container element(without counting the effect of maximization or minimization). 0~1. Default 0.5. */
    public get intrinsicWidth(): number {
        return this._intrinsicSize.value.width;
    }

    /** Intrinsic box height relative to container element(without counting the effect of maximization or minimization). 0~1. Default 0.5. */
    public get intrinsicHeight(): number {
        return this._intrinsicSize.value.height;
    }

    public setIntrinsicSize(size: TeleBoxSize, skipUpdate = false): this {
        this._intrinsicSize.setValue(size, skipUpdate);
        return this;
    }

    /**
     * Resize box.
     * @param width Box width relative to container element. 0~1.
     * @param height Box height relative to container element. 0~1.
     * @param skipUpdate Skip emitting event.
     * @returns this
     */
    public resize(width: number, height: number, skipUpdate = false): this {
        this._intrinsicSize.setValue({ width, height }, skipUpdate);
        return this;
    }

    protected _size: Val<TeleBoxSize, boolean>;

    /** Box width relative to container element. 0~1. Default 0.5. */
    public get width(): number {
        return this._size.value.width;
    }

    /** Box height relative to container element. 0~1. Default 0.5. */
    public get height(): number {
        return this._size.value.height;
    }

    /** Box width in pixels. */
    public get absoluteWidth(): number {
        return this.width * this.containerRect.width;
    }

    /** Box height in pixels. */
    public get absoluteHeight(): number {
        return this.height * this.containerRect.height;
    }

    protected _visualSize: Val<TeleBoxSize, boolean>;

    /** Actual rendered box width relative to container element. 0~1. Default 0.5. */
    public get visualWidth(): number {
        return this._visualSize.value.width;
    }

    /** Actual rendered box height relative to container element. 0~1. Default 0.5. */
    public get visualHeight(): number {
        return this._visualSize.value.height;
    }

    protected _intrinsicCoord: Val<TeleBoxCoord, boolean>;

    /** Intrinsic box x position relative to container element(without counting the effect of maximization or minimization). 0~1. Default 0.1. */
    public get intrinsicX(): number {
        return this._intrinsicCoord.value.x;
    }

    /** Intrinsic box y position relative to container element(without counting the effect of maximization or minimization). 0~1. Default 0.1. */
    public get intrinsicY(): number {
        return this._intrinsicCoord.value.y;
    }

    public setIntrinsicCoord(coord: TeleBoxCoord, skipUpdate = false): this {
        this._intrinsicCoord.setValue(coord, skipUpdate);
        return this;
    }

    /**
     * Move box position.
     * @param x x position relative to container element. 0~1.
     * @param y y position relative to container element. 0~1.
     * @param skipUpdate Skip emitting event.
     * @returns this
     */
    public move(x: number, y: number, skipUpdate = false): this {
        this._intrinsicCoord.setValue({ x, y }, skipUpdate);
        return this;
    }

    protected _coord: Val<TeleBoxCoord, boolean>;

    /** Box x position relative to container element. 0~1. Default 0.1. */
    public get x(): number {
        return this._coord.value.x;
    }

    /** Box y position relative to container element. 0~1. Default 0.1. */
    public get y(): number {
        return this._coord.value.y;
    }

    /**
     * Resize + Move, with respect to fixed ratio.
     * @param x x position relative to container element. 0~1.
     * @param y y position relative to container element. 0~1.
     * @param width Box width relative to container element. 0~1.
     * @param height Box height relative to container element. 0~1.
     * @param skipUpdate Skip emitting event.
     * @returns this
     */
    public transform(
        x: number,
        y: number,
        width: number,
        height: number,
        skipUpdate = false
    ): this {
        if (this.fixRatio) {
            const newHeight =
                (this.intrinsicHeight / this.intrinsicWidth) * width;
            if (y !== this.intrinsicY) {
                y -= newHeight - height;
            }
            height = newHeight;
        }

        if (y < 0) {
            y = 0;
            if (height > this.intrinsicHeight) {
                height = this.intrinsicHeight;
            }
        }

        this.setIntrinsicCoord(
            {
                x: width >= this.minWidth ? x : this.intrinsicX,
                y: height >= this.minHeight ? y : this.intrinsicY,
            },
            skipUpdate
        );
        this.setIntrinsicSize(
            {
                width: clamp(width, this.minWidth, 1),
                height: clamp(height, this.minHeight, 1),
            },
            skipUpdate
        );

        return this;
    }

    protected _$userContent: Val<HTMLElement | undefined>;

    public get $userContent(): HTMLElement | undefined {
        return this._$userContent.value;
    }

    /**
     * Mount box to a container element.
     */
    public mount(container: HTMLElement): this {
        container.appendChild(this.render());
        return this;
    }

    /**
     * Unmount box from the container element.
     */
    public unmount(): this {
        if (this.$box) {
            this.$box.remove();
        }
        return this;
    }

    /**
     * Mount dom to box content.
     */
    public mountContent(content: HTMLElement): this {
        this._$userContent.setValue(content);
        return this;
    }

    /**
     * Unmount content from the box.
     */
    public unmountContent(): this {
        this._$userContent.setValue(undefined);
        return this;
    }

    protected _$userFooter: Val<HTMLElement | undefined>;

    public get $userFooter(): HTMLElement | undefined {
        return this._$userFooter.value;
    }

    /**
     * Mount dom to box Footer.
     */
    public mountFooter(footer: HTMLElement): this {
        this._$userFooter.setValue(footer);
        return this;
    }

    /**
     * Unmount Footer from the box.
     */
    public unmountFooter(): this {
        this._$userFooter.setValue(undefined);
        return this;
    }

    protected _$userStyles: Val<HTMLStyleElement | undefined>;

    public getUserStyles(): HTMLStyleElement | undefined {
        return this._$userStyles.value;
    }

    public mountStyles(styles: string | HTMLStyleElement): this {
        let $styles: HTMLStyleElement;
        if (typeof styles === "string") {
            $styles = document.createElement("style");
            $styles.textContent = styles;
        } else {
            $styles = styles;
        }
        this._$userStyles.setValue($styles);
        return this;
    }

    public unmountStyles(): this {
        this._$userStyles.setValue(undefined);
        return this;
    }

    /** DOM of the box */
    public $box: HTMLElement;

    /** DOM of the box content */
    public $content!: HTMLElement;

    /** DOM of the box footer */
    public $footer!: HTMLElement;

    protected _renderSideEffect = new SideEffectManager();

    public render(root?: HTMLElement): HTMLElement {
        if (root) {
            if (root === this.$box) {
                return this.$box;
            } else {
                this.$box = root;
            }
        } else {
            if (this.$box) {
                return this.$box;
            } else {
                this.$box = document.createElement("div");
            }
        }

        this._renderSideEffect.flushAll();

        this.$box.classList.add(this.wrapClassName("box"));

        const bindClassName = <TValue>(
            el: Element,
            val: Val<TValue, boolean>,
            className: string,
            predicate: (value: TValue) => boolean = isTruthy
        ): string => {
            return this._renderSideEffect.add(() => {
                const wrappedClassName = this.wrapClassName(className);
                return val.subscribe((value) => {
                    el.classList.toggle(wrappedClassName, predicate(value));
                });
            });
        };

        bindClassName(this.$box, this._readonly, "readonly");
        bindClassName(this.$box, this._draggable, "no-drag", isFalsy);
        bindClassName(this.$box, this._resizable, "no-resize", isFalsy);
        bindClassName(this.$box, this._focus, "blur", isFalsy);

        this._renderSideEffect.add(() => {
            const minimizedClassName = this.wrapClassName("minimized");
            const maximizedClassName = this.wrapClassName("maximized");
            const MAXIMIZED_TIMER_ID = "box-maximized-timer";

            return this._state.subscribe((state) => {
                this.$box.classList.toggle(
                    minimizedClassName,
                    state === TELE_BOX_STATE.Minimized
                );

                if (state === TELE_BOX_STATE.Maximized) {
                    this._renderSideEffect.flush(MAXIMIZED_TIMER_ID);
                    this.$box.classList.toggle(maximizedClassName, true);
                } else {
                    // delay so that transition won't be triggered
                    this._renderSideEffect.setTimeout(
                        () => {
                            this.$box.classList.toggle(
                                maximizedClassName,
                                false
                            );
                        },
                        0,
                        MAXIMIZED_TIMER_ID
                    );
                }
            });
        });

        this._renderSideEffect.add(() =>
            this._visible.subscribe((visible) => {
                this.$box.style.display = visible ? "block" : "none";
            })
        );

        this._renderSideEffect.add(() =>
            this._zIndex.subscribe((zIndex) => {
                this.$box.style.zIndex = String(zIndex);
            })
        );

        const boxStyler = styler(this.$box);

        this.$box.dataset.teleBoxID = this.id;

        this.$box.style.width = this.absoluteWidth + "px";
        this.$box.style.height = this.absoluteHeight + "px";
        // Add 10px offset on first frame
        // which creates a subtle moving effect
        const translateX =
            this.x * this.containerRect.width + this.containerRect.x;
        const translateY =
            this.y * this.containerRect.height + this.containerRect.y;
        this.$box.style.transform = `translate(${translateX - 10}px,${
            translateY - 10
        }px)`;

        this._renderSideEffect.add(() => {
            const combined = new CombinedVal(
                [
                    this._coord,
                    this._size,
                    this._minimized,
                    this._containerRect,
                    this._collectorRect,
                ],
                ([coord, size, minimized, containerRect, collectorRect]) => {
                    const absoluteWidth = size.width * containerRect.width;
                    const absoluteHeight = size.height * containerRect.height;
                    return {
                        width: absoluteWidth,
                        height: absoluteHeight,
                        x: coord.x * containerRect.width,
                        y: coord.y * containerRect.height,
                        scaleX:
                            minimized && collectorRect
                                ? collectorRect.width / absoluteWidth
                                : 1,
                        scaleY:
                            minimized && collectorRect
                                ? collectorRect.height / absoluteHeight
                                : 1,
                    };
                },
                shallowequal
            );

            combined.subscribe((styles) => {
                boxStyler.set(styles);
            });

            return () => {
                combined.destroy();
            };
        });

        boxStyler.set({ x: translateX, y: translateY });

        const $boxMain = document.createElement("div");
        $boxMain.className = this.wrapClassName("box-main");
        this.$box.appendChild($boxMain);

        const $titleBar = document.createElement("div");
        $titleBar.className = this.wrapClassName("titlebar-wrap");
        $titleBar.appendChild(this.titleBar.render());

        const $contentWrap = document.createElement("div");
        $contentWrap.className = this.wrapClassName("content-wrap");

        const $content = document.createElement("div");
        $content.className =
            this.wrapClassName("content") + " tele-fancy-scrollbar";
        this.$content = $content;

        this._renderSideEffect.add(() => {
            let last$userStyles: HTMLStyleElement | undefined;
            return this._$userStyles.subscribe(($userStyles) => {
                if (last$userStyles) {
                    last$userStyles.remove();
                }
                last$userStyles = $userStyles;
                if ($userStyles) {
                    $content.appendChild($userStyles);
                }
            });
        });

        this._renderSideEffect.add(() => {
            let last$userContent: HTMLElement | undefined;
            return this._$userContent.subscribe(($userContent) => {
                if (last$userContent) {
                    last$userContent.remove();
                }
                last$userContent = $userContent;
                if ($userContent) {
                    $content.appendChild($userContent);
                }
            });
        });

        $contentWrap.appendChild($content);

        const $footer = document.createElement("div");
        $footer.className = this.wrapClassName("footer-wrap");
        this.$footer = $footer;

        this._renderSideEffect.add(() => {
            let last$userFooter: HTMLElement | undefined;
            return this._$userFooter.subscribe(($userFooter) => {
                if (last$userFooter) {
                    last$userFooter.remove();
                }
                last$userFooter = $userFooter;
                if ($userFooter) {
                    $content.appendChild($userFooter);
                }
            });
        });

        $boxMain.appendChild($titleBar);
        $boxMain.appendChild($contentWrap);
        $boxMain.appendChild($footer);

        this._renderResizeHandlers();

        return this.$box;
    }

    protected _handleTrackStart?: (ev: MouseEvent | TouchEvent) => void;

    public handleTrackStart: (ev: MouseEvent | TouchEvent) => void = (ev) => {
        return this._handleTrackStart?.(ev);
    };

    protected _renderResizeHandlers(): void {
        const $resizeHandles = document.createElement("div");
        $resizeHandles.className = this.wrapClassName("resize-handles");

        Object.values(TELE_BOX_RESIZE_HANDLE).forEach((handleType) => {
            const $handle = document.createElement("div");
            $handle.className =
                this.wrapClassName(handleType) +
                " " +
                this.wrapClassName("resize-handle");
            $handle.dataset.teleBoxHandle = handleType;

            $resizeHandles.appendChild($handle);
        });

        this.$box.appendChild($resizeHandles);

        const TRACKING_DISPOSER_ID = "handle-tracking-listener";
        const transformingClassName = this.wrapClassName("transforming");

        let $trackMask: HTMLElement | undefined;

        let trackStartX = 0;
        let trackStartY = 0;

        let trackStartWidth = 0;
        let trackStartHeight = 0;

        let trackStartPageX = 0;
        let trackStartPageY = 0;

        let trackingHandle: TeleBoxHandleType | undefined;

        const handleTracking = (ev: MouseEvent | TouchEvent): void => {
            if (this.state !== TELE_BOX_STATE.Normal) {
                return;
            }

            preventEvent(ev);

            let { pageX, pageY } = flattenEvent(ev);
            if (pageY < 0) {
                pageY = 0;
            }

            const offsetX =
                (pageX - trackStartPageX) / this.containerRect.width;
            const offsetY =
                (pageY - trackStartPageY) / this.containerRect.height;

            switch (trackingHandle) {
                case TELE_BOX_RESIZE_HANDLE.North: {
                    this.transform(
                        this.x,
                        trackStartY + offsetY,
                        this.width,
                        trackStartHeight - offsetY
                    );
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.South: {
                    this.transform(
                        this.x,
                        this.y,
                        this.width,
                        trackStartHeight + offsetY
                    );
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.West: {
                    this.transform(
                        trackStartX + offsetX,
                        this.y,
                        trackStartWidth - offsetX,
                        this.height
                    );
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.East: {
                    this.transform(
                        this.x,
                        this.y,
                        trackStartWidth + offsetX,
                        this.height
                    );
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.NorthWest: {
                    this.transform(
                        trackStartX + offsetX,
                        trackStartY + offsetY,
                        trackStartWidth - offsetX,
                        trackStartHeight - offsetY
                    );
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.NorthEast: {
                    this.transform(
                        this.x,
                        trackStartY + offsetY,
                        trackStartWidth + offsetX,
                        trackStartHeight - offsetY
                    );
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.SouthEast: {
                    this.transform(
                        this.x,
                        this.y,
                        trackStartWidth + offsetX,
                        trackStartHeight + offsetY
                    );
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.SouthWest: {
                    this.transform(
                        trackStartX + offsetX,
                        this.y,
                        trackStartWidth - offsetX,
                        trackStartHeight + offsetY
                    );
                    break;
                }
                default: {
                    if (this._fence) {
                        this.move(
                            clamp(trackStartX + offsetX, 0, 1 - this.width),
                            clamp(trackStartY + offsetY, 0, 1 - this.height)
                        );
                    } else {
                        const xOverflowOffset = 20 / this.containerRect.width;
                        const yOverflowOffset = 20 / this.containerRect.height;
                        this.move(
                            clamp(
                                trackStartX + offsetX,
                                xOverflowOffset - this.width,
                                1 - xOverflowOffset
                            ),
                            clamp(trackStartY + offsetY, 0, 1 - yOverflowOffset)
                        );
                    }
                    break;
                }
            }
        };

        const handleTrackEnd = (ev: MouseEvent | TouchEvent): void => {
            trackingHandle = void 0;

            if (!$trackMask) {
                return;
            }

            preventEvent(ev);

            this.$box.classList.toggle(transformingClassName, false);

            this._sideEffect.flush(TRACKING_DISPOSER_ID);

            $trackMask.remove();
        };

        const handleTrackStart = (ev: MouseEvent | TouchEvent): void => {
            if (this.readonly) {
                return;
            }

            if (
                (ev as MouseEvent).button != null &&
                (ev as MouseEvent).button !== 0
            ) {
                // Not left mouse
                return;
            }

            if (
                !this.draggable ||
                trackingHandle ||
                this.state !== TELE_BOX_STATE.Normal
            ) {
                return;
            }

            const target = ev.target as HTMLElement;
            if (target.dataset?.teleBoxHandle) {
                preventEvent(ev);

                trackStartX = this.x;
                trackStartY = this.y;
                trackStartWidth = this.width;
                trackStartHeight = this.height;

                ({ pageX: trackStartPageX, pageY: trackStartPageY } =
                    flattenEvent(ev));

                trackingHandle = target.dataset
                    .teleBoxHandle as TELE_BOX_RESIZE_HANDLE;

                if (!$trackMask) {
                    $trackMask = document.createElement("div");
                }

                const cursor = trackingHandle
                    ? this.wrapClassName(`cursor-${trackingHandle}`)
                    : "";

                $trackMask.className = this.wrapClassName(
                    `track-mask${cursor ? ` ${cursor}` : ""}`
                );

                this.$box.appendChild($trackMask);

                this.$box.classList.add(transformingClassName);

                this._sideEffect.add(() => {
                    window.addEventListener("mousemove", handleTracking);
                    window.addEventListener("touchmove", handleTracking, {
                        passive: false,
                    });
                    window.addEventListener("mouseup", handleTrackEnd);
                    window.addEventListener("touchend", handleTrackEnd, {
                        passive: false,
                    });
                    window.addEventListener("touchcancel", handleTrackEnd, {
                        passive: false,
                    });

                    return () => {
                        window.removeEventListener("mousemove", handleTracking);
                        window.removeEventListener("touchmove", handleTracking);
                        window.removeEventListener("mouseup", handleTrackEnd);
                        window.removeEventListener("touchend", handleTrackEnd);
                        window.removeEventListener(
                            "touchcancel",
                            handleTrackEnd
                        );
                    };
                }, TRACKING_DISPOSER_ID);
            }
        };

        this._handleTrackStart = handleTrackStart;

        this._sideEffect.addEventListener(
            $resizeHandles,
            "mousedown",
            handleTrackStart,
            {},
            "box-resizeHandles-mousedown"
        );

        this._sideEffect.addEventListener(
            $resizeHandles,
            "touchstart",
            handleTrackStart,
            { passive: false },
            "box-resizeHandles-touchstart"
        );
    }

    public destroy(): void {
        this.$box.remove();
        this.events.emit(TELE_BOX_EVENT.Destroyed);

        this._sideEffect.flushAll();
        this._renderSideEffect.flushAll();
        this.events.removeAllListeners();
        this._delegateEvents.removeAllListeners();
        Object.keys(this).forEach((key) => {
            const value = this[key as keyof this];
            if (value instanceof Val) {
                value.destroy();
            }
        });
    }

    /**
     * Wrap a className with namespace
     */
    public wrapClassName(className: string): string {
        return `${this.namespace}-${className}`;
    }
}

type PropKeys<K = keyof TeleBox> = K extends keyof TeleBox
    ? TeleBox[K] extends Function
        ? never
        : K
    : never;

export type ReadonlyTeleBox = Pick<
    TeleBox,
    | PropKeys
    | "wrapClassName"
    | "mountContent"
    | "mountFooter"
    | "mountStyles"
    | "handleTrackStart"
>;
