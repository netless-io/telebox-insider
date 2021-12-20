import "./style.scss";

import EventEmitter from "eventemitter3";
import styler from "stylefire";
import shallowequal from "shallowequal";
import { SideEffectManager } from "side-effect-manager";
import {
    createSideEffectBinder,
    Val,
    ValEnhancedResult,
    ValSideEffectBinder,
    withValueEnhancer,
} from "value-enhancer";
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
    TELE_BOX_COLOR_SCHEME,
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
    TeleBoxColorScheme,
} from "./typings";

export * from "./constants";
export * from "./typings";

type ValConfig = {
    prefersColorScheme: Val<TeleBoxColorScheme, boolean>;
    darkMode: Val<boolean, boolean>;
    containerRect: Val<TeleBoxRect, boolean>;
    collectorRect: Val<TeleBoxRect | undefined, boolean>;
    /** Box title. Default empty. */
    title: Val<string, boolean>;
    /** Is box visible */
    visible: Val<boolean, boolean>;
    /** Is box readonly */
    readonly: Val<boolean, boolean>;
    /** Able to resize box window */
    resizable: Val<boolean, boolean>;
    /** Able to drag box window */
    draggable: Val<boolean, boolean>;
    /** Restrict box to always be within the containing area. */
    fence: Val<boolean, boolean>;
    /** Fixed width/height ratio for box window. */
    fixRatio: Val<boolean, boolean>;
    focus: Val<boolean, boolean>;
    zIndex: Val<number, boolean>;
    /** Is box minimized. Default false. */
    minimized: Val<boolean, boolean>;
    /** Is box maximized. Default false. */
    maximized: Val<boolean, boolean>;
    $userContent: Val<HTMLElement | undefined>;
    $userFooter: Val<HTMLElement | undefined>;
    $userStyles: Val<HTMLStyleElement | undefined>;
};
export interface TeleBox extends ValEnhancedResult<ValConfig> {}

