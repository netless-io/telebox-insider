import "./style.scss";

import Emittery from "emittery";
import styler from "stylefire";
import shallowequal from "shallowequal";
import { genUID, SideEffectManager } from "side-effect-manager";
import type { ReadonlyVal, ReadonlyValEnhancedResult } from "value-enhancer";
import { combine, Val, withReadonlyValueEnhancer } from "value-enhancer";
import type { TeleTitleBar } from "../TeleTitleBar";
import { DefaultTitleBar } from "../TeleTitleBar";
import {
    clamp,
    flattenEvent,
    getBoxDefaultName,
    isFalsy,
    isTruthy,
    preventEvent,
} from "../utils";
import {
    TELE_BOX_EVENT,
    TELE_BOX_STATE,
    TELE_BOX_RESIZE_HANDLE,
} from "./constants";
import type {
    TeleBoxConfig,
    TeleBoxHandleType,
    TeleBoxState,
    TeleBoxCoord,
    TeleBoxSize,
    TeleBoxEventConfig,
    TeleBoxEvent,
    TeleBoxDelegateEventConfig,
} from "./typings";

export * from "./constants";
export * from "./typings";

type RequiredTeleBoxConfig = Required<TeleBoxConfig>;

type ReadonlyValConfig = {
    darkMode: RequiredTeleBoxConfig["darkMode$"];
    fence: RequiredTeleBoxConfig["fence$"];
    minimized: RequiredTeleBoxConfig["minimized$"];
    maximized: RequiredTeleBoxConfig["maximized$"];
    readonly: RequiredTeleBoxConfig["readonly$"];
    rootRect: RequiredTeleBoxConfig["rootRect$"];
    stageRect: RequiredTeleBoxConfig["stageRect$"];
    collectorRect: RequiredTeleBoxConfig["collectorRect$"];

    title: Val<RequiredTeleBoxConfig["title"], boolean>;
    visible: Val<RequiredTeleBoxConfig["visible"], boolean>;
    resizable: Val<RequiredTeleBoxConfig["resizable"], boolean>;
    draggable: Val<RequiredTeleBoxConfig["draggable"], boolean>;
    ratio: Val<RequiredTeleBoxConfig["ratio"], boolean>;
    zIndex: Val<Required<RequiredTeleBoxConfig>["zIndex"], boolean>;
    focus: Val<RequiredTeleBoxConfig["focus"], boolean>;

    $userContent: Val<TeleBoxConfig["content"], boolean>;
    $userFooter: Val<TeleBoxConfig["footer"], boolean>;
    $userStyles: Val<TeleBoxConfig["styles"], boolean>;

    minSize: Val<TeleBoxSize, boolean>;
    intrinsicSize: Val<TeleBoxSize, boolean>;
    intrinsicCoord: Val<TeleBoxCoord, boolean>;
    pxMinSize: ReadonlyVal<TeleBoxSize, boolean>;
    pxIntrinsicSize: ReadonlyVal<TeleBoxSize, boolean>;
    pxIntrinsicCoord: ReadonlyVal<TeleBoxCoord, boolean>;
    boxStyles: ReadonlyVal<
        {
            x: number;
            y: number;
            width: string;
            height: string;
            scaleX: number;
            scaleY: number;
        },
        boolean
    >;
    state: ReadonlyVal<TeleBoxState, boolean>;
};

export interface TeleBox extends ReadonlyValEnhancedResult<ReadonlyValConfig> {}

