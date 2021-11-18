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
import { TELE_BOX_DELEGATE_EVENT } from "..";
import { Val, CombinedVal } from "../Val";
import { SideEffectManager } from "side-effect-manager";

export * from "./typings";
export * from "./constants";

export class TeleBoxManager {
    public constructor({
        root = document.body,
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
        zIndex = 100,
        readonly = false,
    }: TeleBoxManagerConfig = {}) {
        this._sideEffect = new SideEffectManager();

        this.root = root;
        this.namespace = namespace;
        this.zIndex = zIndex;

        this._readonly = new Val(readonly);
        this._readonly.reaction((readonly, skipUpdate) => {
            this.boxes.forEach((box) => box.setReadonly(readonly, skipUpdate));
        });

        this._minimized = new Val(minimized);

        this._maximized = new Val(maximized);
        this._maximized.reaction((maximized, skipUpdate) => {
            this.boxes.forEach((box) =>
                box.setMaximized(maximized, skipUpdate)
            );
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
            this.maxTitleBar.setState(state);
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_MANAGER_EVENT.State, state);
            }
        });

        this._fence = new Val(fence);
        this._fence.subscribe((fence, skipUpdate) => {
            this.boxes.forEach((box) => box.setFence(fence, skipUpdate));
        });

        this._containerRect = new Val(containerRect, shallowequal);
        this._containerRect.reaction((containerRect, skipUpdate) => {
            this.boxes.forEach((box) =>
                box.setContainerRect(containerRect, skipUpdate)
            );
            this.maxTitleBar.setContainerRect(containerRect);
        });

        this._collector = new Val(
            collector === null
                ? null
                : collector ||
                  new TeleBoxCollector({
                      visible: minimized,
                      readonly: readonly,
                      namespace,
                  }).mount(root)
        );
        this._collector.subscribe((collector) => {
            if (collector) {
                collector.setVisible(this.minimized);
                collector.setReadonly(this.readonly);
                this._sideEffect.add(() => {
                    collector.onClick = () => {
                        if (!this.readonly) {
                            this.setMinimized(false);
                        }
                    };
                    return () => collector.destroy();
                }, "collect-onClick");
            }
        });
        this._readonly.subscribe((readonly) =>
            this.collector?.setReadonly(readonly)
        );

        this._minimized.subscribe((minimized, skipUpdate) => {
            this.collector?.setVisible(minimized);

            if (minimized) {
                if (this.collector?.$collector) {
                    const { x, y, width, height } =
                        this.collector.$collector.getBoundingClientRect();
                    const rootRect = this.root.getBoundingClientRect();
                    this.boxes.forEach((box) => {
                        box.setCollectorRect(
                            {
                                x: x - rootRect.x,
                                y: y - rootRect.y,
                                width,
                                height,
                            },
                            true
                        );
                    });
                } else if (import.meta.env.DEV) {
                    console.warn("No collector for minimized boxes.");
                }
            }

            this.boxes.forEach((box) =>
                box.setMinimized(minimized, skipUpdate)
            );
        });

        const checkFocusBox = (ev: MouseEvent | TouchEvent): void => {
            if (this.readonly) {
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
                const id = el.dataset?.teleBoxID;
                if (id) {
                    const box = this.boxes.find((box) => box.id === id);
                    if (box) {
                        this.focusBox({ focus: true, box });
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
            readonly: this.readonly,
            namespace: this.namespace,
            state: this.state,
            boxes: this.boxes,
            focusedBox: this._focusedBox,
            containerRect: this.containerRect,
            onEvent: (event): void => {
                switch (event.type) {
                    case TELE_BOX_DELEGATE_EVENT.Maximize: {
                        this.setMaximized(!this.maximized);
                        break;
                    }
                    case TELE_BOX_DELEGATE_EVENT.Minimize: {
                        this.setMinimized(true);
                        break;
                    }
                    case TELE_BOX_EVENT.Close: {
                        const box =
                            this._focusedBox ??
                            this.boxes[this.boxes.length - 1];
                        if (box) {
                            this.remove(box.id);
                        }
                        break;
                    }
                    default: {
                        break;
                    }
                }
            },
        });
        this._readonly.subscribe((readonly) =>
            this.maxTitleBar.setReadonly(readonly)
        );

        this.root.appendChild(this.maxTitleBar.render());
    }

    public readonly events = new EventEmitter() as TeleBoxManagerEvents;

    protected _sideEffect: SideEffectManager;

    protected root: HTMLElement;

    public readonly namespace: string;

    public zIndex: number;

    protected _collector: Val<TeleBoxCollector | null>;

    public get collector(): TeleBoxCollector | null {
        return this._collector.value;
    }

    public setCollector(collector: TeleBoxCollector): void {
        this._collector.setValue(collector);
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

    public get state(): TeleBoxState {
        return this._state.value;
    }

    protected _fence: Val<boolean, boolean>;

    public get fence(): boolean {
        return this._fence.value;
    }

    public setFence(fence: boolean, skipUpdate = false): this {
        this._fence.setValue(fence, skipUpdate);
        return this;
    }

    protected _containerRect: Val<TeleBoxRect, boolean>;

    public get containerRect(): TeleBoxRect {
        return this._containerRect.value;
    }

    public setContainerRect(rect: TeleBoxRect, skipUpdate = false): this {
        this._containerRect.setValue(rect, skipUpdate);
        return this;
    }

    public create(config?: TeleBoxManagerCreateConfig): ReadonlyTeleBox {
        const box = new TeleBox(this.wrapCreateConfig(config));
        box.mount(this.root);
        this.boxes.push(box);

        if (box.focus) {
            this.focusBox({ focus: true, box, increaseZIndex: false });
        }

        this.maxTitleBar.setBoxes(this.boxes);

        box._delegateEvents.on(TELE_BOX_DELEGATE_EVENT.Maximize, () => {
            this.setMaximized(!this.maximized);
        });
        box._delegateEvents.on(TELE_BOX_DELEGATE_EVENT.Minimize, () => {
            this.setMinimized(true);
        });
        box._delegateEvents.on(TELE_BOX_DELEGATE_EVENT.Close, () => {
            this.focusBox({ focus: false, box });
            this.remove(box.id);
        });
        box.events.on(TELE_BOX_EVENT.Move, () => {
            this.events.emit(TELE_BOX_MANAGER_EVENT.Move, box);
        });
        box.events.on(TELE_BOX_EVENT.Resize, () => {
            this.events.emit(TELE_BOX_MANAGER_EVENT.Resize, box);
        });
        box.events.on(TELE_BOX_EVENT.IntrinsicMove, () => {
            this.events.emit(TELE_BOX_MANAGER_EVENT.IntrinsicMove, box);
        });
        box.events.on(TELE_BOX_EVENT.IntrinsicResize, () => {
            this.events.emit(TELE_BOX_MANAGER_EVENT.IntrinsicResize, box);
        });
        box.events.on(TELE_BOX_EVENT.VisualResize, () => {
            this.events.emit(TELE_BOX_MANAGER_EVENT.VisualResize, box);
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
        boxID: string,
        skipUpdate = false
    ): ReadonlyTeleBox | undefined {
        const index = this.boxes.findIndex((box) => box.id === boxID);
        if (index >= 0) {
            const boxes = this.boxes.splice(index, 1);
            this.maxTitleBar.setBoxes(this.boxes);
            const box = boxes[0];
            this.focusBox({ focus: false, box });
            box.destroy();
            if (this.boxes.length <= 0) {
                this.setMaximized(false);
                this.setMinimized(false);
            }
            if (!skipUpdate) {
                this.events.emit(TELE_BOX_MANAGER_EVENT.Removed, boxes);
            }
            return box;
        }
        return;
    }

    public removeAll(skipUpdate = false): ReadonlyTeleBox[] {
        if (this._focusedBox) {
            const box = this._focusedBox;
            this._focusedBox = void 0;
            if (!skipUpdate) {
                this.events.emit(
                    TELE_BOX_MANAGER_EVENT.Focused,
                    undefined,
                    box
                );
            }
        }
        const boxes = this.boxes.splice(0, this.boxes.length);
        this.maxTitleBar.setBoxes(this.boxes);
        boxes.forEach((box) => box.destroy());
        if (this.boxes.length <= 0) {
            this.setMaximized(false);
            this.setMinimized(false);
        }
        if (!skipUpdate) {
            this.events.emit(TELE_BOX_MANAGER_EVENT.Removed, boxes);
        }
        return boxes;
    }

    public destroy(skipUpdate = false): void {
        this.events.removeAllListeners();
        this._sideEffect.flushAll();
        this._focusedBox = void 0;
        this.removeAll(skipUpdate);

        Object.keys(this).forEach((key) => {
            const value = this[key as keyof this];
            if (value instanceof Val) {
                value.destroy();
            }
        });
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

    public wrapClassName(className: string): string {
        return `${this.namespace}-${className}`;
    }

    protected maxTitleBar: MaxTitleBar;

    protected _focusedBox: TeleBox | undefined;

    protected boxes: TeleBox[] = [];

    protected lastState: TeleBoxState | undefined;

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
                config.x == null ? box.x : config.x,
                config.y == null ? box.y : config.y,
                skipUpdate
            );
        }
        if (config.width != null || config.height != null) {
            box.resize(
                config.width == null ? box.width : config.width,
                config.height == null ? box.height : config.height,
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
            box.setResizable(config.resizable);
        }
        if (config.draggable != null) {
            box.setDraggable(config.draggable);
        }
        if (config.fixRatio != null) {
            box.setFixRatio(config.fixRatio, skipUpdate);
        }
        if (config.focus != null) {
            this.focusBox({ focus: config.focus, box, skipUpdate });
        }
        if (config.content != null) {
            box.mountContent(config.content);
        }
        if (config.footer != null) {
            box.mountFooter(config.footer);
        }
    }

    protected focusBox({
        focus,
        box,
        skipUpdate = false,
        increaseZIndex = true,
    }: {
        focus: boolean;
        box: TeleBox;
        skipUpdate?: boolean;
        increaseZIndex?: boolean;
    }): void {
        box.setFocus(focus, skipUpdate);
        if (box.focus) {
            if (this._focusedBox !== box) {
                const lastFocusedBox = this._focusedBox;
                if (this._focusedBox) {
                    this._focusedBox.setFocus(false, skipUpdate);
                }
                this._focusedBox = box;
                if (increaseZIndex) {
                    box.setZIndex(++this.zIndex);
                }
                if (!skipUpdate) {
                    this.events.emit(
                        TELE_BOX_MANAGER_EVENT.Focused,
                        box,
                        lastFocusedBox
                    );
                }
            }
        } else {
            if (this._focusedBox === box) {
                this._focusedBox = void 0;

                if (!skipUpdate) {
                    this.events.emit(
                        TELE_BOX_MANAGER_EVENT.Focused,
                        undefined,
                        box
                    );
                }
            }
        }
        this.maxTitleBar.focusBox(this._focusedBox);
    }

    protected getInitialPosition(
        width: number,
        height: number
    ): { x: number; y: number } {
        const upMostBox =
            this.boxes.length > 0 &&
            this.boxes.reduce((box1, box2) =>
                box1.zIndex > box2.zIndex ? box1 : box2
            );

        let x = 20;
        let y = 20;

        if (upMostBox) {
            x = upMostBox.x * this.containerRect.width + 20;
            y = upMostBox.y * this.containerRect.height + 20;

            if (
                x >
                    this.containerRect.width -
                        width * this.containerRect.width ||
                y >
                    this.containerRect.height -
                        height * this.containerRect.height
            ) {
                x = 20;
                y = 20;
            }
        }

        return {
            x: x / this.containerRect.width,
            y: y / this.containerRect.height,
        };
    }

    protected wrapCreateConfig(config: TeleBoxConfig = {}): TeleBoxConfig {
        let { x, y } = config;
        const { width = 0.5, height = 0.5 } = config;

        if (x == null || y == null) {
            const initialPos = this.getInitialPosition(width, height);

            if (x == null) {
                x = initialPos.x;
            }

            if (y == null) {
                y = initialPos.y;
            }
        }

        return {
            ...config,
            x,
            y,
            width,
            height,
            maximized: this.maximized,
            minimized: this.minimized,
            fence: this.fence,
            zIndex: this.zIndex,
            namespace: this.namespace,
            containerRect: this.containerRect,
            readonly: this.readonly,
        };
    }
}
