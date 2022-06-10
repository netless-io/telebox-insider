import "./style.scss";
import collectorSVG from "./icons/collector.svg";
import type { TeleStyles } from "../typings";
import type {
    ReadonlyVal,
    ReadonlyValEnhancedResult,
    ValEnhancedResult,
} from "value-enhancer";
import { derive } from "value-enhancer";
import {
    withValueEnhancer,
    combine,
    Val,
    withReadonlyValueEnhancer,
    ValManager,
} from "value-enhancer";
import { SideEffectManager } from "side-effect-manager";
import type { TeleBoxRect } from "../TeleBox/typings";

export interface TeleBoxCollectorConfig {
    namespace?: string;
    styles?: TeleStyles;
    root$: ReadonlyVal<HTMLElement | null>;
    minimized$: Val<boolean>;
    readonly$: ReadonlyVal<boolean>;
    darkMode$: ReadonlyVal<boolean>;
    rootRect$: ReadonlyVal<TeleBoxRect>;
}

type ValConfig = {
    styles: Val<TeleStyles>;
    $collector: Val<HTMLElement>;
};

type PropsValConfig = {
    root: TeleBoxCollectorConfig["root$"];
};

type MyReadonlyValConfig = {
    rect: ReadonlyVal<TeleBoxRect | undefined>;
    visible: ReadonlyVal<boolean>;
};

type CombinedValEnhancedResult = ValEnhancedResult<ValConfig> &
    ReadonlyValEnhancedResult<PropsValConfig & MyReadonlyValConfig>;

export interface TeleBoxCollector extends CombinedValEnhancedResult {}

export class TeleBoxCollector {
    public constructor({
        minimized$,
        readonly$,
        darkMode$,
        rootRect$,
        namespace = "telebox",
        styles = {},
        root$,
    }: TeleBoxCollectorConfig) {
        this.namespace = namespace;

        const valManager = new ValManager();
        this._sideEffect.addDisposer(() => valManager.destroy());

        const rect$ = new Val<TeleBoxRect | undefined>(void 0);
        const visible$ = derive(minimized$);
        const styles$ = new Val(styles);
        const el$ = new Val<HTMLElement>(document.createElement("button"));

        const valConfig: ValConfig = {
            styles: styles$,
            $collector: el$,
        };

        withValueEnhancer(this, valConfig, valManager);

        const propsValConfig: PropsValConfig = {
            root: root$,
        };

        withReadonlyValueEnhancer(this, propsValConfig);

        const myReadonlyValConfig: MyReadonlyValConfig = {
            rect: rect$,
            visible: visible$,
        };

        withReadonlyValueEnhancer(this, myReadonlyValConfig, valManager);

        el$.value.className = this.wrapClassName("collector");
        el$.value.style.backgroundImage = `url('${collectorSVG}')`;

        this._sideEffect.addDisposer(
            el$.subscribe(($collector) => {
                this._sideEffect.addEventListener(
                    $collector,
                    "click",
                    () => {
                        if (!readonly$.value) {
                            minimized$.setValue(false);
                        }
                    },
                    {},
                    "telebox-collector-click"
                );

                this._sideEffect.addDisposer(
                    [
                        visible$.subscribe((visible) => {
                            $collector.classList.toggle(
                                this.wrapClassName("collector-visible"),
                                visible
                            );
                        }),
                        readonly$.subscribe((readonly) => {
                            $collector.classList.toggle(
                                this.wrapClassName("collector-readonly"),
                                readonly
                            );
                        }),
                        darkMode$.subscribe((darkMode) => {
                            $collector.classList.toggle(
                                this.wrapClassName("color-scheme-dark"),
                                darkMode
                            );
                            $collector.classList.toggle(
                                this.wrapClassName("color-scheme-light"),
                                !darkMode
                            );
                        }),
                        styles$.subscribe((styles) => {
                            Object.keys(styles).forEach((key) => {
                                const value = styles[
                                    key as keyof TeleStyles
                                ] as string;
                                if (value != null) {
                                    $collector.style[key as keyof TeleStyles] =
                                        value;
                                }
                            });
                        }),
                        root$.subscribe((root) => {
                            if (root) {
                                root.appendChild($collector);
                            }
                        }),
                        // Place after $collector appended to the DOM so that rect calc works
                        combine([minimized$, rootRect$, root$]).subscribe(
                            ([minimized, rootRect, root]) => {
                                if (minimized && root) {
                                    const { x, y, width, height } =
                                        $collector.getBoundingClientRect();
                                    rect$.setValue({
                                        x: x - rootRect.x,
                                        y: y - rootRect.y,
                                        width,
                                        height,
                                    });
                                }
                            }
                        ),
                    ],
                    "telebox-collector-el"
                );
            })
        );
    }

    public readonly namespace: string;

    protected readonly _sideEffect = new SideEffectManager();

    public destroy(): void {
        this._sideEffect.flushAll();
    }

    public wrapClassName(className: string): string {
        return `${this.namespace}-${className}`;
    }
}
