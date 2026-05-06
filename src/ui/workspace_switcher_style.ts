import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import { PACKAGE_VERSION } from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

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
function buildCss(accentColor: string, thumbnailHeight: number): string {
    const bgTint = accentColorToTint(accentColor, 0.08);
    const glowTint = accentColorToTint(accentColor, 0.22);

    return `
/* === O-Tiling: Workspace Switcher Style (GNOME 50) === */

/* ── Thumbnails container ──────────────────────────────── */
.workspace-thumbnails {
    background-color: rgba(0, 0, 0, 0.45);
    border-radius: 16px;
    padding: 10px 14px;
    spacing: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    height: auto;
}

/* ── Individual workspace cards ────────────────────────── */
.workspace-thumbnail {
    height: ${thumbnailHeight}px;
    border-radius: 10px;
    border: 2px solid transparent;
    transition-duration: 180ms;
    transition-property: border-color, background-color, box-shadow;
}

/* ── Inactive card hover ───────────────────────────────── */
.workspace-thumbnail:hover {
    border-color: rgba(255, 255, 255, 0.18);
    background-color: ${bgTint};
}

/* ── Active / focused card ─────────────────────────────── */
.workspace-thumbnail:focus,
.workspace-thumbnail.selected {
    border-color: ${accentColor};
    background-color: ${glowTint};
    box-shadow: 0 0 0 2px ${glowTint};
}

/* ── Workspace label (if shown) ────────────────────────── */
.workspace-thumbnail .workspace-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.75);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
`;
}

/**
 * Converts an rgba() or hex color string into a rgba() with the given alpha.
 */
function accentColorToTint(rgba: string, alpha: number): string {
    const match = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
        return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    }
    return `rgba(255, 255, 255, ${alpha})`;
}

// ── WorkspaceSwitcherStyle ────────────────────────────────────────────────────

export class WorkspaceSwitcherStyle {
    private _provider: any | null = null;
    private _accentColor: string;
    private _thumbnailHeight: number;

    constructor(accentColor: string, thumbnailHeight: number) {
        this._accentColor = accentColor;
        this._thumbnailHeight = thumbnailHeight;
    }

    /** Injects custom CSS into the Shell theme. No-op if already enabled. */
    enable(): void {
        if (this._provider) return;

        // Try standard constructor
        try {
            this._provider = new (St as any).CssProvider();
        } catch (e) {
            console.error('WorkspaceSwitcherStyle: failed to create CssProvider', e);
            return;
        }

        const css = buildCss(this._accentColor, this._thumbnailHeight);

        try {
            // Modern GNOME uses load_from_string
            if (typeof this._provider.load_from_string === 'function') {
                this._provider.load_from_string(css);
            } else {
                this._provider.load_from_data(css, css.length);
            }
        } catch (e) {
            console.error('WorkspaceSwitcherStyle: failed to load CSS', e);
            this._provider = null;
            return;
        }

        try {
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;
            
            if (theme) {
                theme.add_provider(this._provider, 999 /* Higher priority */);
            } else {
                console.warn('WorkspaceSwitcherStyle: could not find theme to add provider');
            }
        } catch (e) {
            console.error('WorkspaceSwitcherStyle: failed to add provider to theme', e);
        }
    }

    /** Removes the injected CSS from the Shell theme. */
    disable(): void {
        if (!this._provider) return;

        try {
            const theme = St.ThemeContext.get_for_stage(
                (global as any).stage as Clutter.Stage,
            ).get_theme() as any;
            
            if (theme) {
                theme.remove_provider(this._provider);
            }
        } catch (_) { /* best-effort */ }

        this._provider = null;
    }

    /** Hot-updates the accent colour. */
    updateAccentColor(rgba: string): void {
        this._accentColor = rgba;
        this._refresh();
    }

    /** Hot-updates the thumbnail height. */
    updateThumbnailHeight(height: number): void {
        this._thumbnailHeight = height;
        this._refresh();
    }

    private _refresh(): void {
        if (this._provider) {
            this.disable();
            this.enable();
        }
    }

    /** True while the CSS is currently injected. */
    get isEnabled(): boolean {
        return this._provider !== null;
    }
}
