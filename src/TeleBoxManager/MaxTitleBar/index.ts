import "./style.scss";

import type { TeleBox } from "../../TeleBox";
import type { DefaultTitleBarConfig } from "../../TeleTitleBar";
import { DefaultTitleBar } from "../../TeleTitleBar";
import { TELE_BOX_STATE } from "../../TeleBox/constants";
import type { TeleBoxRect } from "../../TeleBox/typings";
import type { ReadonlyVal } from "value-enhancer";
import { combine } from "value-enhancer";

export type MaxTitleBarTitle = Pick<TeleBox, "id" | "title">;

export interface MaxTitleBarConfig extends DefaultTitleBarConfig {
    darkMode$: ReadonlyVal<boolean>;
    boxes$: ReadonlyVal<TeleBox[]>;
    rootRect$: ReadonlyVal<TeleBoxRect>;
    root$: ReadonlyVal<HTMLElement | null>;
}

export class MaxTitleBar extends DefaultTitleBar {
    public constructor(config: MaxTitleBarConfig) {
        super(config);

        this.boxes$ = config.boxes$;
        this.rootRect$ = config.rootRect$;
        this.darkMode$ = config.darkMode$;

        this.sideEffect.addDisposer(
            config.root$.subscribe((root) => {
                if (root) {
                    root.appendChild(this.render());
                } else if (this.$titleBar?.parentNode) {
                    this.$titleBar.remove();
                }
            })
        );
    }

    public focusBox(box?: TeleBox): void {
        if (this.focusedBox && this.focusedBox === box) {
            return;
        }

        if (this.$titles && this.state$.value === TELE_BOX_STATE.Maximized) {
            const { children } = this.$titles.firstElementChild as HTMLElement;
            for (let i = children.length - 1; i >= 0; i -= 1) {
                const $tab = children[i] as HTMLElement;
                const id = $tab.dataset?.teleBoxID;
                if (id) {
                    if (box && id === box.id) {
                        $tab.classList.toggle(
                            this.wrapClassName("titles-tab-focus"),
                            true
                        );
                    } else if (this.focusedBox && id === this.focusedBox.id) {
                        $tab.classList.toggle(
                            this.wrapClassName("titles-tab-focus"),
                            false
                        );
                    }
                }
            }
        }
        this.focusedBox = box;
    }

    public render(): HTMLElement {
        if (this.$titleBar) {
            return this.$titleBar;
        }

        const $titleBar = super.render();

        $titleBar.classList.add(this.wrapClassName("max-titlebar"));

        this.sideEffect.addDisposer(
            [
                this.state$.subscribe((state) => {
                    $titleBar.classList.toggle(
                        this.wrapClassName("max-titlebar-maximized"),
                        state === TELE_BOX_STATE.Maximized
                    );
                }),
                this.readonly$.subscribe((readonly) => {
                    $titleBar.classList.toggle(
                        this.wrapClassName("readonly"),
                        readonly
                    );
                }),
                this.darkMode$.subscribe((darkMode) => {
                    $titleBar.classList.toggle(
                        this.wrapClassName("color-scheme-dark"),
                        darkMode
                    );
                    $titleBar.classList.toggle(
                        this.wrapClassName("color-scheme-light"),
                        !darkMode
                    );
                }),
                combine([this.state$, this.boxes$]).subscribe(
                    ([state, titles]) => {
                        if (state === TELE_BOX_STATE.Maximized) {
                            $titleBar.classList.toggle(
                                this.wrapClassName("max-titlebar-single-title"),
                                titles.length === 1
                            );
                            if (titles.length !== 1) {
                                $titleBar.replaceChild(
                                    this.renderTitles(),
                                    $titleBar.firstElementChild as HTMLElement
                                );
                            }
                        }
                    }
                ),
            ],
            "max-render"
        );

        const $titlesArea = document.createElement("div");
        $titlesArea.classList.add(this.wrapClassName("titles-area"));
        $titleBar.insertBefore($titlesArea, $titleBar.firstElementChild);

        return $titleBar;
    }

    public destroy(): void {
        super.destroy();
        this.$titles = void 0;
        this.focusedBox = void 0;
    }

    protected renderTitles(): HTMLElement {
        this.$titles = document.createElement("div");
        this.$titles.className = this.wrapClassName("titles");

        this.sideEffect.addEventListener(
            this.$titles,
            "wheel",
            (ev) => {
                (ev.currentTarget as HTMLElement).scrollBy({
                    left: ev.deltaY > 0 ? 250 : -250,
                    behavior: "smooth",
                });
            },
            { passive: false },
            "max-render-wheel-titles"
        );

        const $content = document.createElement("div");
        $content.className = this.wrapClassName("titles-content");
        this.$titles.appendChild($content);

        const disposers = this.boxes$.value.map((box) => {
            const $tab = document.createElement("button");
            $tab.className = this.wrapClassName("titles-tab");
            $tab.textContent = box.title;
            $tab.dataset.teleBoxID = box.id;
            $tab.dataset.teleTitleBarNoDblClick = "true";

            if (this.focusedBox && box.id === this.focusedBox.id) {
                $tab.classList.add(this.wrapClassName("titles-tab-focus"));
            }

            $content.appendChild($tab);

            return box._title$.reaction((title) => ($tab.textContent = title));
        });

        this.sideEffect.addDisposer(
            () => disposers.forEach((disposer) => disposer()),
            "max-render-tab-titles"
        );

        return this.$titles;
    }

    public focusedBox: TeleBox | undefined;

    protected darkMode$: MaxTitleBarConfig["darkMode$"];
    protected boxes$: MaxTitleBarConfig["boxes$"];
    protected rootRect$: MaxTitleBarConfig["rootRect$"];

    protected $titles: HTMLElement | undefined;
}
