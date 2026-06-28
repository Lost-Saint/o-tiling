import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

function buildIface(allowWindowQuit: boolean): string {
    const windowQuit = allowWindowQuit ?
        `
    <method name="WindowQuit">
        <arg type="(uu)" direction="in" name="window"/>
    </method>` :
        '';

    return `<node>
  <interface name="org.gnome.shell.extensions.OTiling">
    <method name="FocusLeft"/>
    <method name="FocusRight"/>
    <method name="FocusUp"/>
    <method name="FocusDown"/>
    <method name="WindowFocus">
        <arg type="(uu)" direction="in" name="window"/>
    </method>
    <method name="WindowHighlight">
        <arg type="(uu)" direction="in" name="window"/>
    </method>
    <method name="WindowList">
        <arg type="a((uu)sss)" direction="out" name="args"/>
    </method>${windowQuit}
  </interface>
</node>`;
}

export class Service {
    dbus: any;
    id: any;
    private _destroyed = false;

    FocusLeft: () => void = () => {};
    FocusRight: () => void = () => {};
    FocusUp: () => void = () => {};
    FocusDown: () => void = () => {};
    WindowFocus: (window: [number, number]) => void = () => {};
    WindowHighlight: (window: [number, number]) => void = () => {};
    WindowList: () => Array<[[number, number], string, string, string]> = () => [];
    WindowQuit: (window: [number, number]) => void = () => {};

    constructor() {
        // This interface is intentionally exported on the user's session bus.
        // Keep destructive methods out of the default surface; same-user helper
        // processes may opt in for legacy integrations via this environment flag.
        const allowWindowQuit = GLib.getenv('O_TILING_ENABLE_DBUS_WINDOW_QUIT') === '1';
        this.dbus = Gio.DBusExportedObject.wrapJSObject(buildIface(allowWindowQuit), this);

        const onBusAcquired = (conn: any) => {
            if (this._destroyed) return;
            this.dbus.export(conn, '/org/gnome/shell/extensions/OTiling');
        };

        function onNameAcquired() {}

        function onNameLost() {}

        this.id = Gio.bus_own_name(
            Gio.BusType.SESSION,
            'org.gnome.shell.extensions.OTiling',
            Gio.BusNameOwnerFlags.NONE,
            onBusAcquired,
            onNameAcquired,
            onNameLost,
        );
    }

    destroy() {
        this._destroyed = true;
        if (this.id) {
            Gio.bus_unown_name(this.id);
            this.id = null;
        }
        if (this.dbus) {
            this.dbus.unexport();
            this.dbus = null;
        }
    }
}
