# O-tiling: Agent Documentation

Technical reference for AI agents and contributors working on the **O-tiling** GNOME Shell extension. This document is the authoritative source of truth for the architecture, API compatibility rules, and development conventions of the codebase.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Name | O-tiling |
| Version | 2.4.0 |
| UUID | `o-tiling@oliwebd.github.com` |
| GSettings Schema | `org.gnome.shell.extensions.o-tiling` |
| D-Bus Interface | `org.gnome.shell.extensions.OTiling` |
| D-Bus Path | `/org/gnome/shell/extensions/OTiling` |
| GNOME Shell Support | **49, 50** (Fedora 43 / 44) |
| Fork Heritage | System76 `pop-shell` |
| License | GPLv3 |
| Repository | https://github.com/oliwebd/o-tiling |

**Mission:** A distro-agnostic, EGO-compliant auto-tiling engine for modern GNOME Shell. All System76-specific dependencies (`pop-launcher`, `pop-desktop`, system76-specific D-Bus services) have been removed. The extension runs natively on Fedora, Arch, Debian, Ubuntu, and any other GNOME-based distribution.

---

## 2. GNOME Version Compatibility

This is the most critical section. The codebase supports GNOME **49 and 50** by using runtime-detection shims for every API that changed across this range. When adding new code, never call a version-specific API directly — always use the shim or add one.

### 2.1 API Change Map

| API | GNOME 48 | GNOME 49 | GNOME 50 | How the code handles it |
|---|---|---|---|---|
| `Meta.Window.get_maximized()` | ✅ present | ❌ removed | ❌ removed | `utils.is_maximized()` shim: tries `is_maximized()` first, falls back to `maximized_horizontally || maximized_vertically` |
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
| `get_monitor_neighbor_index()` | ✅ | ✅ | ❌ removed | `shell.ts` wraps it with a full manual adjacency fallback for GNOME 50 |
| X11 session | ✅ | disabled by default | ❌ removed | `utils.is_wayland()` gate on all X11-specific signal paths |

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

---

## 3. Source Layout

```
src/
  extension.ts          — Main Ext class. lifecycle, signals, event dispatch
  auto_tiler.ts         — High-level auto-tiling coordinator
  forest.ts             — Tiling tree world (Forest extends Ecs.World)
  ui/
    workspace_switcher_style.ts — GNOME 50+ workspace overview styling
    theme_consistency/   — Rounded corners logic for GTK/Shell
    panel_settings.ts   — Panel indicator (Indicator class)
  system/
    settings.ts         — ExtensionSettings wrapper over GSettings
    config.ts           — Config file loader
    keybindings.ts      — Keybinding registration/deregistration
  utils/
    utils.ts            — Shared utilities: later_add, maximize, unmaximize, is_wayland
    rectangle.ts        — Rectangle class wrapping Mtk geometry
    log.ts              — Internal logger
  ecs.ts                — Entity-Component-System primitives
  dbus_service.ts       — D-Bus service export
  prefs.ts              — Libadwaita preferences window
```

---

## 4. Core Architecture

### 4.1 Entity-Component-System (ECS)
All windows, forks, and stacks are **entities** (integer IDs). Data lives in **storages**.

### 4.2 Tiling Engine (Forest → Fork → Node)
Layout is a **binary tree** per display/workspace.

---

## 5. Key Subsystems

### 5.1 Aura Focus Border (`src/window.ts`)
Tracks the focused window's frame rect. Uses CSS `border-radius`.

### 5.2 Workspace Switcher Styling (`src/ui/workspace_switcher_style.ts`)
Premium customization for the GNOME 50+ workspace overview.
- **CSS Injection**: Dynamically generates and loads CSS into `St.ThemeContext`.
- **Thumbnail Scaling**: Percentage-based scaling via `ThumbnailsBox._maxThumbnailScale`.
- **Background Blur**: Applies `Shell.BlurEffect` to the `ThumbnailsBox` actor.

### 5.3 Theme Consistency / RoundedShell (`src/ui/theme_consistency/`)
Applies uniform rounded corners across the desktop environment.
- **Shell Components**: Rounds panel, menus, popovers via CSS.
- **GTK Applications**: Injects local CSS into user's GTK configuration.
- **Initialization**: Explicitly applied in `Ext.setup()` to ensure activation on startup.

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

---

*Document Version: 2.4.1 | Updated: May 2026*
