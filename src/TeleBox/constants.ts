export enum TeleBoxState {
    Normal = "normal",
    Minimized = "minimized",
    Maximized = "maximized",
}

export enum TeleBoxEventType {
    Close = "close",
    Focus = "focus",
    Blur = "blur",
    Move = "move",
    Resize = "resize",
    State = "state",
    Snapshot = "snapshot",
}

export enum TeleBoxResizeHandle {
    North = "n",
    South = "s",
    West = "w",
    East = "e",
    NorthWest = "nw",
    NorthEast = "ne",
    SouthEast = "se",
    SouthWest = "sw",
}

export const TeleBoxDragHandleType = "dh";
