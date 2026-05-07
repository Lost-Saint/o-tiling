import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as log from '../../utils/log.js';
import { gnomeShellCss } from './gnome_shell.js';

/**
 * Manages the GNOME Shell session-level CSS injection for theme consistency.
 * This works even if the "User Themes" extension is NOT installed.
 */
export class ThemeConsistencyManager {
    private _file: Gio.File | null = null;

    enable(): void {
        if (this._file) return;

        const path = `/tmp/o-tiling-theme-consistency-${GLib.get_monotonic_time()}.css`;

        try {
            GLib.file_set_contents(path, gnomeShellCss);
            this._file = Gio.File.new_for_path(path);
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;

            if (theme) {
                theme.load_stylesheet(this._file);
                log.info('ThemeConsistencyManager: session CSS injected');
            }
        } catch (e) {
            log.error(`ThemeConsistencyManager: failed to inject CSS: ${e}`);
            this._file = null;
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
            this._file.delete(null);
        } catch (_) { /* best-effort */ }

        this._file = null;
    }

    get isEnabled(): boolean {
        return this._file !== null;
    }
}
