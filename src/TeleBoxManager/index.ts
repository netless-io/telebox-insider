import EventEmitter from "eventemitter3";
import shallowequal from "shallowequal";
import type {
    NotMinimizedBoxState,
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
import { MaxTitleBar, MaxTitleBarTeleBox } from "./MaxTitleBar";
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
import { AppMenu } from "../AppMenu";

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
    static readonly kind = "TeleBoxManager";
    protected boxesStatus$: Map<string, TeleBoxState>;
    protected lastNotMinimizedBoxesStatus$: Map<string, NotMinimizedBoxState>;
    protected appMenu: AppMenu | undefined;
    protected useBoxesStatus: boolean;
    protected effectBoxesStatusTimer?: {
        skipUpdate: boolean;
        timer: number | undefined;
        resolve?: (skipUpdate: boolean) => void;
    }
    protected effectLastNotMinimizedBoxStatusTimer?: {
        skipUpdate: boolean;
        timer: number | undefined;
        resolve?: (skipUpdate: boolean) => void;
    }

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
        useBoxesStatus = false,
    }: TeleBoxManagerConfig = {}) {
        this._sideEffect = new SideEffectManager();
        this.useBoxesStatus = useBoxesStatus;
        const { combine, createVal } = createSideEffectBinder(this._sideEffect);

        this.root = root;
        this.namespace = namespace;

        this.boxes$ = createVal<TeleBox[]>([]);
        this.topBox$ = this.boxes$.derive((boxes) => {
            if (boxes.length > 0) {
                let currentTopBox: TeleBox | undefined = undefined;
                const topBox = boxes.reduce((topBox, box) => {
                    if (box.forceTop) {
                        return topBox;
                    }
                    if (box.boxStatus && box.boxStatus === TELE_BOX_STATE.Minimized) {
                        return topBox;
                    }
                    if (!topBox) {
                        topBox = box;
                        return topBox;
                    }
                    return topBox.zIndex > box.zIndex ? topBox : box;
                }, currentTopBox as (TeleBox | undefined));
                return topBox;
            }
            return;
        });
        this.boxesStatus$ = new Map<string, TeleBoxState>();
        this.lastNotMinimizedBoxesStatus$ = new Map<string, NotMinimizedBoxState>();
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
                          namespace
                      }).mount(root)
        );
        collector$.subscribe((collector) => {
            if (collector) {
                collector.setVisible(minimized$.value);
                collector.setReadonly(readonly$.value);
                collector.setDarkMode(this._darkMode$.value);
                if (this.useBoxesStatus && this.appMenu) {
                    this.appMenu.setContainer(collector.$appMenuContainer);
                }
                this._sideEffect.add(() => {
                    collector.getBoxesStatus = () => {
                        return this.boxesStatus$;
                    };
                    collector.onClick = () => {
                        if (!readonly$.value) {
                            if (!this.useBoxesStatus) {
                                minimized$.setValue(false);
                            } else if (this.useBoxesStatus && this.appMenu) {
                                this.appMenu.containerClickHandler();
                            }
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

        this._calcCollectorRect = (): TeleBoxRect | undefined => {
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

        this._setCollectorRect = (collectorRect: TeleBoxRect | undefined) => {
            if (collector$.value?.$collector) {
                collectorRect$.setValue(collectorRect);
            } else if (import.meta.env.DEV) {
                console.warn("No collector for minimized boxes.");
            }
        };

        const collectorRect$ = createVal(
            minimized$.value ? this._calcCollectorRect() : void 0
        );
        collectorRect$.subscribe((collectorRect, _, skipUpdate) => {
            this.boxes.forEach((box) => {
                box.setCollectorRect(collectorRect, skipUpdate);
            });
        });

        minimized$.subscribe((minimized, _, skipUpdate) => {
            collector$.value?.setVisible(minimized);

            if (minimized) {
                this._setCollectorRect(this._calcCollectorRect());
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
                        if (!this.useBoxesStatus) {
                            this.makeBoxTop(box);
                        } else {
                            if (box.boxStatus && box.boxStatus === TELE_BOX_STATE.Normal) {
                                const maxNormalBoxZIndex = this.getMaxNormalBoxZIndex();
                                if (maxNormalBoxZIndex > box.zIndex) {
                                    this.setBox(box, {
                                        zIndex: maxNormalBoxZIndex + 1
                                    }, false);
                                }
                            } else if(box.boxStatus && box.boxStatus === TELE_BOX_STATE.Maximized){
                                const maxMaximizedBoxZIndex = this.getMaxMaximizedBoxZIndex();
                                if (maxMaximizedBoxZIndex > box.zIndex) {
                                    this.setBox(box, {
                                        zIndex: maxMaximizedBoxZIndex + 1
                                    }, false);
                                }
                                this.makeMaximizedTopBoxFocus();
                            }
                        } 
                        this.focusBox(box);
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
            getBoxesStatus: () => {
                return this.boxesStatus$;
            },
            onEvent: (event): void => {
                switch (event.type) {
                    case TELE_BOX_DELEGATE_EVENT.Maximize: {
                        if (this.hasBoxesStatus()) {
                            let targetBox = this.maxTitleBar.focusedBox;
                            if (!targetBox) {
                               targetBox = this.getMaximizedTopBox();
                            }
                            if (targetBox?.id) {
                                const box = this.getBox(targetBox.id);
                                if (box) {
                                    this.setBox(box, {
                                        status: TELE_BOX_STATE.Normal,
                                        zIndex: this.getMaxNormalBoxZIndex() + 1
                                    }, false, ()=>{
                                        this.makeMaximizedTopBoxFocus();
                                    });
                                }
                            }
                        } else {
                            maximized$.setValue(!maximized$.value);
                        }
                        break;
                    }
                    case TELE_BOX_DELEGATE_EVENT.Minimize: {
                        if (this.hasBoxesStatus()) {
                            let targetBox = this.maxTitleBar.focusedBox;
                            if (!targetBox) {
                               targetBox = this.getMaximizedTopBox();
                            }
                            if(targetBox?.id){
                                const box = this.getBox(targetBox.id);
                                if (box) {
                                    let isFocusChanged = false;
                                    if (box.focus) {
                                        this.blurBox(box);
                                        isFocusChanged = true;
                                    }
                                    this.setBox(box, {
                                        status: TELE_BOX_STATE.Minimized,
                                        zIndex: -1
                                    }, false);
                                    if (isFocusChanged) {
                                        this.focusTopBox();
                                    } else {
                                        this.makeMaximizedTopBoxFocus();
                                    }
                                }
                            }
                        } else {
                            minimized$.setValue(true);
                        }
                        break;
                    }
                    case TELE_BOX_EVENT.Close: {
                        if (this.hasBoxesStatus()) {
                            let targetBox = this.maxTitleBar.focusedBox;
                            if (!targetBox) {
                               targetBox = this.getMaximizedTopBox();
                            }
                            if (targetBox?.id) {
                                const box = this.getBox(targetBox.id);
                                if (box) {
                                    let isFocusChanged = false;
                                    if (box.focus) {
                                        this.blurBox(box);
                                        isFocusChanged = true;
                                    }
                                    this.remove(box, false);
                                    if (isFocusChanged) {
                                        this.focusTopBox();
                                    } else {
                                        this.makeMaximizedTopBoxFocus();
                                    }
                                }
                            }
                        } else {
                            this.removeTopBox();
                            this.focusTopBox();
                        }
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

        if (useBoxesStatus) {
            this.appMenu = this.createMinimizedAppMenu();
        }
    }

    public get boxes(): ReadonlyArray<TeleBox> {
        return this.boxes$.value;
    }

    public get topBox(): TeleBox | undefined {
        return this.topBox$.value;
    }

    public get forceTopBoxes(): TeleBox | undefined {
        return this.boxes.find((box) => box.forceTop);
    }

    public get maxForceTopBox(): TeleBox | undefined {
        return this.boxes.reduce<TeleBox | undefined>((maxTopBox, box) => {
            if (box.forceTop && box.zIndex > (maxTopBox?.zIndex ?? 0)) {
                return box;
            }
            return maxTopBox;
        }, undefined);
    }

    public get forceNormalBoxes(): TeleBox | undefined {
        return this.boxes.find((box) => box.forceNormal);
    }

    public readonly events = new EventEmitter() as TeleBoxManagerEvents;

    protected _sideEffect: SideEffectManager;

    protected root: HTMLElement;

    public readonly namespace: string;

    public _darkMode$: Val<boolean, boolean>;

    public _calcCollectorRect: () => TeleBoxRect | undefined;

    public _setCollectorRect: (collectorRect: TeleBoxRect | undefined) => void;

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

    public setBoxStatus(boxId: string, boxStatus?: TeleBoxState, skipUpdate = false): void {
        if (boxStatus) {
            const oldBoxStatus = this.boxesStatus$.get(boxId);
            this.boxesStatus$.set(boxId, boxStatus);
            if (boxStatus === TELE_BOX_STATE.Minimized && oldBoxStatus !== TELE_BOX_STATE.Minimized) {
                this.setLastNotMinimizedBoxStatus(boxId, oldBoxStatus, skipUpdate);
            } else if (oldBoxStatus === TELE_BOX_STATE.Minimized && boxStatus !== TELE_BOX_STATE.Minimized) {
                this.setLastNotMinimizedBoxStatus(boxId, undefined, skipUpdate);
            }
        } else {
            this.boxesStatus$.delete(boxId);
            this.setLastNotMinimizedBoxStatus(boxId, undefined, skipUpdate);
        }
        if (!skipUpdate) {
            this.events.emit(TELE_BOX_MANAGER_EVENT.BoxStatus, { id: boxId, boxStatus});
        }
    }

    public getBoxStatus(boxId: string): TeleBoxState | undefined {
        return this.boxesStatus$.get(boxId);
    }

    public get boxesStatus(): ReadonlyMap<string, TeleBoxState> {
        return this.boxesStatus$;
    }

    public get lastNotMinimizedBoxesStatus(): ReadonlyMap<string, NotMinimizedBoxState> {
        return this.lastNotMinimizedBoxesStatus$;
    }

    public setBoxesStatus(boxesStatus: Map<string, TeleBoxState>, skipUpdate = false) {
        this.boxesStatus$ = boxesStatus;
        this.effectBoxesStatusChange(skipUpdate);
    }

    public getBoxesStatus(): Map<string, TeleBoxState> {
        return this.boxesStatus$;
    }

    protected effectBoxStatusChange(){
        if (!this.useBoxesStatus) {
            return;
        }
        if(this.collector){
            this.collector.updateBoxesStatus();
            if(this.hasMinimizedBox()){
                this._setCollectorRect(this._calcCollectorRect());
            }
        }
        if (this.appMenu) {
            this.appMenu.appMenuChange();
        }
        if (this.maxTitleBar) {
            this.maxTitleBar.updateBoxesStatus();
        }
    }

    protected effectBoxesStatusTimerFunc(skipUpdate: boolean){
        if (!this.useBoxesStatus) {
            return;
        }
        let newTopBox:TeleBox | undefined;
        const curTopBox = this.topBox;
        this.boxes.forEach((box) => {
            const boxStatus = this.boxesStatus$.get(box.id);
            if (boxStatus) {
                if (boxStatus !== TELE_BOX_STATE.Minimized && !this.isForceTop(box) && box.zIndex > (newTopBox?.zIndex ?? 0)) {
                    newTopBox = box;
                }
                box.setBoxStatus(boxStatus, skipUpdate);
            }
        });
        this.effectBoxStatusChange();
        if (newTopBox && curTopBox !== newTopBox) {
            this.topBox$.setValue(newTopBox);
        }
        if (!newTopBox && curTopBox) {
            this.topBox$.setValue(undefined);
        }
    }

    public async effectBoxesStatusChange(skipUpdate = false): Promise<void> {
        if (!this.useBoxesStatus) {
            if (this.effectBoxesStatusTimer && this.effectBoxesStatusTimer.timer) {
                clearTimeout(this.effectBoxesStatusTimer.timer);
                if (this.effectBoxesStatusTimer.resolve) {
                    this.effectBoxesStatusTimer.resolve(!!this.effectBoxesStatusTimer?.skipUpdate);
                }
            }
            this.effectBoxesStatusTimer=undefined;
            return;
        }
        if (this.effectBoxesStatusTimer && this.effectBoxesStatusTimer.timer) {
            if (this.effectBoxesStatusTimer.skipUpdate !== skipUpdate) {
                clearTimeout(this.effectBoxesStatusTimer.timer);
                if (this.effectBoxesStatusTimer.resolve) {
                    this.effectBoxesStatusTimer.resolve(!!this.effectBoxesStatusTimer?.skipUpdate);
                }
                this.effectBoxesStatusTimer.skipUpdate = skipUpdate;
            } else {
                return;
            }
        }
        if (!this.effectBoxesStatusTimer) {
            this.effectBoxesStatusTimer = {
                skipUpdate,
                timer: undefined,
                resolve: undefined,
            } as {
                skipUpdate: boolean;
                timer: number | undefined;
            }
        }
        if (this.effectBoxesStatusTimer) {
            const _skipUpdate = await new Promise<boolean>((resolve)=>{
                this.effectBoxesStatusTimer!.resolve = resolve;
                this.effectBoxesStatusTimer!.timer = setTimeout(()=>{
                    if (this.effectBoxesStatusTimer && this.effectBoxesStatusTimer.resolve) {
                        this.effectBoxesStatusTimer.resolve(this.effectBoxesStatusTimer!.skipUpdate);
                    }
                }, 100) as unknown as number;
            })
            this.effectBoxesStatusTimerFunc(_skipUpdate)
            this.effectBoxesStatusTimer = undefined;
        }
    }
    
    public hasBoxesStatus(): boolean {
        if (!this.useBoxesStatus) {
            return false;
        }
        return this.boxesStatus$.size > 0;
    }

    public hasMinimizedBox(): boolean {
        if (!this.useBoxesStatus) {
            return false;
        }
        return this.boxes.some((box) => box.boxStatus && box.boxStatus === TELE_BOX_STATE.Minimized);
    }

    public getMinimizedBoxesStatus(): Map<string, TELE_BOX_STATE.Minimized> {
        const minimizedBoxes = new Map<string, TELE_BOX_STATE.Minimized>();
        this.boxesStatus$.forEach((boxStatus, boxId) => {
            if (boxStatus === TELE_BOX_STATE.Minimized) {
                minimizedBoxes.set(boxId, boxStatus as TELE_BOX_STATE.Minimized);
            }
        });
        return minimizedBoxes;
    }

    public getNotMinimizedBoxesStatus(): Map<string, NotMinimizedBoxState> {
        const notMinimizedBoxes = new Map<string, NotMinimizedBoxState>();
        this.boxesStatus$.forEach((boxStatus, boxId) => {
            if (boxStatus !== TELE_BOX_STATE.Minimized) {
                notMinimizedBoxes.set(boxId, boxStatus as NotMinimizedBoxState);
            }
        });
        return notMinimizedBoxes;
    }

    public getAllMaximizedBoxesStatus(): Map<string, TELE_BOX_STATE.Maximized> {
        const maximizedBoxes = new Map<string, TELE_BOX_STATE.Maximized>();
        this.boxesStatus$.forEach((boxStatus, boxId) => {
            if (boxStatus === TELE_BOX_STATE.Maximized) {
                maximizedBoxes.set(boxId, boxStatus as TELE_BOX_STATE.Maximized);
            }
        });
        return maximizedBoxes;
    }

    public getAllNormalBoxesStatus(): Map<string, TELE_BOX_STATE.Normal> {
        const normalBoxes = new Map<string, TELE_BOX_STATE.Normal>();
        this.boxesStatus$.forEach((boxStatus, boxId) => {
            if (boxStatus === TELE_BOX_STATE.Normal) {
                normalBoxes.set(boxId, boxStatus as TELE_BOX_STATE.Normal);
            }
        });
        return normalBoxes;
    }

    public getLastNotMinimizedBoxStatus(boxId: string): NotMinimizedBoxState | undefined {
        return this.lastNotMinimizedBoxesStatus$.get(boxId);
    }

    public setLastNotMinimizedBoxStatus(boxId: string, lastNotMinimizedBoxStatus?: NotMinimizedBoxState, skipUpdate = false): void {
        if (lastNotMinimizedBoxStatus) {
            this.lastNotMinimizedBoxesStatus$.set(boxId, lastNotMinimizedBoxStatus);
        } else {
            this.lastNotMinimizedBoxesStatus$.delete(boxId);
        }
        if (!skipUpdate) {
            this.events.emit(TELE_BOX_MANAGER_EVENT.LastNotMinimizedBoxStatus, { id: boxId, boxStatus:lastNotMinimizedBoxStatus});
        }
    }

    public setLastNotMinimizedBoxesStatus(lastNotMinimizedBoxesStatus: Map<string, NotMinimizedBoxState>, skipUpdate = false): void {
        this.lastNotMinimizedBoxesStatus$ = lastNotMinimizedBoxesStatus;
        this.effectLastNotMinimizedBoxStatusChange(skipUpdate);
    }

    protected async effectLastNotMinimizedBoxStatusChange(skipUpdate = false): Promise<void> {
        if (!this.useBoxesStatus) {
            if (this.effectLastNotMinimizedBoxStatusTimer && this.effectLastNotMinimizedBoxStatusTimer.timer) {
                clearTimeout(this.effectLastNotMinimizedBoxStatusTimer.timer);
                if (this.effectLastNotMinimizedBoxStatusTimer.resolve) {
                    this.effectLastNotMinimizedBoxStatusTimer.resolve(!!this.effectLastNotMinimizedBoxStatusTimer?.skipUpdate);
                }
            }
            this.effectLastNotMinimizedBoxStatusTimer=undefined;
            return;
        }
        if (this.effectLastNotMinimizedBoxStatusTimer && this.effectLastNotMinimizedBoxStatusTimer.timer) {
            clearTimeout(this.effectLastNotMinimizedBoxStatusTimer.timer);
            if (this.effectLastNotMinimizedBoxStatusTimer.skipUpdate !== skipUpdate) {
                // this.effectLastNotMinimizedBoxStatusFunc(this.effectLastNotMinimizedBoxStatusTimer.skipUpdate)
                if (this.effectLastNotMinimizedBoxStatusTimer.resolve) {
                    this.effectLastNotMinimizedBoxStatusTimer.resolve(!!this.effectLastNotMinimizedBoxStatusTimer?.skipUpdate);
                }
                this.effectLastNotMinimizedBoxStatusTimer.skipUpdate = skipUpdate;
            } else {
                return;
            }
        }
        if (!this.effectLastNotMinimizedBoxStatusTimer) {
            this.effectLastNotMinimizedBoxStatusTimer = {
                skipUpdate,
                timer: undefined,
                resolve: undefined,
            } as {
                skipUpdate: boolean;
                timer: number | undefined;
            }
        }
        if (this.effectLastNotMinimizedBoxStatusTimer) {
            const _skipUpdate = await new Promise<boolean>((resolve)=>{
                this.effectLastNotMinimizedBoxStatusTimer!.resolve = resolve;
                this.effectLastNotMinimizedBoxStatusTimer!.timer = setTimeout(()=>{
                    if (this.effectLastNotMinimizedBoxStatusTimer && this.effectLastNotMinimizedBoxStatusTimer.resolve) {
                        this.effectLastNotMinimizedBoxStatusTimer.resolve(this.effectLastNotMinimizedBoxStatusTimer!.skipUpdate);
                    }
                }, 100) as unknown as number;
            })
            this.effectLastNotMinimizedBoxStatusFunc(_skipUpdate)
            this.effectLastNotMinimizedBoxStatusTimer = undefined;
        }
    }

    protected effectLastNotMinimizedBoxStatusFunc(skipUpdate = false){
        if (!this.useBoxesStatus) {
            return;
        }
        this.boxes.forEach((box) => {
            const boxStatus = this.lastNotMinimizedBoxesStatus$.get(box.id);
            if(boxStatus){
                box.setLastNotMinimizedBoxStatus(boxStatus, skipUpdate);
            }
        });
    }

    protected getUnabledBoxesStatusZIndex(): number {
        return this.topBox ? this.topBox.zIndex : 99;
    }

    /** Maximized box zIndex range: 100-299 */
    public getMaxMaximizedBoxZIndex(): number {
        if (!this.useBoxesStatus) {
            return this.getUnabledBoxesStatusZIndex();
        }
        return this.boxes.reduce((maxZIndex, box) => {
            if (box.boxStatus && box.boxStatus === TELE_BOX_STATE.Maximized && !this.isForceTop(box)) {
                return Math.max(maxZIndex, box.zIndex);
            }
            return maxZIndex;
        }, 99);
    }

    /** normal box zIndex range: 300-499 */
    public getMaxNormalBoxZIndex(): number {
        if (!this.useBoxesStatus) {
            return this.getUnabledBoxesStatusZIndex();
        }
        return this.boxes.reduce((maxZIndex, box) => {
            if (box.boxStatus && box.boxStatus === TELE_BOX_STATE.Normal && !this.isForceTop(box)) {
                return Math.max(maxZIndex, box.zIndex);
            }
            return maxZIndex;
        }, 299);
    }

    public getMaxForceTopBoxZIndex(): number {
        if (!this.useBoxesStatus) {
            return this.getUnabledBoxesStatusZIndex();
        }
        return this.boxes.reduce((maxZIndex, box) => {
            if (box.boxStatus && this.isForceTop(box)) {
                return Math.max(maxZIndex, box.zIndex);
            }
            return maxZIndex;
        }, 699);
    }

    public isForceNormal(box: TeleBox): boolean {
        return box._forceNormal$.value;
    }

    public isForceTop(box: TeleBox): boolean {
        return box._forceTop$.value;
    }

    public create(
        config: TeleBoxManagerCreateConfig = {},
        smartPosition = true
    ): ReadonlyTeleBox {
        const box = new TeleBox({
            zIndex: config.forceTop ? this.getMaxForceTopBoxZIndex() + 1 : this.getMaxNormalBoxZIndex() + 1,
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

        this.boxes$.setValue([...this.boxes, box]);

        if (box.boxStatus && this.useBoxesStatus) {
            this.setBox(box, {
                status: box.boxStatus,
                lastNotMinimizedBoxStatus: box._lastNotMinimizedBoxStatus$.value
            }, true);
        }

        if (box.focus) {
            this.focusBox(box);
            if (smartPosition) {
                this.makeBoxTop(box);
            }
        }

        box._delegateEvents.on(TELE_BOX_DELEGATE_EVENT.Maximize, () => {
            if (this.useBoxesStatus && box.boxStatus) {
                if (box._forceNormal$.value) {
                    return;
                }
                if (box.boxStatus === TELE_BOX_STATE.Maximized) {
                    this.setBox(box.id, {
                        status: TELE_BOX_STATE.Normal,
                        zIndex: this.getMaxNormalBoxZIndex() + 1
                    }, false);
                } else {
                    // 所有normal box都最大化
                    [...this.boxes].filter((box) => box.boxStatus === TELE_BOX_STATE.Normal && !this.isForceNormal(box)).sort((a, b) => a.zIndex - b.zIndex).forEach((box) => {
                        if (box.boxStatus === TELE_BOX_STATE.Normal) {
                            this.setBox(box.id, {
                                status: TELE_BOX_STATE.Maximized,
                                zIndex: this.getMaxMaximizedBoxZIndex() + 1
                            }, false);
                        }
                    });
                    this.makeMaximizedTopBoxFocus();
                }
            } else {
                this.setMaximized(!this.maximized);
            }

        });
        box._delegateEvents.on(TELE_BOX_DELEGATE_EVENT.Minimize, () => {
            if (box.boxStatus && this.useBoxesStatus) {
                if (box._forceNormal$.value) {
                    return;
                }
                if(box.focus) {
                    this.blurBox(box);
                }
                this.setBox(box, {
                    status: TELE_BOX_STATE.Minimized,
                    zIndex: -1
                }, false, ()=>{
                    this.focusTopBox();
                });

            } else{
                this.setMinimized(true);
            }
        });
        box._delegateEvents.on(TELE_BOX_DELEGATE_EVENT.Close, () => {
            if (this.useBoxesStatus && box.focus) {
                this.blurBox(box);
            }
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
                let currentTopBox: TeleBox | undefined = undefined;
                const topBox = this.boxes.reduce((topBox, box) => {
                    if (this.isForceTop(box)) {
                        return topBox;
                    }
                    if (box.boxStatus && box.boxStatus === TELE_BOX_STATE.Minimized) {
                        return topBox;
                    }
                    if (!topBox) {
                        topBox = box;
                        return topBox;
                    }
                    return topBox.zIndex > box.zIndex ? topBox : box;
                }, currentTopBox as (TeleBox | undefined));
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

    public setBox(boxOrID: string | TeleBox, options: {
        status?: TeleBoxState;
        lastNotMinimizedBoxStatus?: NotMinimizedBoxState;
        zIndex?: number;
    }, skipUpdate = false, effectFunc?: () => void){
        const box = this.getBox(boxOrID)
        if (box) {
            const {status, zIndex, lastNotMinimizedBoxStatus} = options;
            if (status) {
                this.setBoxStatus(box.id, status, skipUpdate);
                box.setBoxStatus(status, skipUpdate);
                this.effectBoxStatusChange();
            }
            if (zIndex) {
                box.setZIndex(zIndex, skipUpdate);
            }
            if (lastNotMinimizedBoxStatus) {
                this.setLastNotMinimizedBoxStatus(box.id, lastNotMinimizedBoxStatus, skipUpdate);
                box.setLastNotMinimizedBoxStatus(lastNotMinimizedBoxStatus, skipUpdate);
            }
            effectFunc && effectFunc();
        }
    }

    public remove(
        boxOrID: string | TeleBox,
        skipUpdate = false,
        effectFunc?: () => void
    ): ReadonlyTeleBox | undefined {
        const box = this.getBox(boxOrID);
        const index = this.getBoxIndex(boxOrID);
        if (index >= 0) {
            const boxes = this.boxes.slice();
            const deletedBoxes = boxes.splice(index, 1);
            this.boxes$.setValue(boxes);
            deletedBoxes.forEach((box) => box.destroy());
            if (box && this.useBoxesStatus) {
                this.setBoxStatus(box.id, undefined, skipUpdate);
                this.setLastNotMinimizedBoxStatus(box.id, undefined, skipUpdate);
                this.effectBoxStatusChange();
                effectFunc && effectFunc();
            }
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
        this.boxesStatus$.clear();
        this.lastNotMinimizedBoxesStatus$.clear();
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
            if (!this.useBoxesStatus) {
                this.maxTitleBar.focusBox(targetBox);
            } else if (this.useBoxesStatus && this.maxTitleBar.hasMaximizedBoxInStatus()) {
                this.makeMaximizedTopBoxFocus();
            }
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
    // protected maximizedTopBox$: Val<MaxTitleBarTeleBox | undefined>;

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
        if (this.useBoxesStatus && (config.boxStatus || config.lastNotMinimizedBoxStatus)) {
            this.setBox(box, {
                status: config.boxStatus,
                lastNotMinimizedBoxStatus: config.lastNotMinimizedBoxStatus
            }, skipUpdate);
        }
        if (config.forceTop != null) {
            box.setForceTop(config.forceTop, skipUpdate);
        }
        if (config.forceNormal != null) {
            box.setForceNormal(config.forceNormal, skipUpdate);
        }
    }

    protected smartPosition(config: TeleBoxConfig = {}): TeleBoxConfig {
        let { x, y } = config;
        const { width = 0.5, height = 0.5 } = config;

        if (x == null) {
            let vx = 20;
            if (config.forceTop) {
                const forceTopBox = this.maxForceTopBox || this.topBox;
                if (forceTopBox) {
                    vx = forceTopBox.intrinsicX * this.containerRect.width + 20;
                    if (
                        vx >
                        this.containerRect.width - width * this.containerRect.width
                    ) {
                        vx = 20;
                    }
                }
            } else if (this.topBox) {
                vx = this.topBox.intrinsicX * this.containerRect.width + 20;
                if (
                    vx >
                    this.containerRect.width - width * this.containerRect.width
                ) {
                    vx = 20;
                }
            } else if (this.hasMinimizedBox()) {
                // 如果都最小化，则获取lastNotMinimizedBoxesStatus中normal box的最大x
                vx = [...this.boxes].filter((box) => box.boxStatus && box.boxStatus === TELE_BOX_STATE.Minimized && box.lastNotMinimizedBoxStatus && box.lastNotMinimizedBoxStatus === TELE_BOX_STATE.Normal).reduce((maxX, box) => {
                    return Math.max(maxX, box.intrinsicX * this.containerRect.width + 20);
                }, vx);
            }
            x = vx / this.containerRect.width;
        }

        if (y == null) {
            let vy = 20;
            if (config.forceTop) {
                const forceTopBox = this.maxForceTopBox || this.topBox;
                if (forceTopBox) {
                    vy = forceTopBox.intrinsicY * this.containerRect.height + 20;

                    if (
                        vy >
                        this.containerRect.height -
                            height * this.containerRect.height
                    ) {
                        vy = 20;
                    }
                }
            } else if (this.topBox) {
                vy = this.topBox.intrinsicY * this.containerRect.height + 20;

                if (
                    vy >
                    this.containerRect.height -
                        height * this.containerRect.height
                ) {
                    vy = 20;
                }
            } else if (this.hasMinimizedBox()) {
                // 如果都最小化，则获取lastNotMinimizedBoxesStatus中normal box的最大y
                vy = [...this.boxes].filter((box) => box.boxStatus && box.boxStatus === TELE_BOX_STATE.Minimized && box.lastNotMinimizedBoxStatus && box.lastNotMinimizedBoxStatus === TELE_BOX_STATE.Normal).reduce((maxY, box) => {
                    return Math.max(maxY, box.intrinsicY * this.containerRect.height + 20);
                }, vy);
            }

            y = vy / this.containerRect.height;
        }

        return { ...config, x, y, width, height };
    }

    protected makeBoxTop(box: TeleBox, skipUpdate = false): void {
        if (!this.useBoxesStatus && this.topBox) {
            if (box !== this.topBox) {
                box.setZIndex(this.topBox.zIndex + 1, skipUpdate);
            }
        } else if (this.useBoxesStatus) {
            // todo
        }
    }

    protected getMaximizedTopBox(): MaxTitleBarTeleBox | undefined {
        if (!this.useBoxesStatus) {
            return undefined;
        }
        let maximizedBox: MaxTitleBarTeleBox | undefined;
        if (this.maxTitleBar.hasMaximizedBoxInStatus()) {
            maximizedBox = this.maxTitleBar.MaximizedBoxes.reduce((topBox, currentBox) => {
                if (!topBox) {
                    return currentBox;
                }
                return topBox.zIndex > currentBox.zIndex ? topBox : currentBox;
            }, );
        }
        return maximizedBox;
    }

    protected makeMaximizedTopBoxFocus(): void {
        if (!this.useBoxesStatus) {
            return;
        }
        const maximizedBox: MaxTitleBarTeleBox | undefined = this.getMaximizedTopBox();
        this.maxTitleBar.focusBox(maximizedBox);
    }

    protected getBoxIndex(boxOrID: TeleBox | string): number {
        return typeof boxOrID === "string"
            ? this.boxes.findIndex((box) => box.id === boxOrID)
            : this.boxes.findIndex((box) => box === boxOrID);
    }

    public getBox(boxOrID: TeleBox | string): TeleBox | undefined {
        return typeof boxOrID === "string"
            ? this.boxes.find((box) => box.id === boxOrID)
            : boxOrID;
    }

    public createMinimizedAppMenu():AppMenu | undefined {
        if (this.collector?.$appMenuContainer) {
            return new AppMenu({
                manager: this,
                container: this.collector?.$appMenuContainer,
                theme: this.prefersColorScheme ? 'dark' : 'light',
                getBoxesStatus: () => {
                    return this.boxesStatus$;
                }
            });
        }
        return;
    }
}
