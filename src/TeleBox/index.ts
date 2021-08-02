import "./style.scss";

import EventEmitter from "eventemitter3";
import { DefaultTitleBar, TeleTitleBar } from "../TeleTitleBar";
import { clamp, flattenEvent, genUniqueKey, preventEvent } from "../utils";
import {
    TeleBoxEventType,
    TeleBoxState,
    TeleBoxResizeHandle,
    TeleBoxDragHandleType,
} from "./constants";
import type {
    TeleBoxConfig,
    TeleBoxEvents,
    TeleBoxHandleType,
} from "./typings";

export * from "./constants";
export * from "./typings";

export class TeleBox {
    public constructor({
        id = genUniqueKey(),
        title = "",
        width = 0.5,
        height = 0.5,
        minWidth = 0,
        minHeight = 0,
        x = 0.1,
        y = 0.1,
        state = TeleBoxState.Normal,
        namespace = "telebox",
        titleBar,
    }: TeleBoxConfig = {}) {
        this.id = id;
        this._title = title;
        this._minWidth = clamp(minWidth, 0, 1);
        this._minHeight = clamp(minHeight, 0, 1);
        this._width = clamp(width, this._minWidth, 1);
        this._height = clamp(height, this._minHeight, 1);
        this._x = clamp(x, 0, 1);
        this._y = clamp(y, 0, 1);
        this._state = state;
        this._titleBar = titleBar;

        this.namespace = namespace;
    }

    public readonly id: string;

    public readonly events = new EventEmitter() as TeleBoxEvents;

    /** Box title. Default empty. */
    public get title(): string {
        return this._title;
    }

    /** Element to mount. Default empty. */
    public get container(): HTMLElement | undefined {
        if (this._container) {
            return this._container;
        }
        if (this.$box?.parentElement) {
            return this.$box.parentElement;
        }
        return void 0;
    }

    /** Box width relative to container element. 0~1. Default 0.5. */
    public get width(): number {
        return this._width;
    }

    /** Box height relative to container element. 0~1. Default 0.5. */
    public get height(): number {
        return this._height;
    }

    /** Minimum box width relative to container element. 0~1. Default 0. */
    public get minWidth(): number {
        return this._minWidth;
    }

    /** Minimum box height relative to container element. 0~1. Default 0. */
    public get minHeight(): number {
        return this._minHeight;
    }

    /** x position relative to container element. 0~1. Default 0.1. */
    public get x(): number {
        return this._x;
    }

    /** y position relative to container element. 0~1. Default 0.1. */
    public get y(): number {
        return this._y;
    }

    /** Is box maximized. Default false. */
    public get state(): TeleBoxState {
        return this._state;
    }

    public get titleBar(): TeleTitleBar {
        if (!this._titleBar) {
            this._titleBar = new DefaultTitleBar();
        }
        return this._titleBar;
    }

