import GLib from 'gi://GLib';
import * as log from '../../utils/log.js';
import { getGtkCss } from './gtk.js';

const START_MARKER = '/* === O-TILING START === */';
const END_MARKER = '/* === O-TILING END === */';

function updateCssFile(path: string, newCss: string | null) {
    let content = '';
    try {
        const [, bytes] = GLib.file_get_contents(path);
        content = new TextDecoder().decode(bytes);
    } catch (_) {}

    const startIndex = content.indexOf(START_MARKER);
    const endIndex = content.indexOf(END_MARKER);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        content = content.slice(0, startIndex) + content.slice(endIndex + END_MARKER.length);
    }

    if (newCss !== null) {
        content = content.trim() + '\n\n' + START_MARKER + '\n' + newCss + '\n' + END_MARKER + '\n';
    }

    GLib.file_set_contents(path, content.trimStart());
}

/**
 * Applies theme consistency CSS files to GTK.
 * This function is safe to call from the preferences process
 * (it does NOT import St or Clutter).
 *
 * BUG-02 fix: writes CSS files directly instead of using a shell script.
 * BUG-03 fix: passes plain strings to GLib.file_set_contents (not Uint8Array).
 */
export function applyThemeConsistency(style: 'rounded' | 'sharp' = 'rounded') {
    const gtkCss = getGtkCss(style);

    try {
        const gtk4Dir = GLib.get_home_dir() + '/.config/gtk-4.0';
        const gtk3Dir = GLib.get_home_dir() + '/.config/gtk-3.0';

        GLib.mkdir_with_parents(gtk4Dir, 0o755);
        GLib.mkdir_with_parents(gtk3Dir, 0o755);

        updateCssFile(`${gtk4Dir}/gtk.css`, gtkCss);
        updateCssFile(`${gtk3Dir}/gtk.css`, gtkCss);
    } catch (e) {
        log.warn('Could not apply GTK theme consistency: ' + e);
    }
}

export function removeThemeConsistency() {
    try {
        const gtk4Css = GLib.get_home_dir() + '/.config/gtk-4.0/gtk.css';
        const gtk3Css = GLib.get_home_dir() + '/.config/gtk-3.0/gtk.css';
        updateCssFile(gtk4Css, null);
        updateCssFile(gtk3Css, null);
    } catch (e) {
        log.warn('Could not remove GTK theme consistency: ' + e);
    }
}
