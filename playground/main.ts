import { TeleBox } from "../src";

const teleBox = new TeleBox({ title: "Window 1" });

teleBox.mount(document.body);

(window as any).teleBox = teleBox;
