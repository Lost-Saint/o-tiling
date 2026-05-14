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
        let [left, right] = layout.split(":");
        const isRight = right ? true : false;

        // removes controls
        const BTN = ["maximize", "minimize", "close"];
        right = (right ?? "").split(",").filter((s) => !BTN.includes(s));
        left = (left ?? "").split(",").filter((s) => !BTN.includes(s));

        if (show_min_max) {
          if (isRight) {
            right.push("minimize", "maximize");
          } else {
            left = ["minimize", "maximize", ...left];
          }
        }

        if (show_close) {
          if (isRight) {
            right.push("close");
          } else {
            left = ["close", ...left];
          }
        }

        const new_layout = `${left.join(",")}:${right.join(",")}`;
        wm.set_string("button-layout", new_layout);
    }
}
