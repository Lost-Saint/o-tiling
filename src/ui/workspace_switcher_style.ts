import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import { PACKAGE_VERSION } from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Utils from '../utils/utils.js';

// ── Version gate ─────────────────────────────────────────────────────────────

/** Returns true when running on GNOME Shell 50 or newer. */
export function isGnome50(): boolean {
    try {
        const major = parseInt(PACKAGE_VERSION.split('.')[0], 10);
        return major >= 50;
    } catch (_) {
        return false;
    }
}

// ── CSS builder ──────────────────────────────────────────────────────────────

/**
 * Builds the full CSS string for the workspace switcher bar.
 *
 * Targets confirmed GNOME 50 selectors:
 *   .workspace-thumbnails         – the horizontal strip container
 *   .workspace-thumbnail          – individual workspace preview cards
 *   .workspace-thumbnail:focus    – active / focused card
 */
function buildCss(accentColor: string, thumbnailCornerRadius: number, bgCornerSize: number): string {
    // Determine the effective accent color; fallback to GNOME blue if 'auto' or invalid.
    const activeColor = (accentColor === 'auto' || !Utils.isValidColor(accentColor))
        ? '#3584e4'
        : accentColor;

    const bgTint = Utils.set_alpha(activeColor, 0.08);
    const hoverTint = Utils.set_alpha(activeColor, 0.20);

    return `
/* === O-Tiling: Workspace Switcher Style (GNOME 50) === */

/* ── Workspace background corner (overview) ────────────── */
.workspace-background {
    border-radius: ${bgCornerSize}px !important;
}

/* ── Thumbnails container ──────────────────────────────── */
.workspace-thumbnails {
    background-color: rgba(0, 0, 0, 0.25);
    border-radius: 16px;
    padding: 6px 12px;
    spacing: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
}

.thumbnails-box {
    /* Critical for clipping the blur effect and ensuring clean corners */
    border-radius: 16px;
    background-clip: padding-box;
    overflow: hidden;
}

/* ── Individual workspace cards ────────────────────────── */
.workspace-thumbnail {
    border-radius: ${thumbnailCornerRadius}px;
    border: 2px solid transparent;
    transition-duration: 150ms;
}

.workspace-thumbnail-background {
    border-radius: ${thumbnailCornerRadius}px;
}

/* ── Interaction states ────────────────────────────────── */
.workspace-thumbnail:hover {
    background-color: ${bgTint};
}

.workspace-thumbnail:focus,
.workspace-thumbnail.selected {
    border-color: ${activeColor};
    background-color: ${hoverTint};
}

/* ── Workspace label ───────────────────────────────────── */
.workspace-thumbnail .workspace-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.75);
}
`;
}


// ── WorkspaceSwitcherStyle ────────────────────────────────────────────────────

export class WorkspaceSwitcherStyle {
    private _file: Gio.File | null = null;
    private _accentColor: string;
    private _thumbnailCornerRadius: number;
    private _switcherSize: number;      // percent (5-25)
    private _bgCornerSize: number;       // pixels (0-60)
    private _blurEffect: any = null;
    private _origMaxThumbnailScale: number | null = null;

    constructor(
        accentColor: string,
        thumbnailCornerRadius: number,
        switcherSize: number,
        bgCornerSize: number,
    ) {
        this._accentColor = accentColor;
        this._thumbnailCornerRadius = thumbnailCornerRadius;
        this._switcherSize = switcherSize;
        this._bgCornerSize = bgCornerSize;
    }

    /** Injects custom CSS into the Shell theme. No-op if already enabled. */
    enable(): void {
        if (this._file) return;
 
        const css = buildCss(this._accentColor, this._thumbnailCornerRadius, this._bgCornerSize);
        const path = `/tmp/o-tiling-ws-style-${GLib.get_monotonic_time()}.css`;

        try {
            GLib.file_set_contents(path, css);
            this._file = Gio.File.new_for_path(path);
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;

            if (theme) {
                theme.load_stylesheet(this._file);
                this._applyBlur();
                this._applyThumbnailScale();
            } else {
                console.warn('WorkspaceSwitcherStyle: could not find theme to load stylesheet');
                this._file = null;
            }
        } catch (e) {
            console.error('WorkspaceSwitcherStyle: failed to load CSS', e);
            this._file = null;
        }
    }

