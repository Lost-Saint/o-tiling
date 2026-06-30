import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export type WindowAnimationStyle = 'default' | 'hyprland' | 'none';

export class WindowAnimationManager {
    private _style: WindowAnimationStyle;
    private _duration: number;
    private _enabled = false;

    private _origMapWindow = (Main.wm as any)._mapWindow;
    private _origDestroyWindow = (Main.wm as any)._destroyWindow;
    private _origSizeChangedWindow = (Main.wm as any)._sizeChangedWindow;

    constructor(style: WindowAnimationStyle = 'default', duration: number = 200) {
        this._style = style;
        this._duration = duration;
    }

    enable(): void {
        if (this._enabled) return;
        this._enabled = true;
        if (this._style === 'hyprland') this._patchHyprland();
    }

    disable(): void {
        if (!this._enabled) return;
        this._enabled = false;
        (Main.wm as any)._mapWindow = this._origMapWindow;
        (Main.wm as any)._destroyWindow = this._origDestroyWindow;
        (Main.wm as any)._sizeChangedWindow = this._origSizeChangedWindow;
    }

    setStyle(style: WindowAnimationStyle): void {
        if (style === this._style) return;
        const was_enabled = this._enabled;
        if (was_enabled) this.disable();
        this._style = style;
        if (was_enabled) this.enable();
    }

    get style(): WindowAnimationStyle {
        return this._style;
    }

    applyMove(actor: Clutter.Actor, x: number, y: number, width: number, height: number, commit: () => void): void {
        actor.remove_all_transitions();

        if (this._style === 'none') {
            commit();
            return;
        }

        const same_size = actor.width === width && actor.height === height;
        if (!same_size) {
            commit();
            return;
        }

        const mode = this._style === 'hyprland' ? Clutter.AnimationMode.EASE_OUT_EXPO : Clutter.AnimationMode.EASE_OUT_CUBIC;
        commit();
        actor.translation_x = actor.x - x;
        actor.translation_y = actor.y - y;
        (actor as any).ease({
            translation_x: 0,
            translation_y: 0,
            duration: this._duration,
            mode,
        });
    }

    private _patchHyprland(): void {
        const duration = this._duration;

        (Main.wm as any)._mapWindow = function (this: any, shellwm: any, actor: any) {
            const types = [Meta.WindowType.NORMAL, Meta.WindowType.MODAL_DIALOG, Meta.WindowType.DIALOG];
            if (!this._shouldAnimateActor(actor, types)) {
                shellwm.completed_map_animation(actor);
                return;
            }

            actor.set_scale(0.85, 0.85);
            actor.set_opacity(0);
            actor.show();

            actor.ease({
                opacity: 255,
                scale_x: 1,
                scale_y: 1,
                duration,
                mode: Clutter.AnimationMode.EASE_OUT_BACK,
                onStopped: () => shellwm.completed_map_animation(actor),
            });
        };

        (Main.wm as any)._destroyWindow = function (this: any, shellwm: any, actor: any) {
            const types = [Meta.WindowType.NORMAL, Meta.WindowType.MODAL_DIALOG, Meta.WindowType.DIALOG];
            if (!this._shouldAnimateActor(actor, types)) {
                shellwm.completed_destroy(actor);
                return;
            }

            actor.set_pivot_point(0.5, 0.5);
            actor.ease({
                opacity: 0,
                scale_x: 0.85,
                scale_y: 0.85,
                duration: Math.round(duration * 0.8),
                mode: Clutter.AnimationMode.EASE_IN_CUBIC,
                onStopped: () => shellwm.completed_destroy(actor),
            });
        };

        (Main.wm as any)._sizeChangedWindow = function (this: any, shellwm: any, actor: any) {
            if (!actor.__animationInfo) return;
            if (this._resizing.has(actor)) return;

            const target_rect = actor.meta_window.get_frame_rect();
            const source_rect = actor.__animationInfo.oldRect;
            const actor_clone = actor.__animationInfo.clone;

            const scale_x = target_rect.width / source_rect.width;
            const scale_y = target_rect.height / source_rect.height;

            this._resizePending.delete(actor);
            this._resizing.add(actor);

            Main.uiGroup.add_child(actor_clone);
            actor_clone.ease({
                x: target_rect.x,
                y: target_rect.y,
                scale_x,
                scale_y,
                opacity: 0,
                duration,
                mode: Clutter.AnimationMode.EASE_OUT_BACK,
            });

            actor.translation_x = -target_rect.x + source_rect.x;
            actor.translation_y = -target_rect.y + source_rect.y;
            actor.scale_x = 1 / scale_x;
            actor.scale_y = 1 / scale_y;

            actor.ease({
                scale_x: 1,
                scale_y: 1,
                translation_x: 0,
                translation_y: 0,
                duration,
                mode: Clutter.AnimationMode.EASE_OUT_BACK,
                onStopped: () => this._sizeChangeWindowDone(shellwm, actor),
            });

            if (!actor.__animationInfo) return;
            actor.thaw();
            actor.__animationInfo.frozen = false;
        };
    }
}