    /**
     * Mount box to a container element.
     */
    public mount(container: HTMLElement): this {
        this._container = container;
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
     * Update box title.
     * @param title new box title
     * @returns this
     */
    public setTitle(title: string): this {
        this._title = title;
        if (this._titleBar) {
            this._titleBar.updateTitle(title);
        }
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
        if (this._x !== x || this._y !== y) {
            this._x = x;
            this._y = y;

            if (this.$box) {
                this.$box.style.left = this._x * 100 + "%";
                this.$box.style.top = this._y * 100 + "%";
            }

            if (!skipUpdate) {
                this.events.emit(TeleBoxEventType.Move, x, y);
            }
        }

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
        if (
            width < this._minWidth ||
            width > 1 ||
            height < this._minHeight ||
            height > 1
        ) {
            return this;
        }

        if (this._width !== width || this._height !== height) {
            this._width = width;
            this._height = height;

            if (this.$box) {
                this.$box.style.width = this._width * 100 + "%";
                this.$box.style.height = this._height * 100 + "%";
            }

            if (!skipUpdate) {
                this.events.emit(TeleBoxEventType.Resize, width, height);
            }
        }

        return this;
    }

    /**
     * Resize + Move.
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
        if (
            y < 0 ||
            width < this._minWidth ||
            width > 1 ||
            height < this._minHeight ||
            height > 1
        ) {
            return this;
        }

        this.move(x, y, skipUpdate);
        this.resize(width, height, skipUpdate);

        return this;
    }

    /**
     * @param minWidth Minimum box width relative to container element. 0~1.
     * @returns this
     */
    public setMinWidth(minWidth: number): this {
        this._minWidth = minWidth;
        this.resize(clamp(this._width, this._minWidth, 1), this._height);
        return this;
    }

    /**
     * @param minHeight Minimum box height relative to container element. 0~1.
     * @returns this
     */
    public setMinHeight(minHeight: number): this {
        this._minHeight = minHeight;
        this.resize(this._width, clamp(this._height, this._minHeight, 1));
        return this;
    }

    public setState(state: TeleBoxState, skipUpdate = false): this {
        if (this._state !== state) {
            this._state = state;

            // @TODO

            if (!skipUpdate) {
                this.events.emit(TeleBoxEventType.State, state);
            }
        }

        return this;
    }

    /**
     * Clean up.
     */
    public destroy(): void {
        this.unRender();
    }

    /**
     * Wrap a className with namespace
     */
    public wrapClassName(className: string): string {
        return `${this.namespace}-${className}`;
    }

    protected _title: string;
    protected _container?: HTMLElement;
    protected _width: number;
    protected _height: number;
    protected _minWidth: number;
    protected _minHeight: number;
    protected _x: number;
    protected _y: number;
    protected _state: TeleBoxState;
    protected _titleBar: TeleTitleBar | undefined;

    /** Classname Prefix. For CSS styling. Default "telebox" */
    protected readonly namespace: string;

    /** DOM of the box */
    protected $box: HTMLElement | undefined;

    /** DOM of the box content */
    protected $content: HTMLElement | undefined;

    protected $dragHandle: HTMLElement | undefined;

    protected $resizeHandles: HTMLElement | undefined;

    protected $trackMask: HTMLElement | undefined;

    public render(root?: HTMLElement): HTMLElement {
        if (root && this.$box) {
            if (root === this.$box) {
                return this.$box;
            } else {
                this.unRender();
            }
        }

        if (!this.$box) {
            if (root) {
                this.$box = root;
                this.$box.classList.add(this.wrapClassName("box"));
            } else {
                this.$box = document.createElement("div");
                this.$box.className = this.wrapClassName("box");
            }
            this.$box.style.left = this._x * 100 + "%";
            this.$box.style.top = this._y * 100 + "%";
            this.$box.style.width = this._width * 100 + "%";
            this.$box.style.height = this._height * 100 + "%";

            const $titleBar = this.titleBar.render(this);
            this.$dragHandle = this.titleBar.dragHandle();
            if (this.$dragHandle) {
                this.$dragHandle.dataset.teleBoxHandle = TeleBoxDragHandleType;
                this.$dragHandle.addEventListener(
                    "mousedown",
                    this.handleTrackStart
                );
                this.$dragHandle.addEventListener(
                    "touchstart",
                    this.handleTrackStart
                );
            }

            this.$content = document.createElement("div");
            this.$content.className = this.wrapClassName("content");

            const $resizeHandles = document.createElement("div");
            $resizeHandles.addEventListener("mousedown", this.handleTrackStart);
            $resizeHandles.addEventListener(
                "touchstart",
                this.handleTrackStart
            );
            this.$resizeHandles = $resizeHandles;

            Object.values(TeleBoxResizeHandle).forEach((handleType) => {
                const $handle = document.createElement("div");
                $handle.className = this.wrapClassName(handleType);
                $handle.dataset.teleBoxHandle = handleType;

                $resizeHandles.appendChild($handle);
            });

            this.$box.appendChild($titleBar);
            this.$box.appendChild(this.$content);
            this.$box.appendChild($resizeHandles);
        }

        return this.$box;
    }

    protected unRender(): void {
        if (this.$dragHandle) {
            this.$dragHandle.removeEventListener(
                "mousedown",
                this.handleTrackStart
            );
            this.$dragHandle.removeEventListener(
                "touchstart",
                this.handleTrackStart
            );
            this.$dragHandle = void 0;
        }
        if (this.$resizeHandles) {
            this.$resizeHandles.removeEventListener(
                "mousedown",
                this.handleTrackStart
            );
            this.$resizeHandles.removeEventListener(
                "touchstart",
                this.handleTrackStart
            );
            this.$resizeHandles = void 0;
        }
        this.$box = void 0;
        this.$content = void 0;
        this.$trackMask = void 0;
    }

    protected trackStartX: number = 0;
    protected trackStartY: number = 0;

    protected trackStartWidth: number = 0;
    protected trackStartHeight: number = 0;

    protected trackStartParentWidth: number = 0;
    protected trackStartParentHeight: number = 0;

    protected trackStartPageX: number = 0;
    protected trackStartPageY: number = 0;

    protected trackingHandle: TeleBoxHandleType | undefined;

    protected handleTrackStart = (ev: MouseEvent | TouchEvent): void => {
        if (
            this.trackingHandle ||
            !this.$box ||
            this.state !== TeleBoxState.Normal
        ) {
            return;
        }

        preventEvent(ev);

        const target = ev.target as HTMLElement;
        if (target.dataset?.teleBoxHandle) {
            preventEvent(ev);

            this.trackStartX = this._x;
            this.trackStartY = this._y;
            this.trackStartWidth = this._width;
            this.trackStartHeight = this._height;

            const boxRect = this.$box.getBoundingClientRect();
            this.trackStartParentWidth = boxRect.width / this._width;
            this.trackStartParentHeight = boxRect.height / this._height;

            ({ pageX: this.trackStartPageX, pageY: this.trackStartPageY } =
                flattenEvent(ev));

            this.trackingHandle = target.dataset
                .teleBoxHandle as TeleBoxResizeHandle;

            this.mountTrackMask();
        }
    };

    protected mountTrackMask(): void {
        if (this.$box) {
            if (!this.$trackMask) {
                this.$trackMask = document.createElement("div");
            }
            const cursor = this.trackingHandle
                ? this.wrapClassName(`cursor-${this.trackingHandle}`)
                : "";
            this.$trackMask.className = this.wrapClassName(
                `track-mask${cursor ? ` ${cursor}` : ""}`
            );
            window.addEventListener("mousemove", this.handleTracking);
            window.addEventListener("touchmove", this.handleTracking);
            window.addEventListener("mouseup", this.handleTrackEnd);
            window.addEventListener("touchend", this.handleTrackEnd);
            this.$box.appendChild(this.$trackMask);
        }
    }

    protected handleTracking = (ev: MouseEvent | TouchEvent): void => {
        if (!this.$box) {
            return;
        }

        preventEvent(ev);

        const { pageX, pageY } = flattenEvent(ev);
        if (pageY < 0) {
            return;
        }

        const offsetX =
            (pageX - this.trackStartPageX) / this.trackStartParentWidth;
        const offsetY =
            (pageY - this.trackStartPageY) / this.trackStartParentHeight;

        switch (this.trackingHandle) {
            case TeleBoxResizeHandle.North: {
                this.transform(
                    this._x,
                    this.trackStartY + offsetY,
                    this._width,
                    this.trackStartHeight - offsetY
                );
                break;
            }
            case TeleBoxResizeHandle.South: {
                this.resize(this._width, this.trackStartHeight + offsetY);
                break;
            }
            case TeleBoxResizeHandle.West: {
                this.transform(
                    this.trackStartX + offsetX,
                    this._y,
                    this.trackStartWidth - offsetX,
                    this._height
                );
                break;
            }
            case TeleBoxResizeHandle.East: {
                this.resize(this.trackStartWidth + offsetX, this._height);
                break;
            }
            case TeleBoxResizeHandle.NorthWest: {
                this.transform(
                    this.trackStartX + offsetX,
                    this.trackStartY + offsetY,
                    this.trackStartWidth - offsetX,
                    this.trackStartHeight - offsetY
                );
                break;
            }
            case TeleBoxResizeHandle.NorthEast: {
                this.transform(
                    this._x,
                    this.trackStartY + offsetY,
                    this.trackStartWidth + offsetX,
                    this.trackStartHeight - offsetY
                );
                break;
            }
            case TeleBoxResizeHandle.SouthEast: {
                this.transform(
                    this._x,
                    this._y,
                    this.trackStartWidth + offsetX,
                    this.trackStartHeight + offsetY
                );
                break;
            }
            case TeleBoxResizeHandle.SouthWest: {
                this.transform(
                    this.trackStartX + offsetX,
                    this._y,
                    this.trackStartWidth - offsetX,
                    this.trackStartHeight + offsetY
                );
                break;
            }
            default: {
                this.move(
                    this.trackStartX + offsetX,
                    this.trackStartY + offsetY
                );
                break;
            }
        }
    };

    protected handleTrackEnd = (ev: MouseEvent | TouchEvent): void => {
        this.trackingHandle = void 0;

        if (!this.$trackMask) {
            return;
        }

        preventEvent(ev);

        window.removeEventListener("mousemove", this.handleTracking);
        window.removeEventListener("touchmove", this.handleTracking);
        window.removeEventListener("mouseup", this.handleTrackEnd);
        window.removeEventListener("touchend", this.handleTrackEnd);
        this.$trackMask.remove();
    };
}