export class TeleBox {
    public constructor({
        id = genUID(),
        title = getBoxDefaultName(),
        namespace = "telebox",
        visible = true,
        width = 0.5,
        height = 0.5,
        minWidth = 0,
        minHeight = 0,
        x = 0.1,
        y = 0.1,
        resizable = true,
        draggable = true,
        ratio = -1,
        focus = false,
        zIndex = 100,
        titleBar,
        content,
        footer,
        styles,
        darkMode$,
        fence$,
        minimized$,
        maximized$,
        readonly$,
        rootRect$,
        stageRect$,
        collectorRect$,
    }: TeleBoxConfig) {
        this._sideEffect = new SideEffectManager();

        this.id = id;
        this.namespace = namespace;

        const title$ = new Val(title);
        const visible$ = new Val(visible);
        const resizable$ = new Val(resizable);
        const draggable$ = new Val(draggable);
        const ratio$ = new Val(ratio);
        const zIndex$ = new Val(zIndex);
        const focus$ = new Val(focus);
        const $userContent$ = new Val(content);
        const $userFooter$ = new Val(footer);
        const $userStyles$ = new Val(styles);

        const state$ = combine(
            [minimized$, maximized$],
            ([minimized, maximized]): TeleBoxState =>
                minimized
                    ? TELE_BOX_STATE.Minimized
                    : maximized
                    ? TELE_BOX_STATE.Maximized
                    : TELE_BOX_STATE.Normal
        );

        const minSize$ = new Val(
            {
                width: clamp(minWidth, 0, 1),
                height: clamp(minHeight, 0, 1),
            },
            { compare: shallowequal }
        );

        const pxMinSize$ = combine(
            [minSize$, stageRect$],
            ([minSize, stageRect]) => ({
                width: minSize.width * stageRect.width,
                height: minSize.height * stageRect.height,
            }),
            { compare: shallowequal }
        );

        const intrinsicSize$ = new Val(
            { width, height },
            { compare: shallowequal }
        );

        this._sideEffect.addDisposer(
            // check intrinsicSize overflow
            minSize$.reaction((minSize, skipUpdate) => {
                intrinsicSize$.setValue(
                    {
                        width: Math.max(width, minSize.width),
                        height: Math.max(height, minSize.height),
                    },
                    skipUpdate
                );
            })
        );

        const intrinsicCoord$ = new Val({ x, y }, { compare: shallowequal });

        const pxIntrinsicSize$ = combine(
            [intrinsicSize$, stageRect$],
            ([size, stageRect]) => ({
                width: stageRect.width * size.width,
                height: stageRect.height * size.height,
            }),
            { compare: shallowequal }
        );

        const pxIntrinsicCoord$ = combine(
            [intrinsicCoord$, stageRect$],
            ([intrinsicCoord, stageRect]) => ({
                x: intrinsicCoord.x * stageRect.width + stageRect.x,
                y: intrinsicCoord.y * stageRect.height + stageRect.y,
            }),
            { compare: shallowequal }
        );

        const boxStyles$ = combine(
            [
                maximized$,
                minimized$,
                pxIntrinsicSize$,
                pxIntrinsicCoord$,
                collectorRect$,
            ],
            ([
                maximized,
                minimized,
                pxIntrinsicSize,
                pxIntrinsicCoord,
                collectorRect,
            ]) => {
                if (minimized && collectorRect) {
                    return {
                        x: collectorRect.x + collectorRect.width / 2,
                        y: collectorRect.y + collectorRect.height / 2,
                        width: pxIntrinsicSize.width + "px",
                        height: pxIntrinsicSize.height + "px",
                        scaleX: collectorRect.width / pxIntrinsicSize.width,
                        scaleY: collectorRect.height / pxIntrinsicSize.height,
                    };
                }
                if (maximized) {
                    return {
                        x: 0,
                        y: 0,
                        width: "100%",
                        height: "100%",
                        scaleX: 1,
                        scaleY: 1,
                    };
                }
                return {
                    x: pxIntrinsicCoord.x,
                    y: pxIntrinsicCoord.y,
                    width: pxIntrinsicSize.width + "px",
                    height: pxIntrinsicSize.height + "px",
                    scaleX: 1,
                    scaleY: 1,
                };
            },
            { compare: shallowequal }
        );

        const readonlyValConfig: ReadonlyValConfig = {
            darkMode: darkMode$,
            fence: fence$,
            minimized: minimized$,
            maximized: maximized$,
            readonly: readonly$,
            rootRect: rootRect$,
            stageRect: stageRect$,
            collectorRect: collectorRect$,

            title: title$,
            visible: visible$,
            resizable: resizable$,
            draggable: draggable$,
            ratio: ratio$,
            zIndex: zIndex$,
            focus: focus$,

            $userContent: $userContent$,
            $userFooter: $userFooter$,
            $userStyles: $userStyles$,

            state: state$,
            minSize: minSize$,
            pxMinSize: pxMinSize$,
            intrinsicSize: intrinsicSize$,
            intrinsicCoord: intrinsicCoord$,
            pxIntrinsicSize: pxIntrinsicSize$,
            pxIntrinsicCoord: pxIntrinsicCoord$,
            boxStyles: boxStyles$,
        };

        withReadonlyValueEnhancer(this, readonlyValConfig);

        this.titleBar =
            titleBar ||
            new DefaultTitleBar({
                readonly$: readonly$,
                state$: state$,
                title: title$.value,
                namespace: this.namespace,
                onDragStart: (event) => this._handleTrackStart?.(event),
                onEvent: (event) => this._delegateEvents.emit(event.type),
            });

        this._sideEffect.addDisposer(
            ratio$.subscribe((ratio) => {
                if (ratio > 0) {
                    this.transform(
                        pxIntrinsicCoord$.value.x,
                        pxIntrinsicCoord$.value.y,
                        pxIntrinsicSize$.value.width,
                        pxIntrinsicSize$.value.height,
                        true
                    );
                }
            })
        );

        this._sideEffect.addDisposer(
            fence$.subscribe((fence) => {
                if (fence) {
                    this.move(
                        pxIntrinsicCoord$.value.x,
                        pxIntrinsicCoord$.value.y,
                        true
                    );
                }
            })
        );

        this.$box = this.render();

        const watchValEvent = <E extends TeleBoxEvent>(
            val: ReadonlyVal<TeleBoxEventConfig[E], boolean>,
            event: E
        ) => {
            this._sideEffect.addDisposer(
                val.reaction((v, skipUpdate) => {
                    if (!skipUpdate) {
                        this.events.emit<any>(event, v);
                    }
                })
            );
        };

        watchValEvent(darkMode$, TELE_BOX_EVENT.DarkMode);
        watchValEvent(readonly$, TELE_BOX_EVENT.Readonly);
        watchValEvent(zIndex$, TELE_BOX_EVENT.ZIndex);
        watchValEvent(minimized$, TELE_BOX_EVENT.Minimized);
        watchValEvent(maximized$, TELE_BOX_EVENT.Maximized);
        watchValEvent(state$, TELE_BOX_EVENT.State);
        watchValEvent(intrinsicSize$, TELE_BOX_EVENT.IntrinsicResize);
        watchValEvent(intrinsicCoord$, TELE_BOX_EVENT.IntrinsicMove);

        this._sideEffect.addDisposer(
            visible$.reaction((visible, skipUpdate) => {
                if (!skipUpdate && !visible) {
                    this.events.emit(TELE_BOX_EVENT.Close);
                }
            })
        );

        this._sideEffect.addDisposer(
            focus$.reaction((focus, skipUpdate) => {
                if (!skipUpdate) {
                    this.events.emit(
                        focus ? TELE_BOX_EVENT.Focus : TELE_BOX_EVENT.Blur
                    );
                }
            })
        );
    }

