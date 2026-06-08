# O-tiling: Agent Documentation

Technical reference for AI agents and contributors working on the **O-tiling** GNOME Shell extension. This document is the authoritative source of truth for the architecture, API compatibility rules, and development conventions of the codebase.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Name | O-tiling |
| Version | 2.8.13 |
| UUID | `o-tiling@oliwebd.github.com` |
| GSettings Schema | `org.gnome.shell.extensions.o-tiling` |
| D-Bus Interface | `org.gnome.shell.extensions.OTiling` |
| D-Bus Path | `/org/gnome/shell/extensions/OTiling` |
| GNOME Shell Support | **48, 49, 50** (Fedora 42 / 43 / 44) |
| Fork Heritage | System76 `pop-shell` |
| License | GPLv3 |
| Repository | https://github.com/oliwebd/o-tiling |

**Mission:** Auto-tiling engine for modern GNOME Shell. The extension runs natively on Fedora, Arch, Debian, Ubuntu, and any other GNOME-based distribution.

---

## 2. GNOME Version Compatibility

This is the most critical section. The codebase supports GNOME **48, 49 and 50** by using runtime-detection shims for every API that changed across this range. When adding new code, never call a version-specific API directly — always use the shim or add one.

### 2.1 API Change Map

| API | GNOME 48 | GNOME 49 | GNOME 50 | How the code handles it |
|---|---|---|---|---|
| `Meta.Window.get_maximized()` | ✅ present | ❌ removed | ❌ removed | `utils.is_maximized()` shim: tries `is_maximized()` first, falls back to `maximized_horizontally \|\| maximized_vertically` |
| `Meta.Window.is_maximized()` | ❌ absent | ✅ added | ✅ present | Same shim — detected via `typeof` check |
| `Meta.Window.maximize(flags)` | ✅ takes flags | ❌ flags removed | ❌ flags removed | `utils.maximize()` shim: tries `set_maximize_flags()` + `maximize()` (49+), falls back to `maximize(flags)` (48), last resort `maximize()` |
| `Meta.Window.unmaximize(flags)` | ✅ takes flags | ❌ flags removed | ❌ flags removed | `utils.unmaximize()` shim — same pattern |
| `Meta.Rectangle` | deprecated | ❌ removed | ❌ removed | Replaced entirely with `Mtk.Rectangle` (available GNOME 45+) |
| `Mtk.Rectangle` | ✅ (GNOME 45+) | ✅ | ✅ | Used directly — safe on all targets |
| `Meta.later_add()` | ✅ present | ⚠️ unreliable | ❌ removed | `utils.later_add()` shim: tries `compositor.get_laters().add()` first, then `Meta.later_add()`, then `GLib.idle_add()` as last-resort fallback |
| `backend.get_monitor_manager()` | ✅ (GNOME 40+) | ✅ | ✅ | Used directly with `?.` optional chaining throughout |
| `backend.get_current_logical_monitor()` | ❌ absent | ✅ added | ✅ | All call sites use `?.get_number() ?? 0` — falls back to monitor 0 on GNOME 48 |
| `get_logical_monitors().is_primary` | ⚠️ method, not property | ⚠️ method | ⚠️ method | Avoid checking properties; use `display.get_primary_monitor()` index instead |
| `Main.modalCount` | deprecated | removed | removed | `is_modal_blocking_focus()` helper in `extension.ts` checks `modalActorFocusStack` first, then `_modalCount`, then returns false |
| `get_monitor_neighbor_index()` | ✅ | ✅ | ❌ removed | `src/engine/tiling.ts` wraps it with a full manual adjacency fallback for GNOME 50 |
| `Meta.is_wayland_compositor()` | ✅ | ✅ | ❌ removed | `utils.is_wayland()` shim: tries `global.context.is_wayland_compositor()`, then `Meta.is_wayland_compositor()`, then env-var detection |
| X11 session | ✅ | disabled by default | ❌ removed | `utils.is_wayland()` gate on all X11-specific signal paths |
| `Shell.BlurMode` | ✅ | ✅ | ✅ | Accessed via `(Shell as any).BlurMode` with graceful fallback if absent |

### 2.2 EGO-Compliant Feature Detection

To satisfy EGO review requirements, avoid wrapping runtime capability checks in blind `try-catch` blocks. Instead, verify the existence of APIs directly using feature detection (e.g. `typeof` checks).

