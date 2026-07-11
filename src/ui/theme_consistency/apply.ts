import GLib from 'gi://GLib';
import * as log from '../../utils/log.js';
import * as result from '../../utils/result.js';
import * as utils from '../../utils/utils.js';
import { getGtkCss } from './gtk.js';

const O_TILING_START = '/* === O-TILING START === */';
const O_TILING_END = '/* === O-TILING END === */';

/** Removes the O-Tiling block from a gtk.css file (leaves the rest intact). */
async function removeCssBlock(path: string): Promise<void> {
    if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
        return; // File doesn't exist — nothing to remove.
    }

    const read = await utils.read_to_string(path);
    if (read.kind === result.ERR) {
        log.warn(`Failed to read GTK CSS file at ${path}: ${read.value.format()}`);
        return;
    }

    let content = read.value;
    const startIndex = content.indexOf(O_TILING_START);
    const endIndex = content.indexOf(O_TILING_END);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        content = content.slice(0, startIndex) + content.slice(endIndex + O_TILING_END.length);
        const write = await utils.write_string(path, content.trim() + '\n');
        if (write.kind === result.ERR) {
            log.warn(`Failed to write GTK CSS file at ${path}: ${write.value.format()}`);
        }
    }
}

/**
 * Restores the GTK theme to the stock default by removing the O-Tiling
 * CSS block that was previously injected into gtk-4.0/gtk.css and
 * gtk-3.0/gtk.css.  Safe to call even if no block is present.
 */
export async function restoreGtkDefaults(): Promise<void> {
    try {
        const home = GLib.get_home_dir();
        await removeCssBlock(`${home}/.config/gtk-4.0/gtk.css`);
        await removeCssBlock(`${home}/.config/gtk-3.0/gtk.css`);
        log.info('ThemeConsistency: GTK css block removed — theme restored to default');
    } catch (e) {
        log.warn('Could not restore GTK default theme: ' + e);
    }
}

/**
 * Applies theme consistency CSS files to GTK.
 * This function is safe to call from the preferences process
 * (it does NOT import St or Clutter).
 *
 * BUG-02 fix: writes CSS files directly instead of using a shell script.
 * BUG-03 fix: passes plain strings to GLib.file_set_contents (not Uint8Array).
 */
export async function applyThemeConsistency(style: 'rounded' | 'sharp' = 'rounded'): Promise<void> {
    const gtkCss = getGtkCss(style);

    try {
        const gtk4Dir = GLib.get_home_dir() + '/.config/gtk-4.0';
        const gtk3Dir = GLib.get_home_dir() + '/.config/gtk-3.0';

        GLib.mkdir_with_parents(gtk4Dir, 0o755);
        GLib.mkdir_with_parents(gtk3Dir, 0o755);

        const updateCssFile = async (path: string, newCss: string) => {
            let content = '';
            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                const read = await utils.read_to_string(path);
                if (read.kind === result.ERR) {
                    log.warn(`Failed to read GTK CSS file for update at ${path}: ${read.value.format()}`);
                } else {
                    content = read.value;
                }
            }

            const startIndex = content.indexOf(O_TILING_START);
            const endIndex = content.indexOf(O_TILING_END);

            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                content = content.slice(0, startIndex) + content.slice(endIndex + O_TILING_END.length);
            }

            content = content.trim() + '\n\n' + O_TILING_START + '\n' + newCss + '\n' + O_TILING_END + '\n';
            const write = await utils.write_string(path, content.trimStart());
            if (write.kind === result.ERR) {
                log.warn(`Failed to write GTK CSS file at ${path}: ${write.value.format()}`);
            }
        };

        await updateCssFile(`${gtk4Dir}/gtk.css`, gtkCss);
        await updateCssFile(`${gtk3Dir}/gtk.css`, gtkCss);
    } catch (e) {
        log.warn('Could not apply GTK theme consistency: ' + e);
    }
}
