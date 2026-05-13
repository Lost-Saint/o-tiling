import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as log from '../utils/log.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';

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

/* Search bar styling in overview */
.search-entry {
    background-color: rgba(0, 0, 0, 0.35) !important;
    border-radius: 12px !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    color: white !important;
}

.search-entry:focus {
    background-color: rgba(0, 0, 0, 0.5) !important;
}
`;
}

/**
 * Manages the aesthetic of a "Full Screen" overview wallpaper by hiding/tinting
 * individual workspace background actors and applying blur effects to dialogs.
 */
export class OverviewWallpaperStyle {
    private _file: Gio.File | null = null;
    private _appFolderBlur: any = null;
    private _bgBlurEffect: Shell.BlurEffect | null = null;
    private _signals: number[] = [];

    constructor() {}

    enable(): void {
        if (this._file) return;

        const css = buildWorkspaceBgCss();
        const path = `/tmp/o-tiling-overview-bg-${GLib.get_monotonic_time()}.css`;

        try {
            GLib.file_set_contents(path, css);
            this._file = Gio.File.new_for_path(path);
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;

            if (theme) {
                theme.load_stylesheet(this._file);
                this._patchAppFolderDialog();
                this._setupBlurSignals();
                
                // If overview is already open, apply immediately
                if (Main.overview.visible || Main.overview.showing) {
                    this._applyBackgroundBlur();
                }
            }
        } catch (e) {
            log.error(`OverviewWallpaperStyle: failed to load CSS: ${e}`);
        }
    }

    disable(): void {
        if (!this._file) return;

        try {
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;

            if (theme) {
                theme.unload_stylesheet(this._file);
            }
            if (this._file.query_exists(null)) {
                this._file.delete(null);
            }
            this._unpatchAppFolderDialog();
            this._removeBackgroundBlur();
        } catch (_) { /* best-effort cleanup */ }

        this._file = null;
        this._signals.forEach(id => Main.overview.disconnect(id));
        this._signals = [];
    }

    private _patchAppFolderDialog(): void {
        // Apply blur to app folder dialogs for a consistent glass look
        const appDisplay = (Main as any).overview?._overview?._controls?._appDisplay || 
                           (Main as any).overview?._controls?._appDisplay;
        
        const { AppFolderDialog } = appDisplay || {};
        if (!AppFolderDialog) return;

        const proto = AppFolderDialog.prototype as any;
        if (!proto._o_tiling_patched) {
            const origOpen = proto.open;
            proto.open = function(...args: any[]) {
                origOpen.apply(this, args);
                if (!this._blurEffect) {
                    this._blurEffect = new Shell.BlurEffect({
                        brightness: 0.6,
                        radius: 30,
                        mode: Shell.BlurMode.BACKGROUND,
                    });
                    this.add_effect(this._blurEffect);
                }
            };
            proto._o_tiling_patched = true;
        }
    }

    private _setupBlurSignals(): void {
        this._signals.push(Main.overview.connect('showing', () => {
            this._applyBackgroundBlur();
        }));
        this._signals.push(Main.overview.connect('hiding', () => {
            this._removeBackgroundBlur();
        }));
    }

    private _applyBackgroundBlur(): void {
        if (this._bgBlurEffect) return;

        this._bgBlurEffect = new Shell.BlurEffect({
            brightness: 0.6,
            radius: 40, // Slightly higher radius for the full-screen background
            mode: Shell.BlurMode.BACKGROUND,
        });

        // The background in the overview is typically held by the thumbnails box parent or the overview controls
        const controls = (Main as any).overview?._overview?._controls || (Main as any).overview?._controls;
        if (controls) {
            controls.add_effect_with_name('o-tiling-overview-blur', this._bgBlurEffect);
        }
    }

    private _removeBackgroundBlur(): void {
        if (!this._bgBlurEffect) return;

        const controls = (Main as any).overview?._overview?._controls || (Main as any).overview?._controls;
        if (controls) {
            controls.remove_effect_by_name('o-tiling-overview-blur');
        }
        this._bgBlurEffect = null;
    }

    private _unpatchAppFolderDialog(): void {
        // We generally don't unpatch prototypes at runtime to avoid instability,
        // but the effect itself is managed by the Shell lifecycle.
    }
}
