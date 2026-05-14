# O-tiling: Agent Documentation

Technical reference for AI agents and contributors working on the **O-tiling** GNOME Shell extension. This document is the authoritative source of truth for the architecture, API compatibility rules, and development conventions of the codebase.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Name | O-tiling |
| Version | 2.8.3 |
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
| `get_logical_monitors().is_primary` | ✅ (property always existed) | ✅ | ✅ | Accessed via `(m: any).is_primary` — safe on all targets |
| `Main.modalCount` | deprecated | removed | removed | `is_modal_blocking_focus()` helper in `extension.ts` checks `modalActorFocusStack` first, then `_modalCount`, then returns false |
| `get_monitor_neighbor_index()` | ✅ | ✅ | ❌ removed | `src/engine/tiling.ts` wraps it with a full manual adjacency fallback for GNOME 50 |
| `Meta.is_wayland_compositor()` | ✅ | ✅ | ❌ removed | `utils.is_wayland()` shim: tries `global.context.is_wayland_compositor()`, then `Meta.is_wayland_compositor()`, then env-var detection |
| X11 session | ✅ | disabled by default | ❌ removed | `utils.is_wayland()` gate on all X11-specific signal paths |
| `Shell.BlurMode` | ✅ | ✅ | ✅ | Accessed via `(Shell as any).BlurMode` with graceful fallback if absent |

### 2.2 The Three Mandatory Shims

Never call the underlying APIs directly. Always use these wrappers.

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

**`utils.get_current_time()`** — safe Clutter event timestamp; never use `global.display.get_current_time()` (causes synchronous X11 roundtrip → SIGABRT on Wayland).

---

## 3. Source Layout

```
src/
  extension.ts          — Main entry point — lifecycle, signals, event dispatch
  prefs.ts              — Libadwaita preferences window
  engine/
    auto_tiler.ts       — High-level tiling coordinator
    forest.ts           — Tiling tree world (Forest extends Ecs.World)
    fork.ts             — Fork node — two children + orientation + split ratio
    stack.ts            — Stack container — tabbed windows in one tile slot
    tiling.ts           — Geometry calculation and tile placement
  window/
    window.ts           — ShellWindow — Aura border, restack, actor bindings
    focus.ts            — Focus management and window activation
    movement.ts         — Window move/resize operations
  ui/
    workspace_switcher_style.ts — GNOME 48+ workspace overview styling
    overview_layout.ts  — WorkspaceLayout patch to mirror tile positions in overview
    overview_wallpaper.ts — Frosted-glass blur effect for the Activities overview
    panel_settings.ts   — Panel indicator (Indicator class)
    panel_transparency.ts — CSS-injection panel transparency manager
    theme_consistency/   — Rounded/Sharp corners logic for GTK/Shell
  system/
    window_buttons.ts   — WindowButtonsManager (min/max/close button layout)
    settings.ts         — ExtensionSettings wrapper over GSettings
    config.ts           — Config file loader
    keybindings.ts      — Keybinding registration/deregistration
    executor.ts         — GLib-based event executor
    scheduler.ts        — system76-scheduler foreground-process integration
    dbus_service.ts     — D-Bus service for external focus/window commands
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

### 5.3 Overview Blur Effect (`src/ui/overview_wallpaper.ts`)
Applies a `Shell.BlurEffect` to `BackgroundManager` actors injected into `Main.layoutManager.overviewGroup`. Also injects CSS targeting search results, dash, and app-folder dialogs with frosted-glass styling. Enabled/disabled via GSettings `overview-blur-effect`.

### 5.4 Overview Layout Manager (`src/ui/overview_layout.ts`)
Patches `WorkspaceLayout.prototype._updateWindowPositions` to map each tiled window's actual desktop frame rect into the overview workspace card coordinates, making the overview thumbnail accurately reflect the real tiled layout. Falls back gracefully when `_setTargetRect` is unavailable.

### 5.5 Theme Consistency / RoundedShell (`src/ui/theme_consistency/`)
Applies uniform rounded corners across the desktop environment.
- **Shell Components**: Rounds panel, menus, popovers via CSS (`gnome_shell.ts`).
- **GTK Applications**: Injects local CSS into user's `~/.config/gtk-4.0/gtk.css` and `~/.config/gtk-3.0/gtk.css` (`gtk.ts`). The `apply.ts` module is safe to call from the preferences process (no St/Clutter dependency).
- **Initialization**: Explicitly applied in `Ext.setup()` to ensure activation on startup.

### 5.6 Panel Transparency (`src/ui/panel_transparency.ts`)
CSS-injection manager that makes the GNOME panel transparent or semi-transparent.
- Injects a temp CSS file into `St.ThemeContext` (same lifecycle pattern as other managers).
- Supports configurable opacity (0–100%), blur-style dark gradient backdrop, and hot-reload on setting change without full disable/enable cycle.
- Fully EGO-compliant: temp file is deleted on `disable()`.

### 5.7 Window Buttons Manager (`src/system/window_buttons.ts`)
Manages the global GNOME button layout (Minimize, Maximize, Close).
- **Synchronization**: Bridges extension settings to the `org.gnome.desktop.wm.preferences` schema.
- **Cleanup**: Restores default layout and disconnects signals on extension disable.

### 5.8 Extension Soft Disable
Halt-mode implemented in `extension.ts` using the `_ext_soft_disabled` flag.
- **Functionality**: Disables all tiling, keybindings, and injections without removing the panel indicator.
- **State Recovery**: Re-enabling the extension triggers a full re-tiling of the current workspace.

> **⚠️ Bug fixed in 2.8.3:** `ext_soft_disable()` previously contained `const indicator = (PanelSettings as any).indicator` which shadowed the module-level `indicator` with `undefined` (since `panel_settings.ts` exports no `indicator` instance). The toggle state in the panel menu was never updated on soft-disable. Fix: remove the shadowing local declaration and use the module-level `indicator` directly.

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

---

*Document Version: 2.8.3 | Updated: May 14, 2026*
