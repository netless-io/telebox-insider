import "./style.scss";

import faker from "faker";
import type { TeleBoxColorScheme } from "../src";
import { TeleBoxManager } from "../src";

const btns = document.querySelector(".btns") as HTMLDivElement;
const board = document.querySelector(".board") as HTMLDivElement;

const createBtn = (title: string): HTMLButtonElement => {
    const btn = document.createElement("button");
    btn.textContent = title;
    btns.appendChild(btn);
    return btn;
};

const createSelector = (
    selectedKey: string,
    options: Array<{ key: string; title: string }>
): HTMLSelectElement => {
    const sel = document.createElement("select");
    sel.value = selectedKey;
    options.forEach((option) => {
        const opt = document.createElement("option");
        opt.textContent = option.title;
        opt.value = option.key;
        sel.appendChild(opt);
    });
    btns.appendChild(sel);
    return sel;
};

const manager = new TeleBoxManager({
    fence: false,
    root: board,
    stageRatio: 9 / 16,
});

manager.collector.setStyles({
    position: "absolute",
    bottom: "10px",
    right: "50px",
});

(window as any).manager = manager;

createBtn("Create").addEventListener("click", () => {
    const title = faker.datatype.boolean()
        ? faker.commerce.productName()
        : faker.random.words(50);
    const content = document.createElement("div");
    content.className = "content";
    content.textContent = `Content ${title}`;
    manager.create({
        minHeight: 0.1,
        minWidth: 0.1,
        title: title.slice(0, 50),
        focus: true,
        content,
    });
    if (manager.minimized) {
        manager.setMinimized(false);
    }
});

createBtn("Remove").addEventListener("click", () => {
    const boxes = manager.query();
    if (boxes.length > 0) {
        manager.remove(boxes[boxes.length - 1].id);
    }
});

createBtn(manager.readonly ? "Readonly" : "Writable").addEventListener(
    "click",
    (evt) => {
        manager.setReadonly(!manager.readonly);
        (evt.currentTarget as HTMLButtonElement).textContent = manager.readonly
            ? "Readonly"
            : "Writable";
    }
);

createSelector("light", [
    { key: "light", title: "light" },
    { key: "dark", title: "dark" },
    { key: "auto", title: "auto" },
]).addEventListener("change", (evt) => {
    manager.setPrefersColorScheme(
        (evt.currentTarget as HTMLSelectElement).value as TeleBoxColorScheme
    );
});

manager.events.on("state", (state) => console.log("state", state));
