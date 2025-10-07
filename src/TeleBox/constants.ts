export enum TELE_BOX_COLOR_SCHEME {
    Light = "light",
    Dark = "dark",
    Auto = "auto",
}

export enum TELE_BOX_STATE {
    Normal = "normal",
    Minimized = "minimized",
    Maximized = "maximized",
}

export enum TELE_BOX_EVENT {
    DarkMode = "dark_mode",
    PrefersColorScheme = "prefers_color_scheme",
    Close = "close",
    Focus = "focus",
    Blur = "blur",
    Move = "move",
    Resize = "resize",
    IntrinsicMove = "intrinsic_move",
    IntrinsicResize = "intrinsic_resize",
    VisualResize = "visual_resize",
    ZIndex = "z_index",
    State = "state",
    Minimized = "minimized",
    Maximized = "maximized",
    Readonly = "readonly",
    Destroyed = "destroyed",
    BoxStatus = "box_status",
    LastNotMinimizedBoxStatus = "last_not_minimized_box_status",
    ForceTop = "force_top",
    ForceNormal = "force_normal",
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
