import EventEmitter from "eventemitter3";
import shallowequal from "shallowequal";
import type {
    TeleBoxConfig,
    TeleBoxRect,
    TeleBoxState,
} from "../TeleBox/typings";
import { TeleBoxCollector } from "../TeleBoxCollector";
import { ReadonlyTeleBox, TeleBox } from "../TeleBox";
import { TELE_BOX_EVENT, TELE_BOX_STATE } from "../TeleBox/constants";
import { TELE_BOX_MANAGER_EVENT } from "./constants";
import type {
    TeleBoxManagerConfig,
    TeleBoxManagerCreateConfig,
    TeleBoxManagerEvents,
    TeleBoxManagerQueryConfig,
    TeleBoxManagerUpdateConfig,
} from "./typings";
import { MaxTitleBar } from "./MaxTitleBar";
import {
    TeleBoxColorScheme,
    TELE_BOX_COLOR_SCHEME,
    TELE_BOX_DELEGATE_EVENT,
} from "..";
import { SideEffectManager } from "side-effect-manager";
import {
    createSideEffectBinder,
    Val,
    ValEnhancedResult,
    withValueEnhancer,
} from "value-enhancer";

export * from "./typings";
export * from "./constants";

type ValConfig = {
    prefersColorScheme: Val<TeleBoxColorScheme, boolean>;
    containerRect: Val<TeleBoxRect, boolean>;
    collector: Val<TeleBoxCollector | null>;
    collectorRect: Val<TeleBoxRect | undefined>;
    readonly: Val<boolean, boolean>;
    minimized: Val<boolean, boolean>;
    maximized: Val<boolean, boolean>;
    fence: Val<boolean, boolean>;
};
export interface TeleBoxManager extends ValEnhancedResult<ValConfig> {}

