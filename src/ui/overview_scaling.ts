import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * Manages the scaling of workspaces in the overview.
 * Specifically handles the "Enlarge Active Workspace" feature by monkey-patching
 * WorkspacesView.prototype._updateWorkspacesState.
 */
export class OverviewScalingManager {
    private _origUpdateWorkspacesState: any = null;
    private _enabled: boolean;

    constructor(enabled: boolean = true) {
        this._enabled = enabled;
    }

    async enable(): Promise<void> {
        try {
            const { WorkspacesView } = await import('resource:///org/gnome/shell/ui/workspacesView.js');
            if (!WorkspacesView) return;

            const proto = WorkspacesView.prototype as any;
            if (!this._origUpdateWorkspacesState && typeof proto._updateWorkspacesState === 'function') {
                this._origUpdateWorkspacesState = proto._updateWorkspacesState;

                const self = this;
                proto._updateWorkspacesState = function(this: any, ...args: any[]) {
                    // If feature is enabled, use default GNOME behavior (active is large, sides are small)
                    if (self._enabled) {
                        return self._origUpdateWorkspacesState.apply(this, args);
                    }

                    // If feature is disabled, force all workspaces to full scale (1.0) and full opacity (255)
                    const { nWorkspaces } = (global as any).workspace_manager;
                    for (let i = 0; i < nWorkspaces; i++) {
                        const workspace = this._workspaces[i];
                        if (workspace) {
                            workspace.set_scale(1.0, 1.0);
                            workspace.set_opacity(255);
                        }
                    }
                };
            }

            this.update();
        } catch (e) {
            console.warn('OverviewScalingManager: failed to enable', e);
        }
    }

    disable(): void {
        if (this._origUpdateWorkspacesState) {
            import('resource:///org/gnome/shell/ui/workspacesView.js').then(({ WorkspacesView }) => {
                if (WorkspacesView) {
                    (WorkspacesView.prototype as any)._updateWorkspacesState = this._origUpdateWorkspacesState;
                    this._origUpdateWorkspacesState = null;
                    this.update();
                }
            }).catch(() => { /* best-effort */ });
        }
    }

    updateSetting(enabled: boolean): void {
        this._enabled = enabled;
        this.update();
    }

    /** Forces a refresh of the workspaces state in the overview. */
    update(): void {
        const workspacesDisplay = (Main as any).overview?._controls?._workspacesDisplay ||
                                (Main as any).overview?._overview?._controls?._workspacesDisplay ||
                                null;
        if (workspacesDisplay && workspacesDisplay._workspacesViews) {
            workspacesDisplay._workspacesViews.forEach((v: any) => {
                if (typeof v._updateWorkspacesState === 'function') {
                    v._updateWorkspacesState();
                }
            });
        }
    }
}
