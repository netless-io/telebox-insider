import "./style.scss";
import collectorSVG from "./icons/collector.svg";
import { TeleStyles } from "../typings";

export interface TeleBoxCollectorConfig {
    visible?: boolean;
    readonly?: boolean;
    darkMode?: boolean;
    namespace?: string;
    styles?: TeleStyles;
    onClick?: () => void;
}

export class TeleBoxCollector {
    public constructor({
        visible = true,
        readonly = false,
        darkMode = false,
        namespace = "telebox",
        styles = {},
        onClick,
    }: TeleBoxCollectorConfig = {}) {
        this._visible = visible;
        this._readonly = readonly;
        this._darkMode = darkMode;
        this.namespace = namespace;
        this.styles = styles;
        this.onClick = onClick;
    }

    public readonly styles: TeleStyles;

    public readonly namespace: string;

    public get visible(): boolean {
        return this._visible;
    }

    public get readonly(): boolean {
        return this._readonly;
    }

    public get darkMode(): boolean {
        return this._darkMode;
    }

    public onClick: (() => void) | undefined;

    public $collector: HTMLElement | undefined;

    /**
     * Mount collector to a root element.
     */
    public mount(root: HTMLElement): this {
        root.appendChild(this.render());
        return this;
    }

    /**
     * Unmount collector from the root element.
     */
    public unmount(): this {
        if (this.$collector) {
            this.$collector.remove();
        }
        return this;
    }

    public setVisible(visible: boolean): this {
        if (this._visible !== visible) {
            this._visible = visible;
            if (this.$collector) {
                this.$collector.classList.toggle(
                    this.wrapClassName("collector-visible"),
                    visible
                );
            }
        }
        return this;
    }

    public setReadonly(readonly: boolean): this {
        if (this._readonly !== readonly) {
            this._readonly = readonly;
            if (this.$collector) {
                this.$collector.classList.toggle(
                    this.wrapClassName("collector-readonly"),
                    readonly
                );
            }
        }
        return this;
    }

    public setDarkMode(darkMode: boolean): this {
        if (this._darkMode !== darkMode) {
            this._darkMode = darkMode;
            if (this.$collector) {
                this.$collector.classList.toggle(
                    this.wrapClassName("color-scheme-dark"),
                    darkMode
                );
                this.$collector.classList.toggle(
                    this.wrapClassName("color-scheme-light"),
                    !darkMode
                );
            }
        }
        return this;
    }

    public setStyles(styles: TeleStyles): this {
        Object.assign(this.styles, styles);
        if (this.$collector) {
            const $collector = this.$collector;
            Object.keys(styles).forEach((key) => {
                const value = styles[key as keyof TeleStyles] as string;
                if (value != null) {
                    $collector.style[key as keyof TeleStyles] = value;
                }
            });
        }
        return this;
    }

    public render(): HTMLElement {
        if (!this.$collector) {
            this.$collector = document.createElement("button");
            this.$collector.className = this.wrapClassName("collector");
            this.$collector.style.backgroundImage = `url('${collectorSVG}')`;
            this.$collector.addEventListener(
                "click",
                this.handleCollectorClick
            );

            if (this._visible) {
                this.$collector.classList.add(
                    this.wrapClassName("collector-visible")
                );
            }

            if (this._readonly) {
                this.$collector.classList.add(
                    this.wrapClassName("collector-readonly")
                );
            }

            this.$collector.classList.add(
                this.wrapClassName(
                    this._darkMode ? "color-scheme-dark" : "color-scheme-light"
                )
            );

            this.setStyles(this.styles);
        }

        return this.$collector;
    }

    public destroy(): void {
        if (this.$collector) {
            this.$collector.removeEventListener(
                "click",
                this.handleCollectorClick
            );
            this.$collector.remove();
            this.$collector = void 0;
        }
        this.onClick = void 0;
    }

    public wrapClassName(className: string): string {
        return `${this.namespace}-${className}`;
    }

    protected _visible: boolean;

    protected _readonly: boolean;

    protected _darkMode: boolean;

    protected handleCollectorClick = (): void => {
        if (!this._readonly && this.onClick) {
            this.onClick();
        }
    };
}