**`utils.is_wayland()`** check:
```typescript
if (typeof (global as any).context?.is_wayland_compositor === 'function') {
    return (global as any).context.is_wayland_compositor();
}
```

**`utils.later_add(type, action)`** — deferred callback scheduling:
```typescript
// Correct
utils.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
    // safe to modify actors here
    return GLib.SOURCE_REMOVE;
});
```

**`utils.maximize(win.meta)` / `utils.unmaximize(win.meta)`** — window maximize/unmaximize.

**`utils.is_maximized(win.meta)` / `win.is_maximized()`** — maximize state check.

**`utils.get_current_time()`** — safe Clutter event timestamp; returns `Clutter.get_current_event_time()`. Never use `global.display.get_current_time()` as it triggers a synchronous X11 roundtrip, which is forbidden on the compositor thread and causes SIGABRT on Wayland. Mutter accepts `0` (CurrentTime) gracefully.

---

## 3. Source Layout

```
src/
  extension.ts          — Main entry point — lifecycle, signals, event dispatch
  prefs.ts              — Libadwaita preferences window (fixed 720x650 panel, close button layout)
  engine/
    auto_tiler.ts       — High-level tiling coordinator
    forest.ts           — Tiling tree world (Forest extends Ecs.World)
    fork.ts             — Fork node — two children + orientation + split ratio + left-pinning
    presets.ts          — Tiling presets: Columns, Stacked, Grid, Spiral
    stack.ts            — Stack container — tabbed windows in one tile slot
    tiling.ts           — Geometry calculation and tile placement
  window/
    window.ts           — ShellWindow — Aura border, restack, actor bindings, border timeout sets
    focus.ts            — Focus management and window activation
    movement.ts         — Window move/resize operations
  ui/
    workspace_switcher_style.ts — GNOME 48+ workspace overview styling
    overview_layout.ts  — WorkspaceLayout patch to mirror tile positions in overview
    panel_settings.ts   — Panel indicator (Indicator class with layouts/presets UI)
    panel_transparency.ts — CSS-injection panel transparency manager
    theme_consistency/   — Rounded/Sharp corners logic for GTK/Shell
    dialog_add_exception.ts — Modal dialog for adding floating window exceptions
  system/
    window_buttons.ts   — WindowButtonsManager (min/max/close button layout)
    settings.ts         — ExtensionSettings wrapper over GSettings
    config.ts           — Config file loader
    keybindings.ts      — Keybinding registration/deregistration
    executor.ts         — GLib-based event executor
    scheduler.ts        — system76-scheduler foreground-process integration
    dbus_service.ts     — D-Bus service for external focus/window commands
  floating_exceptions/
    config.ts           — Exception configurations and rules storage
    main.ts             — Class/Title exceptions parser and matcher
  core/
    ecs.ts              — Entity-Component-System primitives
    events.ts           — Event tagging and data structures
    arena.ts            — Hop-slot arena allocator (used by Stack container)
  utils/
    utils.ts            — Shared utilities: later_add, maximize, unmaximize, is_wayland
    rectangle.ts        — Rectangle class wrapping Mtk geometry
    log.ts              — Internal logger
    geom.ts             — Geometric math and intersection checks
    lib.ts              — Miscellaneous Shell helpers (cursor_rect, orientation, etc.)
    paths.ts            — Extension root path resolution via import.meta.url
```

---

## 4. Core Architecture

### 4.1 Entity-Component-System (ECS)
All windows, forks, and stacks are **entities** (integer IDs). Data lives in **storages**.

### 4.2 Tiling Engine (Forest → Fork → Node)
Layout is a **binary tree** per display/workspace.

---

## 5. Key Subsystems

### 5.1 Aura Focus Border (`src/window/window.ts`)
Tracks the focused window's frame rect. Uses CSS `border-style: solid` with configurable `border-radius`, `border-width`, and optional `box-shadow` glow. The border actor is inserted into the same Clutter parent as the window actor and is animated with `Clutter.AnimationMode.EASE_OUT_QUAD` on move/resize. Border position is **never** set from origin on subsequent moves — it eases smoothly.

