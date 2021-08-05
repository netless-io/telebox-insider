import EventEmitter from "eventemitter3";
import type { TeleBoxConfig, TeleBoxRect } from "../TeleBox/typings";
import type { TeleBoxCollector } from "../TeleBoxCollector";
import { ReadonlyTeleBox, TeleBox } from "../TeleBox";
import { TeleBoxEventType, TeleBoxState } from "../TeleBox/constants";
import { TeleBoxManagerEventType } from "./constants";
import type {
    TeleBoxManagerConfig,
    TeleBoxManagerCreateConfig,
    TeleBoxManagerEvents,
    TeleBoxManagerQueryConfig,
    TeleBoxManagerUpdateConfig,
} from "./typings";

export class TeleBoxManager {
    public constructor({
        root = document.body,
        state = TeleBoxState.Normal,
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
    }: TeleBoxManagerConfig = {}) {
        this.root = root;
        this._state = state;
        this._fence = fence;
        this.containerRect = containerRect;
        this.collector = collector;
        this.namespace = namespace;
        this.zIndex = zIndex;

        if (collector) {
            collector.onClick = () => {
                if (this._state === TeleBoxState.Minimized) {
                    this.setState(this.lastState ?? TeleBoxState.Normal);
                } else {
                    this.setState(TeleBoxState.Minimized);
                }
            };
        }

        window.addEventListener("mousedown", this.checkFocusBox, true);
        window.addEventListener("touchstart", this.checkFocusBox, true);
    }

    public readonly events = new EventEmitter() as TeleBoxManagerEvents;

    public readonly containerRect: TeleBoxRect;

    public readonly collector: TeleBoxCollector | undefined;

    public readonly namespace: string;

    public readonly zIndex: number;

    public get state(): TeleBoxState {
        return this._state;
    }

    public get fence(): boolean {
        return this._fence;
    }

