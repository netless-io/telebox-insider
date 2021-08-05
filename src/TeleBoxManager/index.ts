import EventEmitter from "eventemitter3";
import type { TeleBoxConfig, TeleBoxRect } from "../TeleBox/typings";
import type { TeleBoxCollector } from "../TeleBoxCollector";
import { ReadonlyTeleBox, TeleBox } from "../TeleBox";
import { TeleBoxEventType, TeleBoxState } from "../TeleBox/constants";
import { TeleBoxManagerEventType } from "./constants";
import type {
    TeleBoxManagerConfig,
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
    }: TeleBoxManagerConfig = {}) {
        this.root = root;
        this._state = state;
        this._fence = fence;
        this.containerRect = containerRect;
        this.collector = collector;

        if (collector) {
            collector.onClick = () => {
                if (this._state === TeleBoxState.Minimized) {
                    this.setState(this.lastState ?? TeleBoxState.Normal);
                } else {
                    this.setState(TeleBoxState.Minimized);
                }
            };
        }
    }

    public readonly events = new EventEmitter() as TeleBoxManagerEvents;

    public readonly containerRect: TeleBoxRect;

    public readonly collector: TeleBoxCollector | undefined;

    public get state(): TeleBoxState {
        return this._state;
    }

    public get fence(): boolean {
        return this._fence;
    }

    public create(config?: TeleBoxConfig): ReadonlyTeleBox {
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

    public update(boxID: string, config: TeleBoxManagerUpdateConfig): void {
        const box = this.boxes.find((box) => box.id === boxID);
        if (box) {
            return this.updateBox(box, config);
        }
    }

    public updateAll(config: TeleBoxManagerUpdateConfig): void {
        this.boxes.forEach((box) => {
            this.updateBox(box, config);
        });
    }

    public remove(boxID: string): ReadonlyTeleBox | undefined {
        const index = this.boxes.findIndex((box) => box.id === boxID);
        if (index >= 0) {
            const boxes = this.boxes.splice(index, 1);
            const box = boxes[0];
            this.focusBox(false, box);
            box.destroy();
            this.events.emit(TeleBoxManagerEventType.Removed, boxes);
            return box;
        }
        return;
    }

    public removeAll(): ReadonlyTeleBox[] {
        if (this._focusedBox) {
            const box = this._focusedBox;
            this._focusedBox = void 0;
            this.events.emit(TeleBoxManagerEventType.Focused, undefined, box);
        }
        const boxes = this.boxes.splice(0, this.boxes.length);
        boxes.forEach((box) => box.destroy());
        this.events.emit(TeleBoxManagerEventType.Removed, boxes);
        return boxes;
    }

    public destroy(): void {
        this.events.removeAllListeners();
        this._focusedBox = void 0;
        this._state = TeleBoxState.Normal;
        this.removeAll();
    }

    public setContainerRect(rect: TeleBoxRect): this {
        (this.containerRect as TeleBoxRect) = rect;

        this.boxes.forEach((box) => {
            box.setContainerRect(this.containerRect);
        });

        return this;
    }

    public setState(state: TeleBoxState): void {
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

            this.boxes.forEach((box) => box.setState(state));

            this.events.emit(TeleBoxManagerEventType.State, state);
        }
    }

    public setFence(fence: boolean): void {
        if (this._fence !== fence) {
            this._fence = fence;
            this.boxes.forEach((box) => box.setFence(fence));
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
        config: TeleBoxManagerUpdateConfig
    ): void {
        if (config.x != null || config.y != null) {
            box.move(
                config.x == null ? box.x : config.x,
                config.y == null ? box.y : config.y
            );
        }
        if (config.width != null || config.height != null) {
            box.resize(
                config.width == null ? box.width : config.width,
                config.height == null ? box.height : config.height
            );
        }
        if (config.title != null) {
            box.setTitle(config.title);
        }
        if (config.visible != null) {
            box.setVisible(config.visible);
        }
        if (config.minHeight != null) {
            box.setMinHeight(config.minHeight);
        }
        if (config.minWidth != null) {
            box.setMinWidth(config.minWidth);
        }
        if (config.resizable != null) {
            box.setResizable(config.resizable);
        }
        if (config.draggable != null) {
            box.setDraggable(config.draggable);
        }
        if (config.fixRatio != null) {
            box.setFixRatio(config.fixRatio);
        }
        if (config.focus != null) {
            this.focusBox(config.focus, box);
        }
        if (config.content != null) {
            box.mountContent(config.content);
        }
    }

    protected focusBox(focus: boolean, box: TeleBox): void {
        box.setFocus(focus);
        if (box.focus) {
            if (this._focusedBox !== box) {
                const lastFocusedBox = this._focusedBox;
                if (this._focusedBox) {
                    this._focusedBox.setFocus(false);
                }
                this._focusedBox = box;
                this.events.emit(
                    TeleBoxManagerEventType.Focused,
                    box,
                    lastFocusedBox
                );
            }
        } else {
            if (this._focusedBox === box) {
                this._focusedBox = void 0;
                this.events.emit(
                    TeleBoxManagerEventType.Focused,
                    undefined,
                    box
                );
            }
        }
    }

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
            containerRect: this.containerRect,
        };
    }
}
