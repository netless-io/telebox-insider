import type { TeleBoxRect } from "./typings";

export function calcStageRect([rootRect, ratio]: [
    TeleBoxRect,
    number
]): TeleBoxRect {
    if (ratio <= 0 || rootRect.width <= 0 || rootRect.height <= 0) {
        return rootRect;
    }

    const preferredHeight = rootRect.width * ratio;
    if (preferredHeight === rootRect.height) {
        return rootRect;
    }

    if (preferredHeight < rootRect.height) {
        return {
            x: 0,
            y: (rootRect.height - preferredHeight) / 2,
            width: rootRect.width,
            height: preferredHeight,
        };
    }

    const preferredWidth = rootRect.height / ratio;
    return {
        x: (rootRect.width - preferredWidth) / 2,
        y: 0,
        width: preferredWidth,
        height: rootRect.height,
    };
}
