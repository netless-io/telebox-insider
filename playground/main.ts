import "./style.scss";

import faker from "faker";
import {
    TeleBoxCollector,
    TeleBoxColorScheme,
    TeleBoxManager,
    TeleBoxRect,
} from "../src";

const btns = document.querySelector(".btns")!;
const board = document.querySelector<HTMLDivElement>(".board")!;

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

setBoardRect();

const manager = new TeleBoxManager({
    fence: false,
    root: board,
    containerRect: getBoardRect(),
    collector: new TeleBoxCollector({
        styles: {
            position: "absolute",
            bottom: "10px",
            right: "50px",
        },
    }).mount(board),
});

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

window.addEventListener("resize", () => {
    setBoardRect();
    manager.setContainerRect(getBoardRect());
});

function getBoardRect(): TeleBoxRect {
    const { width, height } = board.getBoundingClientRect();
    return { width, height, x: 0, y: 0 };
}

function setBoardRect(): void {
    const { innerWidth, innerHeight } = window;
    let width = innerWidth;
    let height = (innerWidth * 9) / 16;
    if (height > innerHeight) {
        width = (innerHeight * 16) / 9;
        height = innerHeight;
    }
    board.style.width = width + "px";
    board.style.height = height + "px";
}
