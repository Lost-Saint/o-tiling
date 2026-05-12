import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import Shell from 'gi://Shell';
import { isGnome50 } from './workspace_switcher_style.js';

// ─── CSS builders ────────────────────────────────────────────────────────────

/**
 * Workspace-background rules — class names are stable across GNOME 48-50.
 */
function buildWorkspaceBgCss(): string {
    return `
/* O-Tiling: Full Screen Overview Wallpaper — workspace backgrounds */
.workspace-background,
.workspace-background-content,
.workspace-background-bin,
.workspace-background-container,
.workspace-background-actor,
.workspace-background-group {
    opacity: 1 !important;
    visibility: visible !important;
    background-color: rgba(0, 0, 0, 0.45) !important;
    box-shadow: none !important;
    border: none !important;
}

/* Keep thumbnail previews visible */
.workspace-thumbnail .workspace-background,
.workspace-thumbnail .workspace-background-content,
.workspace-thumbnail .workspace-background-bin,
.workspace-thumbnail .workspace-background-container,
.workspace-thumbnail .workspace-background-actor {
    opacity: 1 !important;
    visibility: visible !important;
}
`;
}

/**
 * Search-bar rules.
 *
 * GNOME 48-49: search floats above the workspace switcher. Class is .search-entry.
 * GNOME 50:    search moved into the unified overview surface. Same class name.
 *
 * We target both the container and the inner StEntry because the theme may set
 * the background on either level depending on version.
 */
function buildSearchCss(): string {
    return `
/* O-Tiling: Full Screen Overview Wallpaper — search bar */
.search-entry,
.search-entry StEntry,
.search-entry-container {
    background-color: rgba(255, 255, 255, 0.12) !important;
    border-color: rgba(255, 255, 255, 0.20) !important;
    box-shadow: none !important;
    color: rgba(255, 255, 255, 0.90) !important;
}

.search-entry:focus,
.search-entry StEntry:focus {
    background-color: rgba(255, 255, 255, 0.18) !important;
    border-color: rgba(255, 255, 255, 0.38) !important;
}

/* Placeholder text */
.search-entry StEntry .hint-text {
    color: rgba(255, 255, 255, 0.50) !important;
}
`;
}

/**
 * App-folder dialog rules.
 *
 * Confirmed from the real GNOME 50 _app-grid.scss:
 *
 *   .app-folder-dialog {
 *       background-color: $system_overlay_bg_color;   // opaque dark
 *       box-shadow: inset 0 0 0 1px $system_borders_color;
 *       border-radius: $modal_radius * 4;
 *   }
 *   .app-folder-dialog-container {
 *       padding-top: $panel_height;                   // NO background set
 *   }
 *
 * .apps-scroll-view and .icon-grid have NO background in the SCSS (only
 * spacing/padding), so they are already transparent — no override needed.
 * .overview-tile intentionally keeps its $system_base_color so app icons
 * remain legible.
 */
function buildFolderCss(): string {
    return `
/* O-Tiling: Full Screen Overview Wallpaper — app folder dialog */

/* Outer backdrop wrapper — no background, wallpaper shows through */
.app-folder-dialog-container {
    background-color: transparent !important;
}

/* The dialog card itself — semi-transparent dark glass */
.app-folder-dialog {
    background-color: rgba(28, 28, 36, 0.60) !important;
    /* Keep the theme's inset border so the card edge is still visible */
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12) !important;
}

/* Folder title label */
.app-folder-dialog .folder-name-container .folder-name-label,
.app-folder-dialog .folder-name-container .folder-name-entry {
    color: rgba(255, 255, 255, 0.95) !important;
}

/* Folder rename text entry */
.app-folder-dialog .folder-name-container .folder-name-entry {
    background-color: rgba(255, 255, 255, 0.12) !important;
    border-color: rgba(255, 255, 255, 0.20) !important;
    color: rgba(255, 255, 255, 0.95) !important;
}
`;
}

/**
 * GNOME 50 only: the unified overview surface introduces a few extra
 * containers that may carry an opaque background.
 */
function buildGnome50Css(): string {
    return `
/* O-Tiling: GNOME 50 unified overview surface */
.overview-controls,
.workspace-overview {
    background-color: transparent !important;
}
`;
}

