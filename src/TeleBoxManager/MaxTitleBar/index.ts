import "./style.scss";

import type { TeleBox } from "../../TeleBox";
import { DefaultTitleBar, DefaultTitleBarConfig } from "../../TeleTitleBar";
import { TELE_BOX_STATE } from "../../TeleBox/constants";
import { TeleBoxRect, TeleBoxState } from "../../TeleBox/typings";

export type MaxTitleBarTeleBox = Pick<TeleBox, "id" | "title" | "readonly" | "zIndex" | "$box" | "forceTop" | "forceNormal">;

export interface MaxTitleBarConfig extends DefaultTitleBarConfig {
    darkMode: boolean;
    boxes: MaxTitleBarTeleBox[];
    containerRect: TeleBoxRect;
    focusedBox?: MaxTitleBarTeleBox;
    getBoxesStatus?: () => Map<string, TeleBoxState>;
}

export class MaxTitleBar extends DefaultTitleBar {
    public getBoxesStatus?: () => Map<string, TeleBoxState>;
    public constructor(config: MaxTitleBarConfig) {
        super(config);

        this.boxes = config.boxes;
        this.focusedBox = config.focusedBox;
        this.containerRect = config.containerRect;
        this.darkMode = config.darkMode;
        this.getBoxesStatus = config.getBoxesStatus;
    }

    get boxesStatus(): Map<string, TeleBoxState> | undefined {
        return this.getBoxesStatus?.();
    }
    public hasMaximizedBoxInStatus(): boolean {
        if (this.getBoxesStatus) {
            const boxesStatus = this.getBoxesStatus();
            if (boxesStatus.size) {
                const hasMaximizedBox = [...boxesStatus.values()].find((state) => state === TELE_BOX_STATE.Maximized);
                return !!hasMaximizedBox;
            }
        }
        return false;
    }

    public get MaximizedBoxes(): MaxTitleBarTeleBox[] {
        if (this.getBoxesStatus) {
            const boxesStatus = this.getBoxesStatus();
            if (boxesStatus) {
                return this.boxes.filter((box) => boxesStatus && boxesStatus.get(box.id) === TELE_BOX_STATE.Maximized && !box.forceTop);
            }
        }
        return [];
    }

