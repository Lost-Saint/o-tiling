import GLib from 'gi://GLib';
import * as log from '../../utils/log.js';
import { getGtkCss } from './gtk.js';
import { getGnomeShellCss } from './gnome_shell.js';

/**
 * Applies theme consistency CSS files to GTK and GNOME Shell.
 * This function is safe to call from the preferences process
 * (it does NOT import St or Clutter).
 */
export function applyThemeConsistency(style: 'rounded' | 'sharp' = 'rounded') {
    const gtkCss = getGtkCss(style);
    const gnomeShellCss = getGnomeShellCss(style);

    const script = `
mkdir -p ~/.config/gtk-4.0 ~/.config/gtk-3.0
echo -e "${gtkCss}" | tee ~/.config/gtk-4.0/gtk.css ~/.config/gtk-3.0/gtk.css > /dev/null

mkdir -p ~/.local/share/themes/RoundedShell/gnome-shell
cat > ~/.local/share/themes/RoundedShell/gnome-shell/gnome-shell.css << 'EOF'
${gnomeShellCss}
EOF
`;
    try {
        // To avoid quoting issues we write to a temporary file and execute it
        const tmpPath = GLib.get_tmp_dir() + '/otiling_apply_theme.sh';
        GLib.file_set_contents(tmpPath, new TextEncoder().encode(script));
        GLib.spawn_command_line_async("bash " + tmpPath);
    } catch (e) {
        log.warn('Could not apply themes consistency: ' + e);
    }
}
