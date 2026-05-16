declare const log: (arg: string) => void, imports: any, _: (arg: string) => string;

declare module 'gi://*' {
    let data: any;
    export default data;
}

declare module 'gi://Gtk?version=4.0' {
    let Gtk: any;
    export default Gtk;
}

declare module 'gi://Adw?version=1' {
    let Adw: any;
    export default Adw;
}
