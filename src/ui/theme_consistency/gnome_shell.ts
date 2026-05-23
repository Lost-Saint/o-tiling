export const gnomeShellCss = `/* ── Quick Settings Panel ── */
.quick-settings-system-item,
.quick-settings {
    border-radius: 12px;
}

.popup-menu-content,
.quick-settings-menu > .popup-menu-content {
    border-radius: 12px;
    padding: 12px;
}

.quick-toggle, .quick-toggle-has-menu {
  border-radius: 10px;
}

.quick-toggle:checked {
    border-radius: 10px;
}

.quick-toggle-has-menu .quick-toggle:ltr {
  border-radius: 10px 0 0 10px;
}

.quick-toggle-has-menu .quick-toggle:rtl {
  border-radius: 0 10px 10px 0;
}

.quick-toggle-has-menu .quick-toggle:ltr:last-child {
  border-radius: 10px;
}

.quick-toggle-has-menu .quick-toggle:rtl:last-child {
  border-radius: 10px;
}

.quick-toggle-has-menu .quick-toggle-menu-button:ltr {
  border-radius: 0 10px 10px 0;
}

.quick-toggle-has-menu .quick-toggle-menu-button:rtl {
  border-radius: 10px 0 0 10px;
}

.quick-toggle-has-menu .quick-toggle-separator {
  width: 0px;
}

.quick-toggle-has-menu:checked{
    border-radius: 10px 0 0 10px;
}

.quick-slider {
    border-radius: 8px;
}

.datemenu-menu .popup-menu-content,
.message-list {
    border-radius: 12px;
}

.media-controls-widget {
    border-radius: 10px;
}

.popup-menu-item {
    border-radius: 10px;
}
`;

export function getGnomeShellCss(_style: 'rounded' | 'sharp'): string {
    // Per user feedback, Shell elements should stay rounded even in "sharp" mode
    return gnomeShellCss;
}
