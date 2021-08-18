import faker from "faker";
import { TeleBoxCollector, TeleBoxManager } from "../src";

const btnCreate = document.querySelector(".btn-create")!;
const btnRemove = document.querySelector(".btn-remove")!;
const board = document.querySelector<HTMLDivElement>(".board")!;

setBoardRect();

const manager = new TeleBoxManager({
    fence: false,
    root: document.body,
    containerRect: board.getBoundingClientRect(),
    collector: new TeleBoxCollector({
        styles: {
            position: "absolute",
            bottom: "10px",
            right: "50px",
        },
    }).mount(document.body),
});

btnCreate.addEventListener("click", () => {
    const title = faker.datatype.boolean()
        ? faker.commerce.productName()
        : faker.random.words(50);
    const content = document.createElement("div");
    content.style.padding = "16px";
    content.style.background = "#fff";
    content.textContent = `Content ${title}`;
    manager.create({
        title: title.slice(0, 50),
        focus: true,
        content,
    });
});

btnRemove.addEventListener("click", () => {
    const boxes = manager.query();
    if (boxes.length > 0) {
        manager.remove(boxes[boxes.length - 1].id);
    }
});

window.addEventListener("resize", () => {
    setBoardRect();
    manager.setContainerRect(board.getBoundingClientRect());
});

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
