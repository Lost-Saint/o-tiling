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

    return `
/* === O-Tiling: COSMIC-style Workspace Switcher (GNOME 50) === */

/* Full-width top bar */
.workspace-thumbnails {
    background-color: rgba(18, 18, 24, 0.92);
    padding: 12px 16px;
    spacing: 12px;
    border-radius: 0px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.thumbnails-box {
    background-color: transparent;
}

/* Individual workspace card */
.workspace-thumbnail {
    border-radius: ${thumbnailCornerRadius}px !important;
    border: 3px solid transparent;
    transition-duration: 200ms;
}

.workspace-thumbnail-background {
    border-radius: ${thumbnailCornerRadius}px !important;
    /* Do NOT set background-color here — it hides the wallpaper render.
       Leave it transparent so the actual workspace wallpaper shows through. */
    background-color: transparent;
}

/* Active card gets accent color border */
.workspace-thumbnail:focus,
.workspace-thumbnail.selected {
    border-color: ${activeColor} !important;
    border-width: 3px !important;
}

/* Hover state */
.workspace-thumbnail:hover {
    border-color: rgba(255, 255, 255, 0.25) !important;
    background-color: rgba(255, 255, 255, 0.06);
}

/* Workspace label always visible below each card */
.workspace-label {
    color: rgba(255, 255, 255, 0.85);
    font-size: 12px;
    font-weight: 600;
    text-align: center;
    padding-top: 6px;
}

/* Overview workspace background corner */
.workspace-background {
    border-radius: ${bgCornerSize}px !important;
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
    private _workspaceChangedId: number | null = null;

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
                this._setupAutoScroll();
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
        this._teardownAutoScroll();
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
            } catch (_) { }
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
        } catch (_) { }
        this._origMaxThumbnailScale = null;
    }

    private _setupAutoScroll(): void {
        const workspace_manager = (global as any).workspace_manager;
        this._workspaceChangedId = workspace_manager.connect('active-workspace-changed', () => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._scrollToActiveWorkspace();
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    private _scrollToActiveWorkspace(): void {
        try {
            const thumbnailsBox = (Main as any).overview?._overview?._controls?._thumbnailsBox;
            if (!thumbnailsBox) return;

            const workspace_manager = (global as any).workspace_manager;
            const activeIndex = workspace_manager.get_active_workspace_index();

            if (typeof thumbnailsBox._scrollToActive === 'function') {
                thumbnailsBox._scrollToActive();
                return;
            }

            const children = thumbnailsBox.get_children();
            const child = children[activeIndex];
            if (!child) return;

            const box = child.get_allocation_box();
            const childCenter = (box.x1 + box.x2) / 2;

            const scroll = thumbnailsBox.get_parent();
            if (!scroll || !scroll.get_hadjustment) return;

            const adjustment = scroll.get_hadjustment();
            const pageSize = adjustment.page_size;
            adjustment.value = childCenter - pageSize / 2;
        } catch (e) {
            console.warn('WorkspaceSwitcherStyle: _scrollToActiveWorkspace failed', e);
        }
    }

    private _teardownAutoScroll(): void {
        if (this._workspaceChangedId !== null) {
            (global as any).workspace_manager.disconnect(this._workspaceChangedId);
            this._workspaceChangedId = null;
        }
    }
}
