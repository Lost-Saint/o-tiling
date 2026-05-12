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

                    // If feature is enabled, we use GNOME's default behavior (active is large, sides are small)
                    if (self._enabled) return;

                    // If feature is disabled, we want all workspaces to be equal size.
                    // For a single workspace, GNOME's original call already set a "fit" scale (usually ~0.9).
                    // Forcing 1.0 (as we did before) causes overflow into the dash/search bar.
                    const { nWorkspaces } = (global as any).workspace_manager;
                    if (nWorkspaces <= 1) return;

                    // For multiple workspaces, we equalize them to the scale of the active workspace.
                    // Note: 'this' here is the WorkspacesView instance.
                    const activeIndex = this._activeWorkspaceIndex ?? (global as any).workspace_manager.get_active_workspace_index();
                    const activeWorkspace = this._workspaces[activeIndex];
                    if (!activeWorkspace) return;

                    // We use the scale that GNOME calculated for the active workspace for ALL workspaces.
                    // This ensures they are uniform without being oversized.
                    const [targetScale] = activeWorkspace.get_scale();
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
