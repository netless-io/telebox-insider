export enum TELE_BOX_STATE {
    Normal = "normal",
    Minimized = "minimized",
    Maximized = "maximized",
}

export enum TELE_BOX_EVENT {
    Close = "close",
    Focus = "focus",
    Blur = "blur",
    Move = "move",
    Resize = "resize",
    IntrinsicMove = "intrinsic_move",
    IntrinsicResize = "intrinsic_resize",
    VisualResize = "visual_resize",
    State = "state",
    Readonly = "readonly",
    Destroyed = "destroyed",
}

export enum TELE_BOX_DELEGATE_EVENT {
    Close = "close",
    Maximize = "maximize",
    Minimize = "minimize",
}

export enum TELE_BOX_RESIZE_HANDLE {
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
