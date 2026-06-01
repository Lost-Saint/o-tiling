import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Utils from '../utils/utils.js';

import type { Ext } from '../extension.js';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import St from 'gi://St';

import {
    PopupBaseMenuItem,
    PopupMenuItem,
    PopupSwitchMenuItem,
    PopupSeparatorMenuItem,
} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Button } from 'resource:///org/gnome/shell/ui/panelMenu.js';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';


import { get_current_path } from '../utils/paths.js';
import { isGnome50 } from './workspace_switcher_style.js';
import { apply_preset, PresetType } from '../engine/presets.js';
import * as Node from '../engine/node.js';
import * as Lib from '../utils/lib.js';


export class Indicator {
    button: any;
    private ext: Ext;

    toggle_tiled: any;
    toggle_workspace_tiled: any;
    toggle_pinned_split: any;
    toggle_pinned_top_left: any;
    presets_item: any;

    toggle_active: any;
    toggle_debug: any;
    border_radius: any;

    entry_gaps: any;
    signals: Array<[any, number]> = [];

    constructor(ext: Ext) {
        this.ext = ext;
        this.button = new Button(0.0, _('O-tiling Settings'));

        const path = get_current_path();
        ext.button = this.button;
        ext.button_gio_icon_auto_on = Gio.icon_new_for_string(`${path}/icons/o-tiling-auto-on-symbolic.svg`);
        ext.button_gio_icon_auto_off = Gio.icon_new_for_string(`${path}/icons/o-tiling-auto-off-symbolic.svg`);

        const button_icon_auto_on = new St.Icon({
            gicon: ext.button_gio_icon_auto_on,
            style_class: 'system-status-icon',
        });
        const button_icon_auto_off = new St.Icon({
            gicon: ext.button_gio_icon_auto_off,
            style_class: 'system-status-icon',
        });

        if (ext.settings.tile_by_default()) {
            this.button.icon = button_icon_auto_on;
        } else {
            this.button.icon = button_icon_auto_off;
        }

        this.button.add_child(this.button.icon);

        this.button.connect('button-press-event', (actor: any, event: any) => {
            if (event.get_button() === 1) { // Left click
                if (ext._ext_soft_disabled) {
                    // Extension is fully off — left click re-enables everything
                    ext.ext_soft_enable();
                } else {
                    // Extension is on — left click toggles only auto-tiling
                    if (ext.auto_tiler) ext.auto_tile_off(false);
                    else ext.auto_tile_on(false);
                }
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        const bm = this.button.menu;
        bm.box.add_style_class_name('o-tiling-menu');

        // ── Tiling ──────────────────────────────────────────────
        this.toggle_workspace_tiled = workspace_tiled(ext);
        bm.addMenuItem(this.toggle_workspace_tiled);

        // ── Split Pinning ───────────────────────────────────────
        this.toggle_pinned_split = toggle_pinned(ext);
        bm.addMenuItem(this.toggle_pinned_split);

        // ── Pin Window (Top-Left) ────────────────────────────────
        this.toggle_pinned_top_left = toggle_pinned_top_left(ext);
        bm.addMenuItem(this.toggle_pinned_top_left);

        // ── Layout Presets ──────────────────────────────────────
        this.presets_item = presets_row(ext);
        bm.addMenuItem(this.presets_item);



        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Active Hint ─────────────────────────────────────────
        this.toggle_active = toggle(
            _('Active Hint'),
            ext.settings.active_hint(),
            'focus-windows-symbolic',
            (state) => ext.settings.set_active_hint(state),
        );
        bm.addMenuItem(this.toggle_active);





        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Numeric Settings ────────────────────────────────────
        this.entry_gaps = number_entry(
            _('Gaps'),
            { value: ext.settings.gap_inner(), min: 0, max: 24, reset_value: 4 },
            'view-fullscreen-symbolic',
            (value) => {
                ext.settings.set_gap_inner(value);
                ext.settings.set_gap_outer(value);
            },
        );
        bm.addMenuItem(this.entry_gaps);

        this.border_radius = number_entry(
            _('Border Radius'),
            { value: ext.settings.active_hint_border_radius(), min: 0, max: 30, reset_value: 8 },
            'selection-mode-symbolic',
            (value) => ext.settings.set_active_hint_border_radius(value),
        );
        bm.addMenuItem(this.border_radius);

        bm.addMenuItem(number_entry(
            _('Border Width'),
            { value: ext.settings.active_hint_border_width(), min: 1, max: 10, reset_value: 3 },
            'edit-select-all-symbolic',
            (value) => ext.settings.set_active_hint_border_width(value),
        ));



        bm.addMenuItem(new PopupSeparatorMenuItem());

        // ── Actions ─────────────────────────────────────────────
        bm.addMenuItem(settings_button(bm));
        bm.addMenuItem(floating_window_exceptions(ext, bm));

        // ── Debug Mode ──────────────────────────────────────────
        this.toggle_debug = toggle(
            _('Debug Mode'),
            ext.settings.log_level() === 4,
            'utilities-terminal-symbolic',
            (state) => ext.settings.set_log_level(state ? 4 : 0),
        );
        bm.addMenuItem(this.toggle_debug);

        bm.addMenuItem(new PopupSeparatorMenuItem());

        this.toggle_tiled = tiled(ext);
        bm.addMenuItem(this.toggle_tiled);

    }

    update_workspace_tiling_state() {
        const ext = this.ext;
        if (!this.button || !this.button.visible || !this.button.get_stage?.()) {
            return;
        }
        if (ext && this.toggle_workspace_tiled) {
            const workspace = ext.active_workspace();
            const monitor = ext.active_monitor();
            const tiled = ext.is_workspace_tiled(workspace);
            this.toggle_workspace_tiled.setToggleState(tiled);
            if (this.toggle_workspace_tiled.updateIcon) {
                this.toggle_workspace_tiled.updateIcon(tiled);
            }

            if (this.toggle_pinned_split) {
                const win = ext.focus_window();
                let is_pinned = false;
                if (win && ext.auto_tiler) {
                    const fork = ext.auto_tiler.get_parent_fork(win.entity);
                    if (fork) {
                        is_pinned = fork.pinned;
                    }
                }
                this.toggle_pinned_split.setToggleState(is_pinned);
                if (this.toggle_pinned_split.updateIcon) {
                    this.toggle_pinned_split.updateIcon(is_pinned);
                }
            }

            if (this.toggle_pinned_top_left) {
                let is_pinned = false;
                if (ext.auto_tiler) {
                    const toplevel_entity = ext.auto_tiler.forest.find_toplevel([monitor, workspace]);
                    if (toplevel_entity) {
                        const toplevel_fork = ext.auto_tiler.forest.forks.get(toplevel_entity);
                        if (toplevel_fork && toplevel_fork.pinned && toplevel_fork.left.inner.kind === 2) {
                            is_pinned = true;
                        }
                    }
                }
                this.toggle_pinned_top_left.setToggleState(is_pinned);
                if (this.toggle_pinned_top_left.updateIcon) {
                    this.toggle_pinned_top_left.updateIcon(is_pinned);
                }
            }

            if (this.presets_item) {
                if (ext.auto_tiler) {
                    const ws_windows = Array.from(ext.windows.values()).filter(
                        w => w.known_workspace === workspace && ext.auto_tiler!.attached.contains(w.entity)
                    );
                    const enabled = ws_windows.length >= 2 && ws_windows.length <= 6;
                    this.presets_item.setSensitive(enabled);
                } else {
                    this.presets_item.setSensitive(false);
                }
            }

            if (this.toggle_debug) {
                this.toggle_debug.setToggleState(ext.settings.log_level() === 4);
            }

            // Update panel icon to reflect current workspace tiling state
            if (ext.auto_tiler && tiled) {
                this.button.icon.gicon = ext.button_gio_icon_auto_on;
            } else {
                this.button.icon.gicon = ext.button_gio_icon_auto_off;
            }
        }
    }

    destroy() {
        for (const [obj, id] of this.signals) {
            obj.disconnect(id);
        }
        this.signals = [];
        this.button.destroy();
    }
}

function settings_button(menu: any): any {
    const item = new PopupMenuItem(_('Settings'));
    const icon = new St.Icon({
        icon_name: 'preferences-system-symbolic',
        icon_size: 16,
        style_class: 'popup-menu-icon'
    });
    if (typeof (item as any).insert_child_at_index === 'function') {
        (item as any).insert_child_at_index(icon, 0);
    } else {
        item.add_child(icon);
    }



    item.connect('activate', () => {
        const ext = (globalThis as any).oTilingExtension;
        if (ext && typeof ext.openPreferences === 'function') {
            ext.openPreferences();
        }

        menu.close();
    });

    return item;
}

function floating_window_exceptions(ext: Ext, menu: any): any {
    const item = new PopupMenuItem(_('Floating Window Exceptions'));
    const icon = new St.Icon({
        icon_name: 'go-next-symbolic',
        icon_size: 16,
        style_class: 'popup-menu-icon'
    });
    
    if (typeof (item as any).insert_child_at_index === 'function') {
        (item as any).insert_child_at_index(icon, 0);
    } else {
        item.add_child(icon);
    }

    item.connect('activate', () => {
        if (typeof ext.exception_dialog === 'function') {
            ext.exception_dialog();
        }

        GLib.timeout_add(GLib.PRIORITY_LOW, 300, () => {
            menu.close();
            return false;
        });
    });

    return item;
}




function number_entry(
    label_text: string,
    options: { value: number; min: number; max: number; reset_value?: number },
    icon_name: string | null,
    callback: (a: number) => void,
): any {
    const { value, min, max, reset_value } = options;

    const item = new PopupBaseMenuItem({ reactive: false });

    if (icon_name) {
        const icon = new St.Icon({
            icon_name: icon_name,
            icon_size: 16,
            style_class: 'popup-menu-icon'
        });
        item.add_child(icon);
    }

    const label = new St.Label({
        text: label_text,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
    });

    const entry_box = new St.BoxLayout({
        style_class: 'o-tiling-spin-box',
        y_align: Clutter.ActorAlign.CENTER,
    });
    (entry_box as any).set_orientation(Clutter.Orientation.HORIZONTAL);

    const btn_minus = new St.Button({
        child: new St.Icon({ icon_name: 'list-remove-symbolic', icon_size: 14 }),
        style_class: 'o-tiling-spin-btn',
    });
    const btn_plus = new St.Button({
        child: new St.Icon({ icon_name: 'list-add-symbolic', icon_size: 14 }),
        style_class: 'o-tiling-spin-btn',
    });

    const entry = new St.Label({
        text: String(value),
        style_class: 'o-tiling-spin-value',
        y_align: Clutter.ActorAlign.CENTER,
    });

    entry_box.add_child(btn_minus);
    entry_box.add_child(entry);
    entry_box.add_child(btn_plus);

    const updateValue = (v: number) => {
        const clamped = Math.min(Math.max(min, v), max);
        entry.text = String(clamped);
        callback(clamped);
    };

    btn_minus.connect('clicked', () => updateValue(parseInt(entry.text) - 1));
    btn_plus.connect('clicked', () => updateValue(parseInt(entry.text) + 1));

    if (reset_value !== undefined) {
        const btn_reset = new St.Button({
            child: new St.Icon({ icon_name: 'edit-undo-symbolic', icon_size: 14 }),
            style_class: 'o-tiling-spin-btn',
        });
        entry_box.add_child(btn_reset);
        btn_reset.connect('clicked', () => updateValue(reset_value));
    }

    item.add_child(label);
    item.add_child(entry_box);

    return item;
}


function toggle(
    desc: string,
    active: boolean,
    icon_names: string | { on: string; off: string } | null,
    callback: (state: boolean) => void,
): any {
    const item = new PopupSwitchMenuItem(desc, active);

    if (icon_names) {
        const icon_name = typeof icon_names === 'string'
            ? icon_names
            : (active ? icon_names.on : icon_names.off);

        const icon = new St.Icon({
            icon_name: icon_name,
            icon_size: 16,
            style_class: 'popup-menu-icon',
        });

        if (typeof (item as any).insert_child_at_index === 'function') {
            (item as any).insert_child_at_index(icon, 1);
        } else {
            item.add_child(icon);
        }

        if (typeof icon_names !== 'string') {
            (item as any).updateIcon = (state: boolean) => {
                icon.icon_name = state ? icon_names.on : icon_names.off;
            };

            item.connect('toggled', (_, state) => {
                (item as any).updateIcon(state);
            });
        }
    }

    item.connect('toggled', (_, state) => {
        callback(state);
    });

    return item;
}

function tiled(ext: Ext): any {
    // Extension is "on" when it is NOT soft-disabled
    const isOn = !ext._ext_soft_disabled;
    return toggle(
        _('Enable O-Tiling Extension'),
        isOn,
        'view-grid-symbolic',
        (shouldEnable) => {
            if (shouldEnable) {
                ext.ext_soft_enable();
            } else {
                ext.ext_soft_disable();
            }
        }
    );
}

function workspace_tiled(ext: Ext): any {
    return toggle(
        _('Tile This Workspace'),
        ext.is_workspace_tiled(ext.active_workspace()),
        { on: 'view-grid-symbolic', off: 'view-list-symbolic' },
        (shouldTile) => {
            ext.workspace_tiling_set(ext.active_workspace(), shouldTile);
        }
    );
}

function toggle_pinned(ext: Ext): any {
    return toggle(
        _('Pin Active Window Split'),
        false,
        { on: 'changes-prevent-symbolic', off: 'changes-allow-symbolic' },
        (shouldPin) => {
            const win = ext.focus_window();
            if (win && ext.auto_tiler) {
                const fork = ext.auto_tiler.get_parent_fork(win.entity);
                if (fork) {
                    fork.pinned = shouldPin;
                    ext.auto_tiler.tile(ext, fork, fork.area);
                }
            }
        }
    );
}

function toggle_pinned_top_left(ext: Ext): any {
    return toggle(
        _('Pin Window (Top-Left) No Split'),
        false,
        'view-pin-symbolic',
        (shouldPin) => {
            const win = ext.focus_window();
            if (!win || !ext.auto_tiler) return;

            const ws = ext.active_workspace();
            const monitor = ext.active_monitor();
            const forest = ext.auto_tiler.forest;
            const toplevel_entity = forest.find_toplevel([monitor, ws]);
            if (!toplevel_entity) return;
            const toplevel_fork = forest.forks.get(toplevel_entity);
            if (!toplevel_fork) return;

            if (shouldPin) {
                const ws_windows = Array.from(ext.windows.values()).filter(
                    w => w.known_workspace === ws && ext.auto_tiler!.attached.contains(w.entity)
                );
                if (ws_windows.length < 2) return;

                win.ignore_detach = true;
                ext.auto_tiler.detach_window(ext, win.entity);
                win.ignore_detach = false;

                const remaining_toplevel_entity = forest.find_toplevel([monitor, ws]);
                if (!remaining_toplevel_entity) return;

                const is_fork = forest.forks.contains(remaining_toplevel_entity);
                const left_node = Node.Node.window(win.entity);
                const right_node = is_fork 
                    ? Node.Node.fork(remaining_toplevel_entity)
                    : Node.Node.window(remaining_toplevel_entity);

                if (is_fork) {
                    const rf = forest.forks.get(remaining_toplevel_entity);
                    if (rf && rf.is_toplevel) {
                        rf.is_toplevel = false;
                        const id = forest.string_reps.get(remaining_toplevel_entity);
                        if (id) forest.toplevel.delete(id);
                    }
                }

                const area = ext.monitor_work_area(monitor);
                area.x += ext.gap_outer;
                area.y += ext.gap_outer;
                area.width -= ext.gap_outer * 2;
                area.height -= ext.gap_outer * 2;

                const [new_toplevel_entity, new_toplevel_fork] = forest.create_fork(
                    left_node,
                    right_node,
                    area.clone(),
                    ws,
                    monitor
                );
                new_toplevel_fork.set_orientation(Lib.Orientation.HORIZONTAL);
                new_toplevel_fork.pinned = true;

                const sid = `${new_toplevel_entity}`;
                forest.string_reps.insert(new_toplevel_entity, sid);
                new_toplevel_fork.set_toplevel(forest, new_toplevel_entity, sid, [monitor, ws]);

                ext.auto_tiler.attached.insert(win.entity, new_toplevel_entity);
                forest.on_attach(new_toplevel_entity, win.entity);

                if (is_fork) {
                    forest.parents.insert(remaining_toplevel_entity, new_toplevel_entity);
                } else {
                    ext.auto_tiler.attached.insert(remaining_toplevel_entity, new_toplevel_entity);
                    forest.on_attach(new_toplevel_entity, remaining_toplevel_entity);
                }

                forest.tile(ext, new_toplevel_fork, area);
                forest.arrange(ext, ws, true);
            } else {
                toplevel_fork.pinned = false;
                forest.tile(ext, toplevel_fork, toplevel_fork.area);
                forest.arrange(ext, ws, true);
            }
        }
    );
}


function presets_row(ext: Ext): any {
    const item = new PopupBaseMenuItem({ reactive: false });

    const label = new St.Label({
        text: _('Layout Presets'),
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
    });
    item.add_child(label);

    const row = new St.BoxLayout({
        y_align: Clutter.ActorAlign.CENTER,
    });
    (row as any).set_orientation(Clutter.Orientation.HORIZONTAL);

    const presets = [
        { name: _('Columns'), type: PresetType.COLUMNS, icon: 'view-column-symbolic' },
        { name: _('Stacked'), type: PresetType.STACKED, icon: 'view-list-symbolic' },
        { name: _('Grid'), type: PresetType.GRID, icon: 'view-grid-symbolic' },
        { name: _('Spiral'), type: PresetType.SPIRAL, icon: 'media-playlist-consecutive-symbolic' },
    ];

    for (const p of presets) {
        const btn = new St.Button({
            child: new St.Icon({ icon_name: p.icon, icon_size: 14 }),
            style_class: 'o-tiling-spin-btn',
        });

        btn.connect('clicked', () => {
            const ws = ext.active_workspace();
            const monitor = ext.active_monitor();
            apply_preset(ext, p.type, ws, monitor);
        });
        row.add_child(btn);
    }

    item.add_child(row);
    return item;
}





