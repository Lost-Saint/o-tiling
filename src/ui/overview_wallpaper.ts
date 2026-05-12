import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import Shell from 'gi://Shell';

export class OverviewWallpaperStyle {
    private _file: Gio.File | null = null;
    private _enabled: boolean = false;
    private _backgroundGroup: Clutter.Actor | null = null;
    private _bgManagers: any[] = [];
    private _signalMonitorChanged: number | null = null;

    constructor(enabled: boolean = false) {
        this._enabled = enabled;
    }

    private _createBackgrounds(): void {
        this._destroyBackgrounds();

        this._backgroundGroup = new Clutter.Actor();

        try {
            const blurEffect = new Shell.BlurEffect({
                brightness: 0.65,
                radius: 15,
                mode: Shell.BlurMode.ACTOR,
            });
            this._backgroundGroup.add_effect_with_name('o-tiling-bg-blur', blurEffect);
        } catch (e) {
            console.warn('OverviewWallpaperStyle: failed to apply blur effect', e);
        }

        Main.layoutManager.overviewGroup.insert_child_at_index(this._backgroundGroup, 0);

        for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
            const monitor = Main.layoutManager.monitors[i];
            const widget = new St.Widget({
                x: monitor.x,
                y: monitor.y,
                width: monitor.width,
                height: monitor.height,
            });

            const bgManager = new Background.BackgroundManager({
                container: widget,
                monitorIndex: i,
                controlPosition: false,
            });

            this._bgManagers.push(bgManager);
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

    enable(): void {
        if (!this._enabled) return;
        if (this._file) return;

        const css = `
/* O-Tiling: Full Screen Overview Wallpaper */
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

/* Fix for app grid overview workspace thumbnails */
.workspace-thumbnail .workspace-background,
.workspace-thumbnail .workspace-background-content,
.workspace-thumbnail .workspace-background-bin,
.workspace-thumbnail .workspace-background-container,
.workspace-thumbnail .workspace-background-actor {
    opacity: 1 !important;
    visibility: visible !important;
}
`;
        const path = `/tmp/o-tiling-owp-style-${GLib.get_monotonic_time()}.css`;

        try {
            // Using a Uint8Array is the modern GJS way, but string works in older versions too.
            // Using GLib.Bytes is also possible, but passing a string directly works in most environments if it's ascii
            GLib.file_set_contents(path, css);
            this._file = Gio.File.new_for_path(path);
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;

            if (theme) {
                theme.load_stylesheet(this._file);
                this._createBackgrounds();
                this._signalMonitorChanged = Main.layoutManager.connect(
                    'monitors-changed',
                    () => this._createBackgrounds()
                );
            } else {
                console.warn('OverviewWallpaperStyle: could not find theme to load stylesheet');
                this._file = null;
            }
        } catch (e) {
            console.error('OverviewWallpaperStyle: failed to load CSS', e);
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
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;

            if (theme) {
                theme.unload_stylesheet(this._file);
            }
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