/** Assembles the complete injected stylesheet. */
function buildCss(): string {
    const parts: string[] = [
        buildWorkspaceBgCss(),
        buildSearchCss(),
        buildFolderCss(),
    ];

    if (isGnome50()) {
        parts.push(buildGnome50Css());
    }

    return parts.join('\n');
}

// ─── OverviewWallpaperStyle ───────────────────────────────────────────────────

export class OverviewWallpaperStyle {
    private _file: Gio.File | null = null;
    private _enabled: boolean = false;
    private _backgroundGroup: Clutter.Actor | null = null;
    private _bgManagers: any[] = [];
    private _signalMonitorChanged: number | null = null;

    constructor(enabled: boolean = false) {
        this._enabled = enabled;
    }

    // ── Background actor helpers ──────────────────────────────────────────

    private _createBackgrounds(): void {
        this._destroyBackgrounds();

        // overviewGroup exists in GNOME 48-50; guard defensively.
        const overviewGroup = (Main.layoutManager as any).overviewGroup;
        if (!overviewGroup) {
            console.warn('OverviewWallpaperStyle: overviewGroup not available, skipping background actors');
            return;
        }

        this._backgroundGroup = new Clutter.Actor();

        try {
            const blurEffect = new Shell.BlurEffect({
                brightness: 0.65,
                radius: 15,
                mode: Shell.BlurMode.ACTOR,
            });
            this._backgroundGroup.add_effect_with_name('o-tiling-bg-blur', blurEffect);
        } catch (e) {
            console.warn('OverviewWallpaperStyle: blur effect unavailable', e);
        }

        overviewGroup.insert_child_at_index(this._backgroundGroup, 0);

        const monitors = Main.layoutManager.monitors;
        for (let i = 0; i < monitors.length; i++) {
            const monitor = monitors[i];
            const widget = new St.Widget({
                x: monitor.x,
                y: monitor.y,
                width: monitor.width,
                height: monitor.height,
            });

            try {
                const bgManager = new Background.BackgroundManager({
                    container: widget,
                    monitorIndex: i,
                    controlPosition: false,
                });
                this._bgManagers.push(bgManager);
            } catch (e) {
                console.warn(`OverviewWallpaperStyle: BackgroundManager failed on monitor ${i}`, e);
            }

            this._backgroundGroup.add_child(widget);
        }
    }

    private _destroyBackgrounds(): void {
        for (const manager of this._bgManagers) {
            try { manager.destroy(); } catch (_) { }
        }
        this._bgManagers = [];

        if (this._backgroundGroup) {
            try { this._backgroundGroup.destroy(); } catch (_) { }
            this._backgroundGroup = null;
        }
    }

    // ── Public API ────────────────────────────────────────────────────────

    enable(): void {
        if (!this._enabled) return;
        if (this._file) return;

        const css = buildCss();
        const path = `/tmp/o-tiling-owp-style-${GLib.get_monotonic_time()}.css`;

        try {
            GLib.file_set_contents(path, css);
            this._file = Gio.File.new_for_path(path);

            const theme = St.ThemeContext
                .get_for_stage((global as any).stage as Clutter.Stage)
                .get_theme() as any;

            if (theme) {
                theme.load_stylesheet(this._file);
                this._createBackgrounds();
                this._signalMonitorChanged = Main.layoutManager.connect(
                    'monitors-changed',
                    () => this._createBackgrounds(),
                );
            } else {
                console.warn('OverviewWallpaperStyle: no theme context found');
                this._file = null;
            }
        } catch (e) {
            console.error('OverviewWallpaperStyle: failed to enable', e);
            this._file = null;
        }
    }

    disable(): void {
        if (this._signalMonitorChanged !== null) {
            try { Main.layoutManager.disconnect(this._signalMonitorChanged); } catch (_) { }
            this._signalMonitorChanged = null;
        }

        this._destroyBackgrounds();

        if (!this._file) return;

        try {
            const theme = St.ThemeContext
                .get_for_stage((global as any).stage as Clutter.Stage)
                .get_theme() as any;

            if (theme) theme.unload_stylesheet(this._file);
            this._file.delete(null);
        } catch (_) { /* best-effort */ }

        this._file = null;
    }

    updateSetting(enabled: boolean): void {
        this._enabled = enabled;
        if (this._enabled) {
            this.enable();
        } else {
            this.disable();
        }
    }
}