    /** Removes the injected CSS from the Shell theme. */
    disable(): void {
        if (!this._file) return;

        try {
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;

            if (theme) {
                theme.unload_stylesheet(this._file);
                this._removeBlur();
                this._restoreThumbnailScale();
            }
            this._file.delete(null);
        } catch (_) { /* best-effort */ }

        this._file = null;
    }

    /** Hot-updates the accent colour. */
    updateAccentColor(rgba: string): void {
        this._accentColor = rgba;
        this._refresh();
    }

 
    /** Hot-updates the thumbnail corner radius. */
    updateThumbnailCornerRadius(radius: number): void {
        this._thumbnailCornerRadius = radius;
        this._refresh();
    }

    /** Hot-updates the workspace switcher size (percentage). */
    updateSwitcherSize(percent: number): void {
        this._switcherSize = percent;
        this._applyThumbnailScale();
    }

    /** Hot-updates the workspace background corner radius. */
    updateBgCornerSize(px: number): void {
        this._bgCornerSize = px;
        this._refresh();
    }

    private _refresh(): void {
        if (this._file) {
            this.disable();
            this.enable();
        }
    }

    /** True while the CSS is currently injected. */
    get isEnabled(): boolean {
        return this._file !== null;
    }

    private _applyBlur(): void {
        if (!isGnome50()) return;

        try {
            const thumbnailsBox = (Main as any).overview?._overview?._controls?._thumbnailsBox;
            if (thumbnailsBox && !this._blurEffect) {
                this._blurEffect = new Shell.BlurEffect({
                    brightness: 0.6,
                    radius: 60,
                    mode: Shell.BlurMode.BACKGROUND,
                });
                thumbnailsBox.add_effect_with_name('o-tiling-blur', this._blurEffect);
            }
        } catch (e) {
            console.warn('WorkspaceSwitcherStyle: failed to apply blur effect', e);
        }
    }

    private _removeBlur(): void {
        if (this._blurEffect) {
            try {
                const thumbnailsBox = (Main as any).overview?._overview?._controls?._thumbnailsBox;
                if (thumbnailsBox) {
                    thumbnailsBox.remove_effect_by_name('o-tiling-blur');
                }
            } catch (_) {}
            this._blurEffect = null;
        }
    }

    /**
     * Applies the percentage-based scale to ThumbnailsBox._maxThumbnailScale,
     * mirroring what Just Perfection's workspaceSwitcherSetSize() does.
     */
    private _applyThumbnailScale(): void {
        if (!isGnome50()) return;
        try {
            const thumbnailsBox = (Main as any).overview?._overview?._controls?._thumbnailsBox;
            if (!thumbnailsBox) return;

            const scale = this._switcherSize / 100;

            if (this._origMaxThumbnailScale === null) {
                this._origMaxThumbnailScale = thumbnailsBox._maxThumbnailScale ?? null;
            }

            thumbnailsBox._maxThumbnailScale = scale;
            // Force a layout update
            thumbnailsBox.queue_relayout?.();
        } catch (e) {
            console.warn('WorkspaceSwitcherStyle: failed to set thumbnail scale', e);
        }
    }

    /** Restores the original _maxThumbnailScale on disable. */
    private _restoreThumbnailScale(): void {
        if (!isGnome50()) return;
        try {
            const thumbnailsBox = (Main as any).overview?._overview?._controls?._thumbnailsBox;
            if (thumbnailsBox && this._origMaxThumbnailScale !== null) {
                thumbnailsBox._maxThumbnailScale = this._origMaxThumbnailScale;
                thumbnailsBox.queue_relayout?.();
            }
        } catch (_) {}
        this._origMaxThumbnailScale = null;
    }
}
