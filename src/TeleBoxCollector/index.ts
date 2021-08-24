import "./style.scss";
import collectorSVG from "./icons/collector.svg";
import { TeleStyles } from "../typings";

export interface TeleBoxCollectorConfig {
    visible?: boolean;
    namespace?: string;
    styles?: TeleStyles;
    onClick?: () => void;
}

export class TeleBoxCollector {
    public constructor({
        visible = true,
        namespace = "telebox",
        styles = {},
        onClick,
    }: TeleBoxCollectorConfig = {}) {
        this._visible = Boolean(visible);
        this.namespace = namespace;
        this.styles = styles;
        this.onClick = onClick;
    }

    public readonly styles: TeleStyles;

    public readonly namespace: string;

    public get visible(): boolean {
        return this._visible;
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
            this.$collector.addEventListener(
                "click",
                this.handleCollectorClick
            );

            if (this._visible) {
                this.$collector.classList.add(
                    this.wrapClassName("collector-visible")
                );
            }

            const $icon = document.createElement("img");
            $icon.draggable = false;
            $icon.className = this.wrapClassName("collector-icon");
            $icon.src = collectorSVG;

            this.$collector.appendChild($icon);

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

    protected handleCollectorClick = (): void => {
        if (this.onClick) {
            this.onClick();
        }
    };
}
