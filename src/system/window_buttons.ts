import type { ExtensionSettings } from './settings.js';

/**
 * Manages the window management buttons (Minimize, Maximize, Close).
 * Synchronizes extension settings with the global GNOME button layout.
 */
export class WindowButtonsManager {
    private _settings: ExtensionSettings;
    private _signalIds: number[] = [];

    constructor(settings: ExtensionSettings) {
        this._settings = settings;
    }

    /**
     * Enables the manager and connects settings signals.
     */
    enable() {
        this._signalIds.push(
            this._settings.ext.connect('changed::show-minimize-maximize-buttons', () => this.sync()),
            this._settings.ext.connect('changed::show-close-button', () => this.sync())
        );
        this.sync();
    }

    /**
     * Disables the manager and disconnects signals.
     */
    disable() {
        for (const id of this._signalIds) {
            this._settings.ext.disconnect(id);
        }
        this._signalIds = [];
    }

    /**
     * Synchronizes the global GNOME button layout with the extension settings.
     */
    sync() {
        const wm = this._settings.wm;
        if (!wm) return;

        const show_min_max = this._settings.show_minimize_maximize_buttons();
        const show_close = this._settings.show_close_button();

        let layout = wm.get_string('button-layout');
        let [left, right] = layout.split(':');
        if (right === undefined) {
            right = left;
            left = '';
        }

        let right_buttons = right.split(',').map((s) => s.trim()).filter((s) => s !== '');
        let left_buttons = left.split(',').map((s) => s.trim()).filter((s) => s !== '');

        // Remove minimize/maximize/close from both sides
        right_buttons = right_buttons.filter((s) => s !== 'minimize' && s !== 'maximize' && s !== 'close');
        left_buttons = left_buttons.filter((s) => s !== 'minimize' && s !== 'maximize' && s !== 'close');

        // Add back to right side in order: minimize, maximize, close
        if (show_min_max) {
            right_buttons.push('minimize');
            right_buttons.push('maximize');
        }
        if (show_close) {
            right_buttons.push('close');
        }

        const new_layout = `${left_buttons.join(',')}:${right_buttons.join(',')}`;
        wm.set_string('button-layout', new_layout);
    }
}
