import GLib from 'gi://GLib';
import * as log from '../log.js';
import { gtkCss } from './gtk.js';
import { gnomeShellCss } from './gnome_shell.js';

export function applyThemeConsistency() {
    const script = `
mkdir -p ~/.config/gtk-4.0 ~/.config/gtk-3.0
echo -e "${gtkCss}" | tee ~/.config/gtk-4.0/gtk.css ~/.config/gtk-3.0/gtk.css > /dev/null

mkdir -p ~/.local/share/themes/FlatCorners/gnome-shell
cat > ~/.local/share/themes/FlatCorners/gnome-shell/gnome-shell.css << 'EOF'
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
