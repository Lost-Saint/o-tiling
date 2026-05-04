export const gnomeShellCss = `/* ── Quick Settings Panel ── */
.quick-settings-system-item,
.quick-settings {
    border-radius: 12px !important;
}

.popup-menu-content,
.quick-settings-menu > .popup-menu-content {
    border-radius: 12px !important;
    padding: 12px !important;
}

.quick-toggle, .quick-toggle-has-menu {
  border-radius: 10px !important;
}

.quick-toggle:checked {
    border-radius: 10px !important;
}

.quick-toggle-has-menu .quick-toggle:ltr {
  border-radius: 10px 0 0 10px !important;
}

.quick-toggle-has-menu .quick-toggle:rtl {
  border-radius: 0 10px 10px 0 !important;
}

.quick-toggle-has-menu .quick-toggle:ltr:last-child {
  border-radius: 10px !important;
}

.quick-toggle-has-menu .quick-toggle:rtl:last-child {
  border-radius: 10px !important;
}

.quick-toggle-has-menu .quick-toggle-menu-button:ltr {
  border-radius: 0 10px 10px 0 !important;
}

.quick-toggle-has-menu .quick-toggle-menu-button:rtl {
  border-radius: 10px 0 0 10px !important;
}

.quick-toggle-has-menu .quick-toggle-separator {
  width: 0px !important;
}

.quick-toggle-has-menu:checked{
    border-radius: 10px 0 0 10px !important;
}

.quick-slider {
    border-radius: 8px !important;
}

.datemenu-menu .popup-menu-content,
.message-list {
    border-radius: 12px !important;
}

.media-controls-widget {
    border-radius: 10px !important;
}

.popup-menu-item {
    border-radius: 10px !important;
}
`;
