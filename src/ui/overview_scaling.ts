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
                    // Always call the original logic first to maintain internal Shell layout/state
                    self._origUpdateWorkspacesState.apply(this, args);

                    const { nWorkspaces } = (global as any).workspace_manager;
                    const activeIndex = this._activeWorkspaceIndex ?? (global as any).workspace_manager.get_active_workspace_index();
                    const activeWorkspace = this._workspaces[activeIndex];
                    if (!activeWorkspace) return;

                    // GNOME's default scale for the active workspace.
                    // For a single workspace or the active one in multi-view, this can be too large (1.0).
                    // We cap it at 0.88 to ensure no overflow into Dash/Search bar.
                    const MAX_OVERVIEW_SCALE = 0.88;
                    let [targetScale] = activeWorkspace.get_scale();
                    
                    if (targetScale > MAX_OVERVIEW_SCALE) {
                        targetScale = MAX_OVERVIEW_SCALE;
                    }

                    // If "Enlarge Active Workspace" is enabled, we only apply the cap to the active one
                    // and let GNOME handle the rest (sides are usually already small).
                    if (self._enabled) {
                        activeWorkspace.set_scale(targetScale, targetScale);
                        if (activeWorkspace._background) {
                            activeWorkspace._background.set_scale(targetScale, targetScale);
                        }
                        return;
                    }

                    // If "Enlarge Active Workspace" is disabled, we equalize ALL workspaces to the capped scale.
                    const targetY = activeWorkspace.y;

                    for (let i = 0; i < nWorkspaces; i++) {
                        const workspace = this._workspaces[i];
                        if (workspace) {
                            workspace.set_scale(targetScale, targetScale);
                            workspace.y = targetY;

                            if (workspace._background) {
                                workspace._background.set_scale(targetScale, targetScale);
                                workspace._background.y = targetY;
                            }
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