export class TeleBox {
    public constructor({
        id = genUniqueKey(),
        title = getBoxDefaultName(),
        prefersColorScheme = TELE_BOX_COLOR_SCHEME.Light,
        darkMode,
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
        this._valSideEffectBinder = createSideEffectBinder(this._sideEffect);
        const { combine, createVal } = this._valSideEffectBinder;

        this.id = id;
        this.namespace = namespace;
        this.events = new EventEmitter();
        this._delegateEvents = new EventEmitter();

        const prefersColorScheme$ = createVal<TeleBoxColorScheme, boolean>(
            prefersColorScheme
        );
        prefersColorScheme$.reaction((prefersColorScheme, _, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(
                    TELE_BOX_EVENT.PrefersColorScheme,
                    prefersColorScheme
                );
            }
        });

        const darkMode$ = createVal(Boolean(darkMode));

        if (darkMode == null) {
            prefersColorScheme$.subscribe(
                (prefersColorScheme, _, skipUpdate) => {
                    this._sideEffect.add(() => {
                        if (prefersColorScheme === "auto") {
                            const prefersDark = window.matchMedia(
                                "(prefers-color-scheme: dark)"
                            );
                            if (prefersDark) {
                                darkMode$.setValue(
                                    prefersDark.matches,
                                    skipUpdate
                                );
                                const handler = (
                                    evt: MediaQueryListEvent
                                ): void => {
                                    darkMode$.setValue(evt.matches, skipUpdate);
                                };
                                prefersDark.addListener(handler);
                                return () =>
                                    prefersDark.removeListener(handler);
                            } else {
                                return noop;
                            }
                        } else {
                            darkMode$.setValue(
                                prefersColorScheme === "dark",
                                skipUpdate
                            );
                            return noop;
                        }
                    }, "prefers-color-scheme");
                }
            );
        }

        darkMode$.reaction((darkMode, _, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.DarkMode, darkMode);
            }
        });

        const containerRect$ = createVal(containerRect, shallowequal);
        const collectorRect$ = createVal(collectorRect, shallowequal);

        const title$ = createVal(title);

        const visible$ = createVal(visible);
        visible$.reaction((visible, _, skipUpdate) => {
            if (!skipUpdate && !visible) {
                this.events.emit(TELE_BOX_EVENT.Close);
            }
        });

        const readonly$ = createVal(readonly);
        readonly$.reaction((readonly, _, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.Readonly, readonly);
            }
        });

        const resizable$ = createVal(resizable);
        const draggable$ = createVal(draggable);
        const fence$ = createVal(fence);
        const fixRatio$ = createVal(fixRatio);
        const zIndex$ = createVal(zIndex);

        const focus$ = createVal(focus);
        focus$.reaction((focus, _, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(
                    focus ? TELE_BOX_EVENT.Focus : TELE_BOX_EVENT.Blur
                );
            }
        });

        const minimized$ = createVal(minimized);
        minimized$.reaction((minimized, _, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.Minimized, minimized);
            }
        });

        const maximized$ = createVal(maximized);
        maximized$.reaction((maximized, _, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.Maximized, maximized);
            }
        });

        const state$ = combine(
            [minimized$, maximized$],
            ([minimized, maximized]): TeleBoxState =>
                minimized
                    ? TELE_BOX_STATE.Minimized
                    : maximized
                    ? TELE_BOX_STATE.Maximized
                    : TELE_BOX_STATE.Normal
        );
        state$.reaction((state, _, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.State, state);
            }
        });

        const minSize$ = createVal(
            {
                width: clamp(minWidth, 0, 1),
                height: clamp(minHeight, 0, 1),
            },
            shallowequal
        );

        const intrinsicSize$ = createVal(
            {
                width: clamp(width, minSize$.value.width, 1),
                height: clamp(height, minSize$.value.height, 1),
            },
            shallowequal
        );
        minSize$.reaction((minSize, _, skipUpdate) => {
            intrinsicSize$.setValue(
                {
                    width: clamp(width, minSize.width, 1),
                    height: clamp(height, minSize.height, 1),
                },
                skipUpdate
            );
        });
        intrinsicSize$.reaction((size, _, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.IntrinsicResize, size);
            }
        });

        const size$ = combine(
            [intrinsicSize$, maximized$],
            ([intrinsicSize, maximized]) => {
                if (maximized) {
                    return { width: 1, height: 1 };
                }
                return intrinsicSize;
            },
            shallowequal
        );
        size$.reaction((size, _, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.Resize, size);
            }
        });

        const visualSize$ = combine(
            [size$, minimized$, containerRect$, collectorRect$],
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
        visualSize$.reaction((size, _, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.VisualResize, size);
            }
        });

        const intrinsicCoord$ = createVal(
            { x: clamp(x, 0, 1), y: clamp(y, 0, 1) },
            shallowequal
        );
        intrinsicCoord$.reaction((coord, _, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.IntrinsicMove, coord);
            }
        });

        const coord$ = combine(
            [
                intrinsicCoord$,
                intrinsicSize$,
                containerRect$,
                collectorRect$,
                minimized$,
                maximized$,
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
        coord$.reaction((coord, _, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_EVENT.Move, coord);
            }
        });

        this.titleBar =
            titleBar ||
            new DefaultTitleBar({
                readonly: readonly$.value,
                title: title$.value,
                namespace: this.namespace,
                onDragStart: (event) => this._handleTrackStart?.(event),
                onEvent: (event): void => {
                    if (this._delegateEvents.listeners.length > 0) {
                        this._delegateEvents.emit(event.type);
                    } else {
                        switch (event.type) {
                            case TELE_BOX_DELEGATE_EVENT.Maximize: {
                                maximized$.setValue(!maximized$.value);
                                break;
                            }
                            case TELE_BOX_DELEGATE_EVENT.Minimize: {
                                minimized$.setValue(true);
                                break;
                            }
                            case TELE_BOX_DELEGATE_EVENT.Close: {
                                visible$.setValue(false);
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
        readonly$.reaction((readonly) => {
            this.titleBar.setReadonly(readonly);
        });

        const $userContent$ = createVal(content);
        const $userFooter$ = createVal(footer);
        const $userStyles$ = createVal(styles);

        const valConfig: ValConfig = {
            prefersColorScheme: prefersColorScheme$,
            darkMode: darkMode$,
            containerRect: containerRect$,
            collectorRect: collectorRect$,
            title: title$,
            visible: visible$,
            readonly: readonly$,
            resizable: resizable$,
            draggable: draggable$,
            fence: fence$,
            fixRatio: fixRatio$,
            focus: focus$,
            zIndex: zIndex$,
            minimized: minimized$,
            maximized: maximized$,
            $userContent: $userContent$,
            $userFooter: $userFooter$,
            $userStyles: $userStyles$,
        };

        withValueEnhancer(this, valConfig);

        this._state$ = state$;
        this._minSize$ = minSize$;
        this._size$ = size$;
        this._intrinsicSize$ = intrinsicSize$;
        this._visualSize$ = visualSize$;
        this._coord$ = coord$;
        this._intrinsicCoord$ = intrinsicCoord$;

        if (this.fixRatio) {
            this.transform(
                coord$.value.x,
                coord$.value.y,
                size$.value.width,
                size$.value.height,
                true
            );
        }

        this.$box = this.render();
    }

    public readonly id: string;

    /** ClassName Prefix. For CSS styling. Default "telebox" */
    public readonly namespace: string;

    public readonly events: TeleBoxEvents;

    public readonly _delegateEvents: TeleBoxDelegateEvents;

    protected _sideEffect: SideEffectManager;

    protected _valSideEffectBinder: ValSideEffectBinder;

    public titleBar: TeleTitleBar;

    public _minSize$: Val<TeleBoxSize, boolean>;
    public _size$: Val<TeleBoxSize, boolean>;
    public _intrinsicSize$: Val<TeleBoxSize, boolean>;
    public _visualSize$: Val<TeleBoxSize, boolean>;
    public _coord$: Val<TeleBoxCoord, boolean>;
    public _intrinsicCoord$: Val<TeleBoxCoord, boolean>;

    public get darkMode(): boolean {
        return this._darkMode$.value;
    }

    public _state$: Val<TeleBoxState, boolean>;

    public get state(): TeleBoxState {
        return this._state$.value;
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

    /** Minimum box width relative to container element. 0~1. Default 0. */
    public get minWidth(): number {
        return this._minSize$.value.width;
    }

    /** Minimum box height relative to container element. 0~1. Default 0. */
    public get minHeight(): number {
        return this._minSize$.value.height;
    }

    /**
     * @param minWidth Minimum box width relative to container element. 0~1.
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

    /** Intrinsic box width relative to container element(without counting the effect of maximization or minimization). 0~1. Default 0.5. */
    public get intrinsicWidth(): number {
        return this._intrinsicSize$.value.width;
    }

    /** Intrinsic box height relative to container element(without counting the effect of maximization or minimization). 0~1. Default 0.5. */
    public get intrinsicHeight(): number {
        return this._intrinsicSize$.value.height;
    }

    /**
     * Resize box.
     * @param width Box width relative to container element. 0~1.
     * @param height Box height relative to container element. 0~1.
     * @param skipUpdate Skip emitting event.
     * @returns this
     */
    public resize(width: number, height: number, skipUpdate = false): this {
        this._intrinsicSize$.setValue({ width, height }, skipUpdate);
        return this;
    }

    /** Box width relative to container element. 0~1. Default 0.5. */
    public get width(): number {
        return this._size$.value.width;
    }

    /** Box height relative to container element. 0~1. Default 0.5. */
    public get height(): number {
        return this._size$.value.height;
    }

    /** Box width in pixels. */
    public get absoluteWidth(): number {
        return this.width * this.containerRect.width;
    }

    /** Box height in pixels. */
    public get absoluteHeight(): number {
        return this.height * this.containerRect.height;
    }

    /** Actual rendered box width relative to container element. 0~1. Default 0.5. */
    public get visualWidth(): number {
        return this._visualSize$.value.width;
    }

    /** Actual rendered box height relative to container element. 0~1. Default 0.5. */
    public get visualHeight(): number {
        return this._visualSize$.value.height;
    }

    /** Intrinsic box x position relative to container element(without counting the effect of maximization or minimization). 0~1. Default 0.1. */
    public get intrinsicX(): number {
        return this._intrinsicCoord$.value.x;
    }

    /** Intrinsic box y position relative to container element(without counting the effect of maximization or minimization). 0~1. Default 0.1. */
    public get intrinsicY(): number {
        return this._intrinsicCoord$.value.y;
    }

    /**
     * Move box position.
     * @param x x position relative to container element. 0~1.
     * @param y y position relative to container element. 0~1.
     * @param skipUpdate Skip emitting event.
     * @returns this
     */
    public move(x: number, y: number, skipUpdate = false): this {
        this._intrinsicCoord$.setValue({ x, y }, skipUpdate);
        return this;
    }

    /** Box x position relative to container element. 0~1. Default 0.1. */
    public get x(): number {
        return this._coord$.value.x;
    }

    /** Box y position relative to container element. 0~1. Default 0.1. */
    public get y(): number {
        return this._coord$.value.y;
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

        this._intrinsicCoord$.setValue(
            {
                x: width >= this.minWidth ? x : this.intrinsicX,
                y: height >= this.minHeight ? y : this.intrinsicY,
            },
            skipUpdate
        );
        this._intrinsicSize$.setValue(
            {
                width: clamp(width, this.minWidth, 1),
                height: clamp(height, this.minHeight, 1),
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
        this.set$userContent(content);
        return this;
    }

    /**
     * Unmount content from the box.
     */
    public unmountContent(): this {
        this.set$userContent(undefined);
        return this;
    }

    /**
     * Mount dom to box Footer.
     */
    public mountFooter(footer: HTMLElement): this {
        this.set$userFooter(footer);
        return this;
    }

    /**
     * Unmount Footer from the box.
     */
    public unmountFooter(): this {
        this.set$userFooter(undefined);
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
        this.set$userStyles($styles);
        return this;
    }

    public unmountStyles(): this {
        this.set$userStyles(undefined);
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

        this._renderSideEffect.add(() =>
            this._visible$.subscribe((visible) => {
                this.$box.style.display = visible ? "block" : "none";
            })
        );

        this._renderSideEffect.add(() =>
            this._zIndex$.subscribe((zIndex) => {
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

        this._valSideEffectBinder
            .combine(
                [
                    this._coord$,
                    this._size$,
                    this._minimized$,
                    this._containerRect$,
                    this._collectorRect$,
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
            )
            .subscribe((styles) => {
                boxStyler.set(styles);
            });

        boxStyler.set({ x: translateX, y: translateY });

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
                    $content.appendChild($userStyles);
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
                    if (this.fence) {
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
    }

    /**
     * Wrap a className with namespace
     */
    public wrapClassName(className: string): string {
        return `${this.namespace}-${className}`;
    }
}

function noop(): void {
    return;
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
