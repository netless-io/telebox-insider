import "./style.scss";

import EventEmitter from "eventemitter3";
import { DefaultTitleBar, TeleTitleBar } from "../TeleTitleBar";
import {
    clamp,
    flattenEvent,
    genUniqueKey,
    getBoxDefaultName,
    preventEvent,
} from "../utils";
import {
    TeleBoxEventType,
    TeleBoxState,
    TeleBoxResizeHandle,
} from "./constants";
import type {
    TeleBoxConfig,
    TeleBoxRect,
    TeleBoxEvents,
    TeleBoxHandleType,
} from "./typings";

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
        state = TeleBoxState.Normal,
        resizable = true,
        draggable = true,
        fence = true,
        fixRatio = false,
        focus = false,
        zIndex = 100,
        namespace = "telebox",
        titleBar,
        content,
        containerRect = {
            x: 0,
            y: 0,
            width: window.innerWidth,
            height: window.innerHeight,
        },
        collectorRect,
    }: TeleBoxConfig = {}) {
        this.id = id;
        this._title = title;
        this._visible = visible;
        this._minWidth = clamp(minWidth, 0, 1);
        this._minHeight = clamp(minHeight, 0, 1);
        this._width = clamp(width, this._minWidth, 1);
        this._height = clamp(height, this._minHeight, 1);
        this._x = clamp(x, 0, 1);
        this._y = clamp(y, 0, 1);
        this._state = state;
        this._resizable = resizable;
        this._draggable = draggable;
        this._fence = fence;
        this._fixRatio = fixRatio;
        this._focus = focus;
        this._zIndex = zIndex;
        this._titleBar = titleBar;
        this.content = content;
        this.containerRect = containerRect;
        this.collectorRect = collectorRect;

        this.namespace = namespace;

        if (this._fixRatio) {
            this.transform(this._x, this._y, this._width, this._height, true);
        }
    }

    public content: HTMLElement | undefined;

    public readonly containerRect: TeleBoxRect;

    public readonly collectorRect: TeleBoxRect | undefined;

    public readonly id: string;

    public readonly events = new EventEmitter() as TeleBoxEvents;

    /** Box title. Default empty. */
    public get title(): string {
        return this._title;
    }

    public get visible(): boolean {
        return this._visible;
    }

    /** Box width relative to container element. 0~1. Default 0.5. */
    public get width(): number {
        if (this._state === TeleBoxState.Maximized) {
            return 1;
        }
        return this._width;
    }

    /** Box height relative to container element. 0~1. Default 0.5. */
    public get height(): number {
        if (this._state === TeleBoxState.Maximized) {
            return 1;
        }
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
        if (this._state === TeleBoxState.Maximized) {
            return 0;
        }
        return this._x;
    }

    /** y position relative to container element. 0~1. Default 0.1. */
    public get y(): number {
        if (this._state === TeleBoxState.Maximized) {
            return 0;
        }
        return this._y;
    }

    /** Is box maximized. Default false. */
    public get state(): TeleBoxState {
        return this._state;
    }

    /** Able to resize box window */
    public get resizable(): boolean {
        return this._resizable;
    }

    /** Able to drag box window */
    public get draggable(): boolean {
        return this._draggable;
    }

    /** Restrict box to always be within the containing area. */
    public get fence(): boolean {
        return this._fence;
    }

    /** Fixed width/height ratio for box window. */
    public get fixRatio(): boolean {
        return Boolean(this._fixRatio);
    }

    public get focus(): boolean {
        return this._focus;
    }

    public get zIndex(): number {
        if (this._focus) {
            return this._zIndex + 1;
        }
        return this._zIndex;
    }

    public get titleBar(): TeleTitleBar {
        if (!this._titleBar) {
            this._titleBar = new DefaultTitleBar({
                title: this.title,
                namespace: this.namespace,
                onDragStart: this.handleTrackStart,
                onEvent: (event): void => {
                    if (
                        event.type === TeleBoxEventType.State &&
                        event.value === TeleBoxState.Maximized
                    ) {
                        this.events.emit(
                            TeleBoxEventType.State,
                            this._state === TeleBoxState.Maximized
                                ? TeleBoxState.Normal
                                : TeleBoxState.Maximized
                        );
                    } else {
                        this.events.emit(event.type, event.value);
                    }
                },
            });
        }
        return this._titleBar;
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
        if (this.content !== content) {
            this.content = content;
            if (this.$content) {
                if (this.$content.firstChild) {
                    this.$content.removeChild(this.$content.firstChild);
                }
                this.$content.appendChild(content);
            }
        }
        return this;
    }

    /**
     * Unmount content from the box.
     */
    public unmountContent(): this {
        if (this.$content) {
            if (this.$content.firstChild) {
                this.$content.removeChild(this.$content.firstChild);
            }
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
                const x =
                    this._x * this.containerRect.width +
                    this.containerRect.x +
                    "px";
                const y =
                    this._y * this.containerRect.height +
                    this.containerRect.y +
                    "px";
                this.$box.style.transform = `translate(${x},${y})`;
            }

            if (!skipUpdate) {
                this.events.emit(TeleBoxEventType.Move, { x, y });
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
                this.$box.style.width =
                    this._width * this.containerRect.width + "px";
                this.$box.style.height =
                    this._height * this.containerRect.height + "px";
            }

            if (!skipUpdate) {
                this.events.emit(TeleBoxEventType.Resize, { width, height });
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
        if (this._fixRatio) {
            const newHeight = (this._height / this._width) * width;
            if (y !== this._y) {
                y -= newHeight - height;
            }
            height = newHeight;
        }

        if (
            x < 0 ||
            y < 0 ||
            x > 1 - width ||
            y > 1 - height ||
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

            this.syncTeleStateDOM();

            if (!skipUpdate) {
                this.events.emit(TeleBoxEventType.State, state);
            }
        }

        return this;
    }

    public setDraggable(draggable: boolean): this {
        if (this._draggable !== draggable) {
            this._draggable = draggable;
            if (this.$box) {
                this.$box.classList.toggle(
                    this.wrapClassName("no-drag"),
                    !draggable
                );
            }
        }
        return this;
    }

    public setResizable(resizable: boolean): this {
        if (this._resizable !== resizable) {
            this._resizable = resizable;
            if (this.$box) {
                this.$box.classList.toggle(
                    this.wrapClassName("no-resize"),
                    !resizable
                );
            }
        }
        return this;
    }

    public setFence(fence: boolean): this {
        if (this._fence !== fence) {
            this._fence = fence;
            this.transform(this._x, this._y, this._width, this._height);
        }
        return this;
    }

    public setFixRatio(fixRatio: boolean): this {
        if (this._fixRatio !== fixRatio) {
            this._fixRatio = fixRatio;
            if (fixRatio) {
                this.transform(this._x, this._y, this._width, this._height);
            }
        }
        return this;
    }

    public setFocus(focus: boolean, skipUpdate = false): this {
        if (this._focus !== focus) {
            this._focus = focus;
            if (this.$box) {
                this.$box.classList.toggle(this.wrapClassName("blur"), !focus);
                this.$box.style.zIndex = String(this.zIndex);
            }
            if (!skipUpdate) {
                this.events.emit(
                    focus ? TeleBoxEventType.Focus : TeleBoxEventType.Blur
                );
            }
        }
        return this;
    }

    public setVisible(visible: boolean): this {
        if (this._visible !== visible) {
            this._visible = visible;
            if (this.$box) {
                this.$box.style.display = visible ? "block" : "none";
            }
            if (!visible) {
                this.events.emit(TeleBoxEventType.Close);
            }
        }
        return this;
    }

    public setContainerRect(rect: TeleBoxRect): this {
        const x = (this._x * this.containerRect.width) / rect.width;
        const y = (this._y * this.containerRect.height) / rect.height;
        const width = (this._width * this.containerRect.width) / rect.width;
        const height = (this._height * this.containerRect.height) / rect.height;

        (this.containerRect as TeleBoxRect) = rect;

        this.move(x, y);
        this.resize(width, height);

        return this;
    }

    public setCollectorRect(rect: TeleBoxRect): this {
        (this.collectorRect as TeleBoxRect) = rect;
        this.syncTeleStateDOM();
        return this;
    }

    /**
     * Clean up.
     */
    public destroy(): void {
        if (this.$box) {
            this.$box.remove();
        }
        if (this._titleBar) {
            this._titleBar.destroy();
        }
        this.unRender();
        this.events.removeAllListeners();
    }

    /**
     * Wrap a className with namespace
     */
    public wrapClassName(className: string): string {
        return `${this.namespace}-${className}`;
    }

    protected _title: string;
    protected _visible: boolean;
    protected _width: number;
    protected _height: number;
    protected _minWidth: number;
    protected _minHeight: number;
    protected _x: number;
    protected _y: number;
    protected _state: TeleBoxState;
    protected _resizable: boolean;
    protected _draggable: boolean;
    protected _fence: boolean;
    protected _fixRatio: boolean;
    protected _focus: boolean;
    protected _zIndex: number;
    protected _titleBar: TeleTitleBar | undefined;

    /** Classname Prefix. For CSS styling. Default "telebox" */
    protected readonly namespace: string;

    /** DOM of the box */
    protected $box: HTMLElement | undefined;

    /** DOM of the box content */
    protected $content: HTMLElement | undefined;

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

            if (!this._draggable) {
                this.$box.classList.add(this.wrapClassName("no-drag"));
            }

            if (!this._resizable) {
                this.$box.classList.add(this.wrapClassName("no-resize"));
            }

            if (!this._focus) {
                this.$box.classList.add(this.wrapClassName("blur"));
            }

            if (!this._visible) {
                this.$box.style.display = "none";
            }

            const x =
                this._x * this.containerRect.width +
                this.containerRect.x +
                "px";
            const y =
                this._y * this.containerRect.height +
                this.containerRect.y +
                "px";

            this.$box.style.transform = `translate(${x},${y})`;
            this.$box.style.zIndex = String(this.zIndex);
            this.$box.style.width =
                this._width * this.containerRect.width + "px";
            this.$box.style.height =
                this._height * this.containerRect.height + "px";

            const $titleBar = this.titleBar.render();

            this.$content = document.createElement("div");
            this.$content.className = this.wrapClassName("content");
            if (this.content) {
                this.$content.appendChild(this.content);
            }

            const $resizeHandles = document.createElement("div");
            $resizeHandles.className = this.wrapClassName("resize-handles");
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

            this.syncTeleStateDOM();

            this.$box.appendChild($titleBar);
            this.$box.appendChild(this.$content);
            this.$box.appendChild($resizeHandles);
        }

        return this.$box;
    }

    protected unRender(): void {
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

    protected trackStartPageX: number = 0;
    protected trackStartPageY: number = 0;

    protected trackingHandle: TeleBoxHandleType | undefined;

    public handleTrackStart = (ev: MouseEvent | TouchEvent): void => {
        if (
            (ev as MouseEvent).button != null &&
            (ev as MouseEvent).button !== 0
        ) {
            // Not left mouse
            return;
        }

        if (
            !this.draggable ||
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
            this.$box.appendChild(this.$trackMask);
            window.addEventListener("mousemove", this.handleTracking);
            window.addEventListener("touchmove", this.handleTracking);
            window.addEventListener("mouseup", this.handleTrackEnd);
            window.addEventListener("touchend", this.handleTrackEnd);
        }
    }

    protected handleTracking = (ev: MouseEvent | TouchEvent): void => {
        if (!this.$box) {
            return;
        }

        preventEvent(ev);

        let { pageX, pageY } = flattenEvent(ev);
        if (pageY < 0) {
            pageY = 0;
        }

        const offsetX =
            (pageX - this.trackStartPageX) / this.containerRect.width;
        const offsetY =
            (pageY - this.trackStartPageY) / this.containerRect.height;

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
                this.transform(
                    this._x,
                    this._y,
                    this._width,
                    this.trackStartHeight + offsetY
                );
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
                this.transform(
                    this._x,
                    this._y,
                    this.trackStartWidth + offsetX,
                    this._height
                );
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
                if (this._fence) {
                    this.move(
                        clamp(this.trackStartX + offsetX, 0, 1 - this._width),
                        clamp(this.trackStartY + offsetY, 0, 1 - this._height)
                    );
                } else {
                    this.move(
                        this.trackStartX + offsetX,
                        this.trackStartY + offsetY
                    );
                }
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

    protected syncTeleStateDOM(): this {
        if (this.$box) {
            this.$box.classList.toggle(
                this.wrapClassName("minimized"),
                this._state === TeleBoxState.Minimized
            );
            this.$box.classList.toggle(
                this.wrapClassName("maximized"),
                this._state === TeleBoxState.Maximized
            );

            if (this._state === TeleBoxState.Minimized && this.collectorRect) {
                const translateX = this.collectorRect.x;
                const translateY = this.collectorRect.y;
                const scaleX =
                    this.collectorRect.width /
                    (this._width * this.containerRect.width);
                const scaleY =
                    this.collectorRect.height /
                    (this._height * this.containerRect.height);
                const width = this._width * this.containerRect.width;
                const height = this._height * this.containerRect.height;

                this.$box.style.transition = "opacity 0.4s, transform 0.4s";
                this.$box.style.transform = `translate(${translateX}px,${translateY}px) scale(${scaleX},${scaleY})`;
                this.$box.style.width = width + "px";
                this.$box.style.height = height + "px";
                this.$box.style.opacity = "0";
            } else if (this._state === TeleBoxState.Maximized) {
                this.$box.style.transition = "";
                this.$box.style.transform = `translate(${this.containerRect.x}px,${this.containerRect.y}px)`;
                this.$box.style.width = this.containerRect.width + "px";
                this.$box.style.height = this.containerRect.height + "px";
                this.$box.style.opacity = "1";
            } else {
                const translateX =
                    this._x * this.containerRect.width +
                    this.containerRect.x +
                    "px";
                const translateY =
                    this._y * this.containerRect.height +
                    this.containerRect.y +
                    "px";
                const width = this._width * this.containerRect.width;
                const height = this._height * this.containerRect.height;

                this.$box.style.transition = "";
                this.$box.style.transform = `translate(${translateX},${translateY})`;
                this.$box.style.width = width + "px";
                this.$box.style.height = height + "px";
                this.$box.style.opacity = "1";
            }
        }
        return this;
    }
}

type PropKeys<K = keyof TeleBox> = K extends keyof TeleBox
    ? TeleBox[K] extends Function
        ? never
        : K
    : never;

export type ReadonlyTeleBox = Pick<TeleBox, PropKeys>;
