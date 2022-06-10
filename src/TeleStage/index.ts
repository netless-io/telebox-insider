import "./style.scss";

import shallowequal from "shallowequal";
import { SideEffectManager } from "side-effect-manager";
import type { ReadonlyVal } from "value-enhancer";
import { Val } from "value-enhancer";
import { combine } from "value-enhancer";
import type { TeleBoxRect } from "../TeleBox/typings";

export interface TeleStageConfig {
    namespace: string;
    root?: HTMLElement | null;
    rootRect$: ReadonlyVal<TeleBoxRect>;
    ratio$: ReadonlyVal<number>;
    highlightStage$: ReadonlyVal<boolean>;
}

export class TeleStage {
    private readonly _sideEffect = new SideEffectManager();

    public readonly namespace: string;
    public readonly stageRect$: ReadonlyVal<TeleBoxRect>;
    public readonly highlightStage$: ReadonlyVal<boolean>;
    public readonly root$: Val<HTMLElement | null>;

    public $boxStage?: HTMLDivElement;

    constructor({
        namespace,
        rootRect$,
        ratio$,
        highlightStage$,
        root = null,
    }: TeleStageConfig) {
        this.namespace = namespace;
        this.highlightStage$ = highlightStage$;
        this.root$ = new Val<HTMLElement | null>(root);

        this.stageRect$ = combine(
            [rootRect$, highlightStage$, ratio$],
            ([rootRect, highlightStage, ratio]) => {
                if (!highlightStage) {
                    return rootRect;
                }

                if (ratio <= 0 || rootRect.width <= 0 || rootRect.height <= 0) {
                    return rootRect;
                }

                const preferredHeight = rootRect.width * ratio;
                if (preferredHeight === rootRect.height) {
                    return rootRect;
                }

                if (preferredHeight < rootRect.height) {
                    return {
                        x: 0,
                        y: (rootRect.height - preferredHeight) / 2,
                        width: rootRect.width,
                        height: preferredHeight,
                    };
                }

                const preferredWidth = rootRect.height / ratio;
                return {
                    x: (rootRect.width - preferredWidth) / 2,
                    y: 0,
                    width: preferredWidth,
                    height: rootRect.height,
                };
            },
            { compare: shallowequal }
        );

        this._sideEffect.addDisposer(
            combine([this.root$, highlightStage$]).subscribe(
                ([root, highlightStage]) => {
                    if (root && highlightStage) {
                        root.appendChild(this.render());
                    } else if (this.$boxStage?.parentNode) {
                        this.$boxStage.remove();
                    }
                }
            )
        );
    }

    private render(): HTMLDivElement {
        if (this.$boxStage) {
            return this.$boxStage;
        }

        const $boxStage = document.createElement("div");
        $boxStage.className = this.wrapClassName("box-stage-container");
        const $boxStageMask1 = document.createElement("div");
        $boxStageMask1.className = this.wrapClassName("box-stage-mask");
        const $boxStageMask2 = document.createElement("div");
        $boxStageMask2.className = this.wrapClassName("box-stage-mask");
        const $boxStageFrame = document.createElement("div");
        $boxStageFrame.className = this.wrapClassName("box-stage-frame");

        const [
            $topLeftCorner,
            $topRightCorner,
            $bottomLeftCorner,
            $bottomRightCorner,
        ] = [
            "M0 8V0h8v2H2v6H0Z",
            "M8 8V0H0v2h6v6h2Z",
            "M0 0v8h8V6H2V0H0Z",
            "M8 0v8H0V6h6V0h2Z",
        ].map((path, i) => {
            const $svg = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "svg"
            );
            $svg.setAttribute("viewBox", "0 0 8 8");
            $svg.setAttribute(
                "class",
                `${this.wrapClassName("box-stage-frame-corner")} is-${i}`
            );
            const $path = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "path"
            );
            $path.setAttribute("d", path);
            $path.setAttribute("fill", "#3381FF");
            $svg.appendChild($path);
            return $svg;
        });

        $boxStageFrame.appendChild($topLeftCorner);
        $boxStageFrame.appendChild($bottomLeftCorner);
        $boxStageFrame.appendChild($topRightCorner);
        $boxStageFrame.appendChild($bottomRightCorner);

        $boxStage.appendChild($boxStageMask1);
        $boxStage.appendChild($boxStageFrame);
        $boxStage.appendChild($boxStageMask2);

        this._sideEffect.addDisposer(
            this.highlightStage$.subscribe((highlightStage) => {
                $boxStage.classList.toggle("is-active", highlightStage);
            })
        );

        this._sideEffect.addDisposer(
            combine([this.highlightStage$, this.stageRect$]).subscribe(
                ([highlightStage, stageRect]) => {
                    if (!highlightStage) {
                        return;
                    }
                    if (stageRect.x > 0) {
                        $boxStage.style.flexDirection = "row";
                        $boxStageMask1.style.width = `${stageRect.x}px`;
                        $boxStageMask1.style.height = "";
                        $boxStageMask2.style.width = `${stageRect.x}px`;
                        $boxStageMask2.style.height = "";
                    } else if (stageRect.y > 0) {
                        $boxStage.style.flexDirection = "column";
                        $boxStageMask1.style.width = "";
                        $boxStageMask1.style.height = `${stageRect.y}px`;
                        $boxStageMask2.style.width = "";
                        $boxStageMask2.style.height = `${stageRect.y}px`;
                    }
                }
            )
        );

        this.$boxStage = $boxStage;
        return $boxStage;
    }

    public mount($root: HTMLElement): void {
        this.root$.setValue($root);
    }

    public unmount(): void {
        this.root$.setValue(null);
    }

    public destroy(): void {
        this._sideEffect.flushAll();
    }

    public wrapClassName(className: string): string {
        return `${this.namespace}-${className}`;
    }
}
