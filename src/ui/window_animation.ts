import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export type WindowAnimationStyle = 'default' | 'hyprland' | 'glide';

export class WindowAnimationManager {
    private _style: WindowAnimationStyle;
    private _duration: number;
    private _enabled = false;
    private _origShouldAnimateActor: Function | null = null;

    constructor(style: WindowAnimationStyle = 'default', duration: number = 200) {
        this._style = style;
        this._duration = duration;
    }

    enable(): void {
        if (this._enabled) return;
        this._enabled = true;
        this._patchShouldAnimateActor();
    }

    disable(): void {
        if (!this._enabled) return;
        this._enabled = false;
        if (this._origShouldAnimateActor) {
            (Main.wm as any)._shouldAnimateActor = this._origShouldAnimateActor;
            this._origShouldAnimateActor = null;
        }
    }

    setStyle(style: WindowAnimationStyle): void {
        if (style === this._style) return;
        this._style = style;
    }

    setDuration(duration: number): void {
        this._duration = duration;
    }

    get style(): WindowAnimationStyle {
        return this._style;
    }

    applyMove(actor: Clutter.Actor, x: number, y: number, width: number, height: number, commit: () => void): void {
        actor.remove_all_transitions();

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

    private _patchShouldAnimateActor(): void {
        const orig = (Main.wm as any)._shouldAnimateActor;
        this._origShouldAnimateActor = orig;

        const manager = this;

        (Main.wm as any)._shouldAnimateActor = function (actor: Clutter.Actor, types: Meta.WindowType[]) {
            const should_animate = orig.call(this, actor, types);
            if (!should_animate) return false;

            if (manager._style === 'default') return true;

            const stack = (new Error()).stack || '';
            const forClosing = stack.includes('_destroyWindow@');
            const forOpening = stack.includes('_mapWindow@');

            if (forClosing || forOpening) {
                const orig_ease = (actor as any).ease;

                (actor as any).ease = function (params: any) {
                    (actor as any).ease = orig_ease;

                    if (manager._style === 'glide') {
                        if (forOpening) {
                            actor.set_scale(1, 1);
                            actor.translation_y = 30; // start slightly below
                            params.duration = manager._duration;
                            params.mode = Clutter.AnimationMode.EASE_OUT_QUART;
                            params.translation_y = 0;
                        } else {
                            params.duration = Math.round(manager._duration * 0.8);
                            params.mode = Clutter.AnimationMode.EASE_IN_QUART;
                            params.translation_y = 30; // exit sliding down
                        }
                    } else if (manager._style === 'hyprland') {
                        if (forOpening) {
                            actor.set_scale(0.85, 0.85);
                            params.duration = manager._duration;
                            params.mode = Clutter.AnimationMode.EASE_OUT_BACK;
                        } else {
                            params.duration = Math.round(manager._duration * 0.8);
                            params.mode = Clutter.AnimationMode.EASE_IN_CUBIC;
                            params.scale_x = 0.85;
                            params.scale_y = 0.85;
                        }
                    }

                    orig_ease.call(actor, params);
                };
            }

            return true;
        };
    }
}
