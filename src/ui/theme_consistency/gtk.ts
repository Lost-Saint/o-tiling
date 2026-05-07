export const gtkCss = `
/* Rounded corners for normal floating windows */
window.main-window,
window.background,
.base,
stack,
dialog {
    border-radius: 10px;
}

headerbar {
    border-radius: 10px 10px 0 0;
}

/* Remove rounded corners for maximized, tiled, snapped and fullscreen windows */
window.maximized,
window.tiled,
window.tiled-top,
window.tiled-bottom,
window.tiled-left,
window.tiled-right,
window.fullscreen,
window.maximized .main-window,
window.maximized .background,
window.maximized .base,
window.maximized stack,
window.tiled .main-window,
window.tiled .background,
window.tiled .base,
window.tiled stack,
window.fullscreen .main-window,
window.fullscreen .background {
    border-radius: 0;
}

window.maximized headerbar,
window.tiled headerbar,
window.tiled-top headerbar,
window.tiled-bottom headerbar,
window.tiled-left headerbar,
window.tiled-right headerbar,
window.fullscreen headerbar {
    border-radius: 0;
}
`;