    /**
     * 设置MaxTitleBar的focusedBox
     * @param box 如果box为空，则全部失去焦点
     * @returns 
     */
    public focusBox(box?: MaxTitleBarTeleBox): void {
        if (this.focusedBox && this.focusedBox === box) {
            return;
        }
        if (this.$titles) {
            const { children } = this.$titles.firstElementChild as HTMLElement;
            if (this.state === TELE_BOX_STATE.Maximized && !this.hasMaximizedBoxInStatus()) {
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
            } else if (this.hasMaximizedBoxInStatus()) {
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
        }
        this.focusedBox = box;  
    }

    public setContainerRect(rect: TeleBoxRect): void {
        this.containerRect = rect;
        if (this.$titleBar) {
            const { x, y, width } = rect;
            this.$titleBar.style.transform = `translate(${x}px, ${y}px)`;
            this.$titleBar.style.width = width + "px";
        }
    }

    public updateBoxesStatus(): void {
        if (this.hasMaximizedBoxInStatus()) {
            this.setBoxStatus(TELE_BOX_STATE.Maximized);
        }
        if (this.$titleBar) {
            this.$titleBar.classList.toggle(
                this.wrapClassName("max-titlebar-maximized"),
                this.state === TELE_BOX_STATE.Maximized && this.boxes.length > 0 || this.hasMaximizedBoxInStatus()
            );
        }
        this.updateTitles();
    }

    public setBoxes(boxes: MaxTitleBarTeleBox[]): void {
        this.boxes = boxes;
        if (this.$titleBar) {
            this.$titleBar.classList.toggle(
                this.wrapClassName("max-titlebar-maximized"),
                this.state === TELE_BOX_STATE.Maximized && boxes.length > 0 || this.hasMaximizedBoxInStatus()
            );
        }
        this.updateTitles();
    }

    public setState(state: TeleBoxState): void {
        super.setState(state);
        if (this.$titleBar) {
            this.$titleBar.classList.toggle(
                this.wrapClassName("max-titlebar-maximized"),
                (state === TELE_BOX_STATE.Maximized && this.boxes.length > 0) || this.hasMaximizedBoxInStatus()
            );
        }
        this.updateTitles();
    }

    public setReadonly(readonly: boolean): void {
        super.setReadonly(readonly);
        if (this.$titleBar) {
            this.$titleBar.classList.toggle(
                this.wrapClassName("readonly"),
                this.readonly
            );
        }
    }

    public setDarkMode(darkMode: boolean): void {
        if (darkMode !== this.darkMode) {
            this.darkMode = darkMode;
            if (this.$titleBar) {
                this.$titleBar.classList.toggle(
                    this.wrapClassName("color-scheme-dark"),
                    darkMode
                );
                this.$titleBar.classList.toggle(
                    this.wrapClassName("color-scheme-light"),
                    !darkMode
                );
            }
        }
    }

    public render(): HTMLElement {
        const $titleBar = super.render();

        const { x, y, width } = this.containerRect;
        $titleBar.style.transform = `translate(${x}px, ${y}px)`;
        $titleBar.style.width = width + "px";

        $titleBar.classList.add(this.wrapClassName("max-titlebar"));
        $titleBar.classList.toggle(
            this.wrapClassName("max-titlebar-maximized"),
            this.state === TELE_BOX_STATE.Maximized && this.boxes.length > 0
        );
        $titleBar.classList.toggle(
            this.wrapClassName("readonly"),
            this.readonly
        );
        $titleBar.classList.add(
            this.wrapClassName(
                this.darkMode ? "color-scheme-dark" : "color-scheme-light"
            )
        );

        const $titlesArea = document.createElement("div");
        $titlesArea.classList.add(this.wrapClassName("titles-area"));
        $titleBar.insertBefore($titlesArea, $titleBar.firstElementChild);

        this.updateTitles();

        return $titleBar;
    }

    public destroy(): void {
        super.destroy();
        this.$titles = void 0;
        this.boxes.length = 0;
        this.focusedBox = void 0;
    }

    public updateTitles(): void {
        if (this.$titleBar && (this.state === TELE_BOX_STATE.Maximized || this.hasMaximizedBoxInStatus())) {
            this.$titleBar.classList.toggle(
                this.wrapClassName("max-titlebar-single-title"),
                this.boxes.length === 1 || (this.hasMaximizedBoxInStatus() && this.MaximizedBoxes.length === 1)
            );
            if (this.boxes.length === 1 || (this.hasMaximizedBoxInStatus() && this.MaximizedBoxes.length === 1)) {
                this.setTitle(this.boxes[0].title);
            } else {
                this.$titleBar.replaceChild(
                    this.renderTitles(),
                    this.$titleBar.firstElementChild as HTMLElement
                );
            }
        }
    }

    protected renderTitles(): HTMLElement {
        this.$titles = document.createElement("div");
        this.$titles.className = this.wrapClassName("titles");
        this.$titles.addEventListener(
            "wheel",
            (ev) => {
                (ev.currentTarget as HTMLElement).scrollBy({
                    left: ev.deltaY > 0 ? 250 : -250,
                    behavior: "smooth",
                });
            },
            { passive: false }
        );

        const $content = document.createElement("div");
        $content.className = this.wrapClassName("titles-content");
        this.$titles.appendChild($content);

        (this.hasMaximizedBoxInStatus() ? this.MaximizedBoxes : this.boxes).forEach((box) => {
            const $tab = document.createElement("button");
            $tab.className = this.wrapClassName("titles-tab");
            $tab.textContent = box.title;
            $tab.dataset.teleBoxID = box.id;
            $tab.dataset.teleTitleBarNoDblClick = "true";

            if (this.focusedBox && box.id === this.focusedBox.id) {
                $tab.classList.add(this.wrapClassName("titles-tab-focus"));
            }

            $content.appendChild($tab);
        });

        return this.$titles;
    }

    protected darkMode: boolean;

    protected $titles: HTMLElement | undefined;

    protected boxes: MaxTitleBarTeleBox[];

    public focusedBox: MaxTitleBarTeleBox | undefined;

    protected containerRect: TeleBoxRect;
}
