// simplified log4j levels
export enum LOG_LEVELS {
    OFF,
    ERROR,
    WARN,
    INFO,
    DEBUG,
}

let _level = 0;

export function init_log_level(settings: any): number | null {
    if (!settings) return null;
    _level = settings.get_uint('log-level');
    return settings.connect('changed::log-level', () => {
        _level = settings.get_uint('log-level');
    });
}

/**
 * parse level at runtime so we don't have to restart extension
 */
export function log_level() {
    return _level;
}

export function log(text: string) {
    console.log('o-tiling: ' + text);
}

export function error(text: string) {
    if (log_level() > LOG_LEVELS.OFF) console.error('o-tiling: ' + text);
}

export function format_error(error: unknown): string {
    if (error instanceof globalThis.Error) {
        return error.stack ?? `${error.name}: ${error.message}`;
    }

    if (error && typeof error === 'object') {
        const maybe_stack = (error as { stack?: unknown; }).stack;
        if (typeof maybe_stack === 'string') return maybe_stack;
    }

    return String(error);
}

export function error_error(context: string, caught: unknown) {
    error(`${context}: ${format_error(caught)}`);
}

export function warn(text: string) {
    if (log_level() > LOG_LEVELS.ERROR) console.warn('o-tiling: ' + text);
}

export function warn_error(context: string, error: unknown) {
    warn(`${context}: ${format_error(error)}`);
}

export function info(text: string) {
    if (log_level() > LOG_LEVELS.WARN) console.info('o-tiling: ' + text);
}

export function debug(text: string) {
    if (log_level() > LOG_LEVELS.INFO) console.debug('o-tiling: ' + text);
}

export function debug_error(context: string, error: unknown) {
    debug(`${context}: ${format_error(error)}`);
}
