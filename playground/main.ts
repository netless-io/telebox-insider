import { TeleBoxManager } from "../src";

const btnCreate = document.querySelector(".btn-create")!;
const btnRemove = document.querySelector(".btn-remove")!;
const board = document.querySelector<HTMLDivElement>(".board")!;

setBoardRect();

const manager = new TeleBoxManager({
    root: document.body,
    containerRect: board.getBoundingClientRect(),
});

btnCreate.addEventListener("click", () => {
    manager.create();
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