export class TeleBoxManager {
    public constructor({
        root = document.body,
        prefersColorScheme = TELE_BOX_COLOR_SCHEME.Light,
        minimized = false,
        maximized = false,
        fence = true,
        containerRect = {
            x: 0,
            y: 0,
            width: window.innerWidth,
            height: window.innerHeight,
        },
        collector,
        namespace = "telebox",
        readonly = false,
    }: TeleBoxManagerConfig = {}) {
        this._sideEffect = new SideEffectManager();
        const { combine, createVal } = createSideEffectBinder(this._sideEffect);

        this.root = root;
        this.namespace = namespace;

        this.boxes$ = createVal<TeleBox[]>([]);
        this.topBox$ = this.boxes$.derive((boxes) => {
            if (boxes.length > 0) {
                const topBox = boxes.reduce((topBox, box) =>
                    topBox.zIndex > box.zIndex ? topBox : box
                );
                return topBox;
            }
            return;
        });

        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
        const prefersDark$ = createVal(false);

        if (prefersDark) {
            prefersDark$.setValue(prefersDark.matches);
            this._sideEffect.add(() => {
                const handler = (evt: MediaQueryListEvent): void => {
                    prefersDark$.setValue(evt.matches);
                };
                prefersDark.addListener(handler);
                return () => prefersDark.removeListener(handler);
            });
        }

        const prefersColorScheme$ = createVal(prefersColorScheme);
        prefersColorScheme$.reaction((prefersColorScheme, _, skipUpdate) => {
            this.boxes.forEach((box) =>
                box.setPrefersColorScheme(prefersColorScheme, skipUpdate)
            );
            if (!skipUpdate) {
                this.events.emit(
                    TELE_BOX_MANAGER_EVENT.PrefersColorScheme,
                    prefersColorScheme
                );
            }
        });

        this._darkMode$ = combine(
            [prefersDark$, prefersColorScheme$],
            ([prefersDark, prefersColorScheme]) =>
                prefersColorScheme === "auto"
                    ? prefersDark
                    : prefersColorScheme === "dark"
        );
        this._darkMode$.reaction((darkMode, _, skipUpdate) => {
            this.boxes.forEach((box) => box.setDarkMode(darkMode, skipUpdate));
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_MANAGER_EVENT.DarkMode, darkMode);
            }
        });

        const readonly$ = createVal(readonly);
        readonly$.reaction((readonly, _, skipUpdate) => {
            this.boxes.forEach((box) => box.setReadonly(readonly, skipUpdate));
        });

        const minimized$ = createVal(minimized);

        const maximized$ = createVal(maximized);
        maximized$.reaction((maximized, _, skipUpdate) => {
            this.boxes.forEach((box) =>
                box.setMaximized(maximized, skipUpdate)
            );
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_MANAGER_EVENT.Maximized, maximized);
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
            this.maxTitleBar.setState(state);
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_MANAGER_EVENT.State, state);
            }
        });

        const fence$ = createVal(fence);
        fence$.subscribe((fence, _, skipUpdate) => {
            this.boxes.forEach((box) => box.setFence(fence, skipUpdate));
        });

        const containerRect$ = createVal(containerRect, shallowequal);
        containerRect$.reaction((containerRect, _, skipUpdate) => {
            this.boxes.forEach((box) =>
                box.setContainerRect(containerRect, skipUpdate)
            );
            this.maxTitleBar.setContainerRect(containerRect);
        });

        const collector$ = createVal(
            collector === null
                ? null
                : collector ||
                      new TeleBoxCollector({
                          visible: minimized,
                          readonly: readonly,
                          namespace,
                      }).mount(root)
        );
        collector$.subscribe((collector) => {
            if (collector) {
                collector.setVisible(minimized$.value);
                collector.setReadonly(readonly$.value);
                collector.setDarkMode(this._darkMode$.value);
                this._sideEffect.add(() => {
                    collector.onClick = () => {
                        if (!readonly$.value) {
                            minimized$.setValue(false);
                        }
                    };
                    return () => collector.destroy();
                }, "collect-onClick");
            }
        });
        readonly$.subscribe((readonly) =>
            collector$.value?.setReadonly(readonly)
        );
        this._darkMode$.subscribe((darkMode) => {
            collector$.value?.setDarkMode(darkMode);
        });

        const calcCollectorRect = (): TeleBoxRect | undefined => {
            if (collector$.value?.$collector) {
                const { x, y, width, height } =
                    collector$.value.$collector.getBoundingClientRect();
                const rootRect = this.root.getBoundingClientRect();
                return {
                    x: x - rootRect.x,
                    y: y - rootRect.y,
                    width,
                    height,
                };
            }
            return;
        };

        const collectorRect$ = createVal(
            minimized$.value ? calcCollectorRect() : void 0
        );
        collectorRect$.subscribe((collectorRect, _, skipUpdate) => {
            this.boxes.forEach((box) => {
                box.setCollectorRect(collectorRect, skipUpdate);
            });
        });

        minimized$.subscribe((minimized, _, skipUpdate) => {
            collector$.value?.setVisible(minimized);

            if (minimized) {
                if (collector$.value?.$collector) {
                    collectorRect$.setValue(calcCollectorRect());
                } else if (import.meta.env.DEV) {
                    console.warn("No collector for minimized boxes.");
                }
            }

            this.boxes.forEach((box) =>
                box.setMinimized(minimized, skipUpdate)
            );

            if (!skipUpdate) {
                this.events.emit(TELE_BOX_MANAGER_EVENT.Minimized, minimized);
            }
        });

        const closeBtnClassName = this.wrapClassName("titlebar-icon-close");

        const checkFocusBox = (ev: MouseEvent | TouchEvent): void => {
            if (readonly$.value) {
                return;
            }

            const target = ev.target as HTMLElement;
            if (!target.tagName) {
                return;
            }

            for (
                let el: HTMLElement | null = target;
                el;
                el = el.parentElement
            ) {
                if (el.classList && el.classList.contains(closeBtnClassName)) {
                    return;
                }
                const id = el.dataset?.teleBoxID;
                if (id) {
                    const box = this.getBox(id);
                    if (box) {
                        this.focusBox(box);
                        this.makeBoxTop(box);
                        return;
                    }
                }
            }
        };

        this._sideEffect.addEventListener(
            window,
            "mousedown",
            checkFocusBox,
            true
        );
        this._sideEffect.addEventListener(
            window,
            "touchstart",
            checkFocusBox,
            true
        );

        this.maxTitleBar = new MaxTitleBar({
            darkMode: this.darkMode,
            readonly: readonly$.value,
            namespace: this.namespace,
            state: state$.value,
            boxes: this.boxes$.value,
            containerRect: containerRect$.value,
            onEvent: (event): void => {
                switch (event.type) {
                    case TELE_BOX_DELEGATE_EVENT.Maximize: {
                        maximized$.setValue(!maximized$.value);
                        break;
                    }
                    case TELE_BOX_DELEGATE_EVENT.Minimize: {
                        minimized$.setValue(true);
                        break;
                    }
                    case TELE_BOX_EVENT.Close: {
                        this.removeTopBox();
                        this.focusTopBox();
                        break;
                    }
                    default: {
                        break;
                    }
                }
            },
        });
        readonly$.subscribe((readonly) =>
            this.maxTitleBar.setReadonly(readonly)
        );
        this._darkMode$.subscribe((darkMode) => {
            this.maxTitleBar.setDarkMode(darkMode);
        });
        this.boxes$.reaction((boxes) => {
            this.maxTitleBar.setBoxes(boxes);
        });

        const valConfig: ValConfig = {
            prefersColorScheme: prefersColorScheme$,
            containerRect: containerRect$,
            collector: collector$,
            collectorRect: collectorRect$,
            readonly: readonly$,
            fence: fence$,
            minimized: minimized$,
            maximized: maximized$,
        };

        withValueEnhancer(this, valConfig);

        this._state$ = state$;

        this.root.appendChild(this.maxTitleBar.render());
    }

    public get boxes(): ReadonlyArray<TeleBox> {
        return this.boxes$.value;
    }

    public get topBox(): TeleBox | undefined {
        return this.topBox$.value;
    }

    public readonly events = new EventEmitter() as TeleBoxManagerEvents;

    protected _sideEffect: SideEffectManager;

    protected root: HTMLElement;

    public readonly namespace: string;

    public _darkMode$: Val<boolean, boolean>;

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

    public create(
        config: TeleBoxManagerCreateConfig = {},
        smartPosition = true
    ): ReadonlyTeleBox {
        const box = new TeleBox({
            zIndex: this.topBox ? this.topBox.zIndex + 1 : 100,
            ...(smartPosition ? this.smartPosition(config) : config),
            darkMode: this.darkMode,
            prefersColorScheme: this.prefersColorScheme,
            maximized: this.maximized,
            minimized: this.minimized,
            fence: this.fence,
            namespace: this.namespace,
            containerRect: this.containerRect,
            readonly: this.readonly,
            collectorRect: this.collectorRect,
        });

        box.mount(this.root);

        if (box.focus) {
            this.focusBox(box);
            if (smartPosition) {
                this.makeBoxTop(box);
            }
        }

        this.boxes$.setValue([...this.boxes, box]);

        box._delegateEvents.on(TELE_BOX_DELEGATE_EVENT.Maximize, () => {
            this.setMaximized(!this.maximized);
        });
        box._delegateEvents.on(TELE_BOX_DELEGATE_EVENT.Minimize, () => {
            this.setMinimized(true);
        });
        box._delegateEvents.on(TELE_BOX_DELEGATE_EVENT.Close, () => {
            this.remove(box);
            this.focusTopBox();
        });
        box._coord$.reaction((_, __, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_MANAGER_EVENT.Move, box);
            }
        });
        box._size$.reaction((_, __, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_MANAGER_EVENT.Resize, box);
            }
        });
        box._intrinsicCoord$.reaction((_, __, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_MANAGER_EVENT.IntrinsicMove, box);
            }
        });
        box._intrinsicSize$.reaction((_, __, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_MANAGER_EVENT.IntrinsicResize, box);
            }
        });
        box._visualSize$.reaction((_, __, skipUpdate) => {
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_MANAGER_EVENT.VisualResize, box);
            }
        });
        box._zIndex$.reaction((_, __, skipUpdate) => {
            if (this.boxes.length > 0) {
                const topBox = this.boxes.reduce((topBox, box) =>
                    topBox.zIndex > box.zIndex ? topBox : box
                );
                this.topBox$.setValue(topBox);
            }
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_MANAGER_EVENT.ZIndex, box);
            }
        });
        this.events.emit(TELE_BOX_MANAGER_EVENT.Created, box);

        return box;
    }

    public query(config?: TeleBoxManagerQueryConfig): ReadonlyTeleBox[] {
        return config
            ? this.boxes.filter(this.teleBoxMatcher(config))
            : [...this.boxes];
    }

    public queryOne(
        config?: TeleBoxManagerQueryConfig
    ): ReadonlyTeleBox | undefined {
        return config
            ? this.boxes.find(this.teleBoxMatcher(config))
            : this.boxes[0];
    }

    public update(
        boxID: string,
        config: TeleBoxManagerUpdateConfig,
        skipUpdate = false
    ): void {
        const box = this.boxes.find((box) => box.id === boxID);
        if (box) {
            return this.updateBox(box, config, skipUpdate);
        }
    }

    public updateAll(
        config: TeleBoxManagerUpdateConfig,
        skipUpdate = false
    ): void {
        this.boxes.forEach((box) => {
            this.updateBox(box, config, skipUpdate);
        });
    }

    public remove(
        boxOrID: string | TeleBox,
        skipUpdate = false
    ): ReadonlyTeleBox | undefined {
        const index = this.getBoxIndex(boxOrID);
        if (index >= 0) {
            const boxes = this.boxes.slice();
            const deletedBoxes = boxes.splice(index, 1);
            this.boxes$.setValue(boxes);
            deletedBoxes.forEach((box) => box.destroy());
            if (!skipUpdate) {
                if (this.boxes.length <= 0) {
                    this.setMaximized(false);
                    this.setMinimized(false);
                }
                this.events.emit(TELE_BOX_MANAGER_EVENT.Removed, deletedBoxes);
            }
            return deletedBoxes[0];
        }
        return;
    }

    public removeTopBox(): ReadonlyTeleBox | undefined {
        if (this.topBox) {
            return this.remove(this.topBox);
        }
        return;
    }

    public removeAll(skipUpdate = false): ReadonlyTeleBox[] {
        const deletedBoxes = this.boxes$.value;
        this.boxes$.setValue([]);
        deletedBoxes.forEach((box) => box.destroy());
        if (!skipUpdate) {
            if (this.boxes.length <= 0) {
                this.setMaximized(false);
                this.setMinimized(false);
            }
            this.events.emit(TELE_BOX_MANAGER_EVENT.Removed, deletedBoxes);
        }
        return deletedBoxes;
    }

    public destroy(skipUpdate = false): void {
        this.events.removeAllListeners();
        this._sideEffect.flushAll();
        this.removeAll(skipUpdate);

        Object.keys(this).forEach((key) => {
            const value = this[key as keyof this];
            if (value instanceof Val) {
                value.destroy();
            }
        });
    }

    public wrapClassName(className: string): string {
        return `${this.namespace}-${className}`;
    }

    public focusBox(boxOrID: string | TeleBox, skipUpdate = false): void {
        const targetBox = this.getBox(boxOrID);
        if (targetBox) {
            this.boxes.forEach((box) => {
                if (targetBox === box) {
                    let focusChanged = false;
                    if (!targetBox.focus) {
                        focusChanged = true;
                        targetBox.setFocus(true, skipUpdate);
                    }
                    if (focusChanged && !skipUpdate) {
                        this.events.emit(
                            TELE_BOX_MANAGER_EVENT.Focused,
                            targetBox
                        );
                    }
                } else if (box.focus) {
                    this.blurBox(box, skipUpdate);
                }
            });
            this.maxTitleBar.focusBox(targetBox);
        }
    }

    public focusTopBox(): void {
        if (this.topBox && !this.topBox.focus) {
            return this.focusBox(this.topBox);
        }
    }

    public blurBox(boxOrID: string | TeleBox, skipUpdate = false): void {
        const targetBox = this.getBox(boxOrID);
        if (targetBox) {
            if (targetBox.focus) {
                targetBox.setFocus(false, skipUpdate);
                if (!skipUpdate) {
                    this.events.emit(TELE_BOX_MANAGER_EVENT.Blurred, targetBox);
                }
            }
            if (this.maxTitleBar.focusedBox === targetBox) {
                this.maxTitleBar.focusBox();
            }
        }
    }

    public blurAll(skipUpdate = false): void {
        this.boxes.forEach((box) => {
            if (box.focus) {
                box.setFocus(false, skipUpdate);
                if (!skipUpdate) {
                    this.events.emit(TELE_BOX_MANAGER_EVENT.Blurred, box);
                }
            }
        });
        if (this.maxTitleBar.focusedBox) {
            this.maxTitleBar.focusBox();
        }
    }

    protected maxTitleBar: MaxTitleBar;

    protected boxes$: Val<TeleBox[]>;
    protected topBox$: Val<TeleBox | undefined>;

    protected teleBoxMatcher(
        config: TeleBoxManagerQueryConfig
    ): (box: TeleBox) => boolean {
        const keys = Object.keys(config) as Array<
            keyof TeleBoxManagerQueryConfig
        >;
        return (box: TeleBox): boolean =>
            keys.every((key) => config[key] === box[key]);
    }

    protected updateBox(
        box: TeleBox,
        config: TeleBoxManagerUpdateConfig,
        skipUpdate = false
    ): void {
        if (config.x != null || config.y != null) {
            box.move(
                config.x == null ? box.intrinsicX : config.x,
                config.y == null ? box.intrinsicY : config.y,
                skipUpdate
            );
        }
        if (config.width != null || config.height != null) {
            box.resize(
                config.width == null ? box.intrinsicWidth : config.width,
                config.height == null ? box.intrinsicHeight : config.height,
                skipUpdate
            );
        }
        if (config.title != null) {
            box.setTitle(config.title);
            this.maxTitleBar.updateTitles();
        }
        if (config.visible != null) {
            box.setVisible(config.visible, skipUpdate);
        }
        if (config.minHeight != null) {
            box.setMinHeight(config.minHeight, skipUpdate);
        }
        if (config.minWidth != null) {
            box.setMinWidth(config.minWidth, skipUpdate);
        }
        if (config.resizable != null) {
            box.setResizable(config.resizable, skipUpdate);
        }
        if (config.draggable != null) {
            box.setDraggable(config.draggable, skipUpdate);
        }
        if (config.fixRatio != null) {
            box.setFixRatio(config.fixRatio, skipUpdate);
        }
        if (config.zIndex != null) {
            box.setZIndex(config.zIndex, skipUpdate);
        }
        if (config.content != null) {
            box.mountContent(config.content);
        }
        if (config.footer != null) {
            box.mountFooter(config.footer);
        }
    }

    protected smartPosition(config: TeleBoxConfig = {}): TeleBoxConfig {
        let { x, y } = config;
        const { width = 0.5, height = 0.5 } = config;

        if (x == null) {
            let vx = 20;
            if (this.topBox) {
                vx = this.topBox.intrinsicX * this.containerRect.width + 20;

                if (
                    vx >
                    this.containerRect.width - width * this.containerRect.width
                ) {
                    vx = 20;
                }
            }
            x = vx / this.containerRect.width;
        }

        if (y == null) {
            let vy = 20;

            if (this.topBox) {
                vy = this.topBox.intrinsicY * this.containerRect.height + 20;

                if (
                    vy >
                    this.containerRect.height -
                        height * this.containerRect.height
                ) {
                    vy = 20;
                }
            }

            y = vy / this.containerRect.height;
        }

        return { ...config, x, y, width, height };
    }

    protected makeBoxTop(box: TeleBox, skipUpdate = false): void {
        if (this.topBox) {
            if (box !== this.topBox) {
                box.setZIndex(this.topBox.zIndex + 1, skipUpdate);
            }
        }
    }

    protected getBoxIndex(boxOrID: TeleBox | string): number {
        return typeof boxOrID === "string"
            ? this.boxes.findIndex((box) => box.id === boxOrID)
            : this.boxes.findIndex((box) => box === boxOrID);
    }

    protected getBox(boxOrID: TeleBox | string): TeleBox | undefined {
        return typeof boxOrID === "string"
            ? this.boxes.find((box) => box.id === boxOrID)
            : boxOrID;
    }
}