### 5.2 Workspace Switcher Styling (`src/ui/workspace_switcher_style.ts`)
Premium customization for the GNOME 48+ workspace overview.
- **CSS Injection**: Dynamically generates and loads CSS into `St.ThemeContext`.
- **Thumbnail Scaling**: Percentage-based auto-scaling via patching `ThumbnailsBox._updateMaxThumbnailScale`. The patch keeps the scale sticky so Shell cannot override it. Auto-shrinks when workspaces exceed available width.
- **Centering**: Horizontal centering of the thumbnails strip via `Clutter.ActorAlign.CENTER`.
- **Transparency**: Fully transparent background to integrate with the Shell theme.
- **Background Corners**: Programmatically overrides `_updateBorderRadius` on `WorkspaceBackground` to apply `rounded_clip_radius` to the wallpaper content in the overview.
- **Auto-scroll**: Connects to `active-workspace-changed`, `workspace-added`, and `workspace-removed` to rescale and scroll-to-active on every change.

### 5.3 Overview Layout Manager (`src/ui/overview_layout.ts`)
Patches `WorkspaceLayout.prototype._updateWindowPositions` to map each tiled window's actual desktop frame rect into the overview workspace card coordinates, making the overview thumbnail accurately reflect the real tiled layout. Falls back gracefully when `_setTargetRect` is unavailable.

### 5.4 Theme Consistency / RoundedShell (`src/ui/theme_consistency/`)
Applies uniform rounded corners across the desktop environment.
- **Shell Components**: Rounds panel, menus, popovers via CSS (`gnome_shell.ts`).
- **GTK Applications**: Injects local CSS into user's `~/.config/gtk-4.0/gtk.css` and `~/.config/gtk-3.0/gtk.css` (`gtk.ts`). The `apply.ts` module is safe to call from the preferences process (no St/Clutter dependency).
- **Initialization**: Explicitly applied in `Ext.setup()` to ensure activation on startup.

### 5.5 Panel Transparency (`src/ui/panel_transparency.ts`)
CSS-injection manager that makes the GNOME panel transparent or semi-transparent.
- Injects a temp CSS file into `St.ThemeContext` (same lifecycle pattern as other managers).
- Supports configurable opacity (0–100%), and hot-reload on setting change without full disable/enable cycle.
- Fully EGO-compliant: temp file is deleted on `disable()`.

### 5.6 Window Buttons Manager (`src/system/window_buttons.ts`)
Manages the global GNOME button layout (Minimize, Maximize, Close).
- **Synchronization**: Bridges extension settings to the `org.gnome.desktop.wm.preferences` schema.
- **Cleanup**: Restores default layout and disconnects signals on extension disable.

### 5.7 Extension Soft Disable
Halt-mode implemented in `extension.ts` using the `_ext_soft_disabled` flag.
- **Functionality**: Disables all tiling, keybindings, and injections without removing the panel indicator.
- **State Recovery**: Re-enabling the extension triggers a full re-tiling of the current workspace.

### 5.8 Large Window Handling (Floating Exceptions)
Windows with large minimum size constraints (e.g., GNOME System Monitor) are handled via **Floating Window Exceptions**. The extension relies on standard upstream behavior (allowing the window to overlap if tiled in a space that is too small) and expects the user to either toggle the window to floating mode or add its WM_CLASS to the exception list.

### 5.9 Layout Presets (`src/engine/presets.ts`)
Users can apply pre-defined binary tree layouts to workspaces with 2 to 6 windows:
- **Columns**: Cascades windows horizontally.
- **Stacked**: Cascades windows vertically.
- **Grid**: Places windows in a balanced grid (e.g. 2x2 for 4 windows).
- **Spiral**: Places windows recursively in alternating horizontal and vertical splits.

### 5.10 Lock Master Window (`src/engine/fork.ts`)
Locks the left branch (master window or sub-tree) of the workspace's toplevel fork.
- Sets `left_pinned = true` on the toplevel fork.
- Enforces a minimum size of 35% (`LEFT_PIN_MIN_RATIO = 0.35`) for the left branch.
- Prevents windows from being pushed out or swapped into the left master slot, preserving the layout split during resizing or snapping.

### 5.11 Drag-and-Swap Zone (`src/engine/auto_tiler.ts`)
Dragging a window to the center (middle 40% area) of another window triggers a direct swap (`attach_swap`) instead of a side split.

### 5.12 Top Smart Gap (`src/extension.ts`)
Provides a customizable `panel-top-gap` setting. When the panel is transparent (panel-transparency enabled and opacity is 0), the top side of the outer gap is replaced by the custom top gap value. This allows tiled windows to align closer to the top screen edge when the panel is invisible.