    public readonly id: string;

    /** ClassName Prefix. For CSS styling. Default "telebox" */
    public readonly namespace: string;

    public readonly events = new Emittery<
        TeleBoxEventConfig,
        TeleBoxEventConfig
    >();

    public readonly _delegateEvents = new Emittery<
        TeleBoxDelegateEventConfig,
        TeleBoxDelegateEventConfig
    >();

    protected _sideEffect: SideEffectManager;

    public titleBar: TeleTitleBar;

    /** Minimum box width relative to stage area. 0~1. Default 0. */
    public get minWidth(): number {
        return this._minSize$.value.width;
    }

    /** Minimum box height relative to stage area. 0~1. Default 0. */
    public get minHeight(): number {
        return this._minSize$.value.height;
    }

    /**
     * @param minWidth Minimum box width relative to stage area. 0~1.
     * @returns this
     */
    public setMinWidth(minWidth: number, skipUpdate = false): this {
        this._minSize$.setValue(
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
        this._minSize$.setValue(
            { width: this.minWidth, height: minHeight },
            skipUpdate
        );
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
        this._intrinsicSize$.setValue(
            {
                width: Math.max(width, this.minWidth),
                height: Math.max(height, this.minHeight),
            },
            skipUpdate
        );
        return this;
    }

    /** Intrinsic box x position relative to container element(without counting the effect of maximization or minimization). 0~1. Default 0.1. */
    public get intrinsicX(): number {
        return this._intrinsicCoord$.value.x;
    }

    /** Intrinsic box y position relative to container element(without counting the effect of maximization or minimization). 0~1. Default 0.1. */
    public get intrinsicY(): number {
        return this._intrinsicCoord$.value.y;
    }

    /** Intrinsic box width relative to container element(without counting the effect of maximization or minimization). 0~1. Default 0.1. */
    public get intrinsicWidth(): number {
        return this._intrinsicSize$.value.width;
    }

    /** Intrinsic box height relative to container element(without counting the effect of maximization or minimization). 0~1. Default 0.1. */
    public get intrinsicHeight(): number {
        return this._intrinsicSize$.value.height;
    }

    /**
     * Move box position.
     * @param x x position in px.
     * @param y y position in px.
     * @param skipUpdate Skip emitting event.
     * @returns this
     */
    protected move(x: number, y: number, skipUpdate = false): this {
        let safeX: number;
        let safeY: number;
        const stageRect = this.stageRect;
        const pxIntrinsicSize = this.pxIntrinsicSize;

        if (this.fence) {
            safeX = clamp(
                x,
                stageRect.x,
                stageRect.x + stageRect.width - pxIntrinsicSize.width
            );
            safeY = clamp(
                y,
                stageRect.y,
                stageRect.y + stageRect.height - pxIntrinsicSize.height
            );
        } else {
            const rootRect = this.rootRect;
            safeX = clamp(
                x,
                rootRect.x - pxIntrinsicSize.width + 20,
                rootRect.x + rootRect.width - 20
            );
            safeY = clamp(y, rootRect.y, rootRect.y + rootRect.height - 20);
        }

        this._intrinsicCoord$.setValue(
            {
                x: (safeX - stageRect.x) / stageRect.width,
                y: (safeY - stageRect.y) / stageRect.height,
            },
            skipUpdate
        );
        return this;
    }

    /**
     * Resize + Move, with respect to fixed ratio.
     * @param x x position in px.
     * @param y y position in px.
     * @param width Box width in px.
     * @param height Box height in px.
     * @param skipUpdate Skip emitting event.
     * @returns this
     */
    protected transform(
        x: number,
        y: number,
        width: number,
        height: number,
        skipUpdate = false
    ): this {
        const stageRect = this.stageRect;
        const rootRect = this.rootRect;

        width = Math.max(width, this.pxMinSize.width);
        height = Math.max(height, this.pxMinSize.height);

        if (this.ratio > 0) {
            const newHeight = this.ratio * width;
            if (y !== this.pxIntrinsicCoord.y) {
                y -= newHeight - height;
            }
            height = newHeight;
        }

        if (y < rootRect.y) {
            y = rootRect.y;
            height = this.pxIntrinsicSize.height;
        }

        this.move(x, y, skipUpdate);
        this._intrinsicSize$.setValue(
            {
                width: width / stageRect.width,
                height: height / stageRect.height,
            },
            skipUpdate
        );

        return this;
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
        this._$userContent$.setValue(content);
        return this;
    }

    /**
     * Unmount content from the box.
     */
    public unmountContent(): this {
        this._$userContent$.setValue(undefined);
        return this;
    }

    /**
     * Mount dom to box Footer.
     */
    public mountFooter(footer: HTMLElement): this {
        this._$userFooter$.setValue(footer);
        return this;
    }

    /**
     * Unmount Footer from the box.
     */
    public unmountFooter(): this {
        this._$userFooter$.setValue(undefined);
        return this;
    }

    public getUserStyles(): HTMLStyleElement | undefined {
        return this.$userStyles;
    }

    public mountStyles(styles: string | HTMLStyleElement): this {
        let $styles: HTMLStyleElement;
        if (typeof styles === "string") {
            $styles = document.createElement("style");
            $styles.textContent = styles;
        } else {
            $styles = styles;
        }
        this._$userStyles$.setValue($styles);
        return this;
    }

    public unmountStyles(): this {
        this._$userStyles$.setValue(undefined);
        return this;
    }

    /** DOM of the box */
    public $box: HTMLElement;

    /** DOM of the box content */
    public $content!: HTMLElement;

    /** DOM of the box title bar */
    public $titleBar!: HTMLElement;

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
            val: ReadonlyVal<TValue, boolean>,
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

        bindClassName(this.$box, this._readonly$, "readonly");
        bindClassName(this.$box, this._draggable$, "no-drag", isFalsy);
        bindClassName(this.$box, this._resizable$, "no-resize", isFalsy);
        bindClassName(this.$box, this._focus$, "blur", isFalsy);
        bindClassName(this.$box, this._darkMode$, "color-scheme-dark");
        bindClassName(
            this.$box,
            this._darkMode$,
            "color-scheme-light",
            isFalsy
        );

        this._renderSideEffect.add(() => {
            const minimizedClassName = this.wrapClassName("minimized");
            const maximizedClassName = this.wrapClassName("maximized");
            const MAXIMIZED_TIMER_ID = "box-maximized-timer";

            return this._state$.subscribe((state) => {
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

        this._renderSideEffect.addDisposer(
            this._visible$.subscribe((visible) => {
                this.$box.style.display = visible ? "block" : "none";
            })
        );

        this._renderSideEffect.addDisposer(
            this._zIndex$.subscribe((zIndex) => {
                this.$box.style.zIndex = String(zIndex);
            })
        );

        const boxStyler = styler(this.$box);

        this.$box.dataset.teleBoxID = this.id;

        const boxStyles = this.boxStyles;
        this.$box.style.width = boxStyles.width;
        this.$box.style.height = boxStyles.height;
        // Add 10px offset on first frame
        // which creates a subtle moving effect
        this.$box.style.transform = `translate(${boxStyles.x - 10}px,${
            boxStyles.y - 10
        }px)`;

        this._renderSideEffect.addDisposer(
            this._boxStyles$.subscribe((styles) => {
                boxStyler.set(styles);
            })
        );

        const $boxMain = document.createElement("div");
        $boxMain.className = this.wrapClassName("box-main");
        this.$box.appendChild($boxMain);

        const $titleBar = document.createElement("div");
        $titleBar.className = this.wrapClassName("titlebar-wrap");
        $titleBar.appendChild(this.titleBar.render());
        this.$titleBar = $titleBar;

        const $contentWrap = document.createElement("div");
        $contentWrap.className = this.wrapClassName("content-wrap");

        const $content = document.createElement("div");
        $content.className =
            this.wrapClassName("content") + " tele-fancy-scrollbar";
        this.$content = $content;

        this._renderSideEffect.add(() => {
            let last$userStyles: HTMLStyleElement | undefined;
            return this._$userStyles$.subscribe(($userStyles) => {
                if (last$userStyles) {
                    last$userStyles.remove();
                }
                last$userStyles = $userStyles;
                if ($userStyles) {
                    $contentWrap.appendChild($userStyles);
                }
            });
        });

        this._renderSideEffect.add(() => {
            let last$userContent: HTMLElement | undefined;
            return this._$userContent$.subscribe(($userContent) => {
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
            return this._$userFooter$.subscribe(($userFooter) => {
                if (last$userFooter) {
                    last$userFooter.remove();
                }
                last$userFooter = $userFooter;
                if ($userFooter) {
                    $footer.appendChild($userFooter);
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
            if (pageY < this.rootRect.y) {
                pageY = this.rootRect.y;
            }

            const stageRect = this.stageRect;
            const offsetX = pageX - trackStartPageX;
            const offsetY = pageY - trackStartPageY;

            let { x: newX, y: newY } = this.pxIntrinsicCoord;
            let { width: newWidth, height: newHeight } = this.pxIntrinsicSize;

            switch (trackingHandle) {
                case TELE_BOX_RESIZE_HANDLE.North: {
                    newY = trackStartY + offsetY;
                    newHeight = trackStartHeight - offsetY;
                    break;
                }
                // eslint-disable-next-line no-fallthrough
                case TELE_BOX_RESIZE_HANDLE.South: {
                    newHeight = trackStartHeight + offsetY;
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.West: {
                    newX = trackStartX + offsetX;
                    newWidth = trackStartWidth - offsetX;
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.East: {
                    newWidth = (trackStartWidth + offsetX) / stageRect.width;
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.NorthWest: {
                    newX = trackStartX + offsetX;
                    newY = trackStartY + offsetY;
                    newWidth = trackStartWidth - offsetX;
                    newHeight = trackStartHeight - offsetY;
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.NorthEast: {
                    newY = trackStartY + offsetY;
                    newWidth = trackStartWidth + offsetX;
                    newHeight = trackStartHeight - offsetY;
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.SouthEast: {
                    newWidth = trackStartWidth + offsetX;
                    newHeight = trackStartHeight + offsetY;
                    break;
                }
                case TELE_BOX_RESIZE_HANDLE.SouthWest: {
                    newX = trackStartX + offsetX;
                    newWidth = trackStartWidth - offsetX;
                    newHeight = trackStartHeight + offsetY;
                    break;
                }
                default: {
                    this.move(trackStartX + offsetX, trackStartY + offsetY);
                    return;
                }
            }

            this.transform(newX, newY, newWidth, newHeight);
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

                ({ x: trackStartX, y: trackStartY } = this.pxIntrinsicCoord);
                ({ width: trackStartWidth, height: trackStartHeight } =
                    this.pxIntrinsicSize);

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

    public async destroy(): Promise<void> {
        this.$box.remove();
        this._sideEffect.flushAll();
        this._renderSideEffect.flushAll();

        await this.events.emit(TELE_BOX_EVENT.Destroyed);
        this.events.clearListeners();
        this._delegateEvents.clearListeners();
    }

    /**
     * Wrap a className with namespace
     */
    public wrapClassName(className: string): string {
        return `${this.namespace}-${className}`;
    }
}

type PropKeys<K = keyof TeleBox> = K extends keyof TeleBox
    ? // eslint-disable-next-line @typescript-eslint/ban-types
      TeleBox[K] extends Function
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