    public create(config?: TeleBoxManagerCreateConfig): ReadonlyTeleBox {
        const box = new TeleBox(this.wrapCreateConfig(config));
        box.mount(this.root);
        this.boxes.push(box);

        if (box.focus) {
            this.focusBox(true, box);
        }

        if (box.state !== this.state) {
            this.setState(box.state);
        }

        box.events.on(TeleBoxEventType.State, (state) => {
            this.setState(state);
            this.focusBox(true, box);
        });
        box.events.on(TeleBoxEventType.Close, () => {
            this.focusBox(false, box);
            this.remove(box.id);
        });
        box.events.on(TeleBoxEventType.Move, () => {
            this.events.emit(TeleBoxManagerEventType.Move, box);
            this.focusBox(true, box);
        });
        box.events.on(TeleBoxEventType.Resize, () => {
            this.events.emit(TeleBoxManagerEventType.Resize, box);
            this.focusBox(true, box);
        });

        this.events.emit(TeleBoxManagerEventType.Created, box);

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
            const box = boxes[0];
            this.focusBox(false, box);
            box.destroy();
            if (!skipUpdate) {
                this.events.emit(TeleBoxManagerEventType.Removed, boxes);
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
                    TeleBoxManagerEventType.Focused,
                    undefined,
                    box
                );
            }
        }
        const boxes = this.boxes.splice(0, this.boxes.length);
        boxes.forEach((box) => box.destroy());
        if (!skipUpdate) {
            this.events.emit(TeleBoxManagerEventType.Removed, boxes);
        }
        return boxes;
    }

    public destroy(skipUpdate = false): void {
        this.events.removeAllListeners();
        this._focusedBox = void 0;
        this._state = TeleBoxState.Normal;
        this.removeAll(skipUpdate);
        window.removeEventListener("mousedown", this.checkFocusBox, true);
        window.removeEventListener("touchstart", this.checkFocusBox, true);
    }

    public setContainerRect(rect: TeleBoxRect): this {
        (this.containerRect as TeleBoxRect) = rect;

        this.boxes.forEach((box) => {
            box.setContainerRect(this.containerRect);
        });

        return this;
    }

    public setState(state: TeleBoxState, skipUpdate = false): void {
        if (this._state !== state) {
            this.lastState = this._state;
            this._state = state;

            if (state === TeleBoxState.Minimized) {
                if (this.collector?.$collector) {
                    const rect =
                        this.collector.$collector.getBoundingClientRect();
                    this.boxes.forEach((box) => {
                        box.setCollectorRect(rect, true);
                    });
                } else if (import.meta.env.DEV) {
                    console.warn("No collector for minimized boxes.");
                }
            }

            this.boxes.forEach((box) => box.setState(state, skipUpdate));

            if (!skipUpdate) {
                this.events.emit(TeleBoxManagerEventType.State, state);
            }
        }
    }

    public setFence(fence: boolean, skipUpdate = false): void {
        if (this._fence !== fence) {
            this._fence = fence;
            this.boxes.forEach((box) => box.setFence(fence, skipUpdate));
        }
    }

    public setCollector(collector: TeleBoxCollector): void {
        if (this.collector) {
            this.collector.destroy();
        }

        (this.collector as TeleBoxCollector) = collector;

        collector.onClick = () => {
            if (this._state === TeleBoxState.Minimized) {
                this.setState(this.lastState ?? TeleBoxState.Normal);
            } else {
                this.setState(TeleBoxState.Minimized);
            }
        };
    }

    public wrapClassName(className: string): string {
        return `${this.namespace}-${className}`;
    }

    protected _state: TeleBoxState;

    protected _fence: boolean;

    protected _focusedBox: TeleBox | undefined;

    protected root: HTMLElement;

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
            this.focusBox(config.focus, box, skipUpdate);
        }
        if (config.content != null) {
            box.mountContent(config.content);
        }
    }

    protected focusBox(focus: boolean, box: TeleBox, skipUpdate = false): void {
        box.setFocus(focus, skipUpdate);
        if (box.focus) {
            if (this._focusedBox !== box) {
                const lastFocusedBox = this._focusedBox;
                if (this._focusedBox) {
                    this._focusedBox.setFocus(false, skipUpdate);
                }
                this._focusedBox = box;
                if (!skipUpdate) {
                    this.events.emit(
                        TeleBoxManagerEventType.Focused,
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
                        TeleBoxManagerEventType.Focused,
                        undefined,
                        box
                    );
                }
            }
        }
    }

    protected checkFocusBox = (ev: MouseEvent | TouchEvent): void => {
        const target = ev.target as HTMLElement;
        if (!target.tagName) {
            return;
        }

        const boxClassName = this.wrapClassName("box");

        for (let el: HTMLElement | null = target; el; el = el.parentElement) {
            if (el.classList?.contains(boxClassName)) {
                const id = el.dataset?.teleBoxID;
                if (id) {
                    const box = this.boxes.find((box) => box.id === id);
                    if (box) {
                        this.focusBox(true, box);
                        return;
                    }
                }
            }
        }
    };

    protected wrapCreateConfig(config: TeleBoxConfig = {}): TeleBoxConfig {
        const offsetX = 10 / this.containerRect.width;
        const offsetY = 10 / this.containerRect.height;

        let { x, y } = config;

        const refBox = this._focusedBox || this.boxes[this.boxes.length - 1];

        if (x == null) {
            x = (refBox?.x ?? 0) + offsetX;
            if (x * this.containerRect.width >= this.containerRect.width - 20) {
                x = offsetX;
            }
        }

        if (y == null) {
            y = (refBox?.y ?? 0) + offsetY;
            if (
                y * this.containerRect.height >=
                this.containerRect.height - 20
            ) {
                y = offsetY;
            }
        }

        return {
            ...config,
            x,
            y,
            state: this._state,
            fence: this._fence,
            zIndex: this.zIndex,
            namespace: this.namespace,
            containerRect: this.containerRect,
        };
    }
}