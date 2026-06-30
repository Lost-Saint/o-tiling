import Clutter from 'gi://Clutter';
import * as WorkspaceAnimation from 'resource:///org/gnome/shell/ui/workspaceAnimation.js';

export type AnimationStyle = 'slide' | 'swing' | 'none';

const SWING_OVERSHOOT = 0.12;
const SWING_OVERSHOOT_FRACTION = 0.55;

export class WorkspaceAnimationManager {
    private _style: AnimationStyle;
    private _enabled = false;

    private _origCreateBackground = (WorkspaceAnimation as any).WorkspaceBackground.prototype._createBackground;
    private _origEaseProperty = (WorkspaceAnimation as any).MonitorGroup.prototype.ease_property;

    constructor(style: AnimationStyle = 'swing') {
        this._style = style;
    }

    enable(): void {
        if (this._enabled) return;
        this._enabled = true;

        (WorkspaceAnimation as any).WorkspaceBackground.prototype._createBackground = function (this: any) { };

        if (this._style === 'swing') this._patchSwing();
    }

    disable(): void {
        if (!this._enabled) return;
        this._enabled = false;

        (WorkspaceAnimation as any).WorkspaceBackground.prototype._createBackground = this._origCreateBackground;
        (WorkspaceAnimation as any).MonitorGroup.prototype.ease_property = this._origEaseProperty;
    }

    setStyle(style: AnimationStyle): void {
        if (style === this._style) return;
        const wasEnabled = this._enabled;
        if (wasEnabled) this.disable();
        this._style = style;
        if (wasEnabled) this.enable();
    }

    get style(): AnimationStyle {
        return this._style;
    }

    get isEnabled(): boolean {
        return this._enabled;
    }

    private _patchSwing(): void {
        const original = this._origEaseProperty;

        (WorkspaceAnimation as any).MonitorGroup.prototype.ease_property = function (
            this: any,
            propertyName: string,
            target: number,
            params: any,
        ) {
            if (propertyName !== 'progress') {
                original.call(this, propertyName, target, params);
                return;
            }

            const delta = target - this.progress;
            const overshootDuration = Math.round(params.duration * SWING_OVERSHOOT_FRACTION);
            const settleDuration = params.duration - overshootDuration;

            original.call(this, propertyName, target + delta * SWING_OVERSHOOT, {
                duration: overshootDuration,
                mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
                onComplete: () => {
                    original.call(this, propertyName, target, {
                        duration: settleDuration,
                        mode: Clutter.AnimationMode.EASE_IN_OUT_CUBIC,
                        onComplete: params.onComplete,
                    });
                },
            });
        };
    }
}