### 5.13 EGO Compliance & Memory Management
- **Redundant try-catch blocks** are forbidden. Always use direct type checks (`typeof`) for capability detection.
- **Panel Hover Guard**: Focus changes to a panel actor (detected via `clutter_focus_is_shell_panel()`) do not trigger active hint border hide/show cycles, preventing flickering.
- **Timeout Cleanup**: Timeout source IDs (like `show_border` callbacks) are tracked globally in `ACTIVE_HINT_SHOW_IDS` and explicitly removed on extension disable to avoid memory leaks.
- **Compositor Double-Commits**: Removed secondary `move_frame` call in the tiling path; `move_resize_frame` is sufficient to move and resize windows atomically on Mutter 18+.

---

## 6. Build System
**Package manager:** `pnpm` | **Compiler:** `tsc` (strict, ESNext)

---

## 7. Known Issues & Historical Fixes

### Bug A — `signals_attach()` and `auto_tile_on()` Leaking AutoTiler
- **Fix:** Ensure previous `AutoTiler` is destroyed before creating a new one.

### Bug B — `resume()` Double Execution on GNOME 49+
- **Fix:** Maintain a `_signals_attached` guard to prevent duplicate signal registrations.

### Bug C — Active Hint Border Ghosting on Suspend/Resume
- **Fix:** Cancel pending render loops and verify `actor.mapped` before showing borders.

### Bug D — Broken Rounded Corners on Thumbnails
- **Fix:** Explicitly set `overflow: hidden` on `.workspace-thumbnail` and apply `border-radius` to the internal background to prevent sharp corners from showing through.

### Bug E — First-Launch Tiling Failure
- **Fix:** Added defensive fallbacks in 'first-frame' window initialization and handled missing `OverviewHidden` events to rehydrate focus state.

### Bug F — Missing Text in Preferences for Minimize/Maximize
- **Fix:** Replaced ampersand (`&`) with "and" in `Adw.SwitchRow` titles to prevent rendering issues in certain GTK/Libadwaita environments.

### Bug G — `ext_soft_disable()` Panel Toggle Not Updating
- **Fix:** Removed `const indicator = (PanelSettings as any).indicator` which always resolved to `undefined` (shadowing the module-level `indicator`). Now uses the module-level variable directly so the panel menu toggle reflects the actual disabled state.

### Bug H — `GLibExecutor.stop()` SIGABRT on `later_remove` / `source_remove` Mismatch
- **Fix:** Track `#used_laters` flag; call `utils.later_remove()` only when the loop was created via `Meta.later_add()`, and `GLib.source_remove()` only when created via `GLib.idle_add()`.

### Bug I — Synchronous X11 Roundtrip on Focus (scheduler.ts)
- **Fix:** `setForeground()` now does a single async name-owner check on first call; subsequent calls skip entirely if the scheduler service is absent, preventing `meta_x11_display_get_current_time_roundtrip` from blocking the compositor thread.

### Bug J — Large Window Layout Overlap (GNOME System Monitor, etc.)
- **Issue:** Applications with a hard-coded minimum size that exceeds the allocated tile split (e.g., GNOME System Monitor requiring > 600px) will visually overlap other tiles.
- **Cause:** To prevent infinite resize loops and crashes (which occurred in previous Auto-Swap implementations), O-Tiling enforces a minimum split size of 256px and does not auto-correct windows that refuse to shrink. This mirrors the upstream Pop Shell stability approach.
- **Resolution:** This is a known architectural limitation. Users should add the problematic application's `WM_CLASS` to the **Floating Exceptions** list or use Adjustment Mode (`Super + Enter`) to manually resize the tile grid to accommodate the window.

### Bug K — Source ID Not Found Warnings
- **Fix:** Timeout callback handlers verify source ID matching before nulling references or calling `GLib.source_remove()` to prevent redundant source removals.

### Bug L — Active Hint Border Flickering on Panel Hover
- **Fix:** Implemented `clutter_focus_is_shell_panel()` to keep active border drawn when hover focus drifts to Shell panel actors.

### Bug M — Redundant Compositor Commits in Mutter 18 / GNOME 50
- **Fix:** Removed redundant `move_frame()` call following `move_resize_frame()` in window positioning path.

### Bug N — EGO Reject: Redundant Try-Catch Blocks
- **Fix:** Audited codebase and replaced empty/blind try-catch blocks with clean capability checks.

### Bug O — Floating Exception Class Name Matching
- **Fix:** Corrected window class matching in the exceptions dialog to ensure dialog windows like "Floating Window Exceptions" float by default.

---

*Document Version: 2.8.13 | Updated: June 9, 2026*
