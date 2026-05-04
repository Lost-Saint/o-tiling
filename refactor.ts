import { Project } from "ts-morph";
import * as fs from 'fs';

const project = new Project({
    tsConfigFilePath: "tsconfig.json",
});

const fileMoves = [
    ["src/dialog_add_exception.ts", "src/ui/dialog_add_exception.ts"],
    ["src/shortcut_overlay.ts", "src/ui/shortcut_overlay.ts"],
    ["src/panel_settings.ts", "src/ui/panel_settings.ts"],
    ["src/auto_tiler.ts", "src/engine/auto_tiler.ts"],
    ["src/tiling.ts", "src/engine/tiling.ts"],
    ["src/forest.ts", "src/engine/forest.ts"],
    ["src/fork.ts", "src/engine/fork.ts"],
    ["src/stack.ts", "src/engine/stack.ts"],
    ["src/node.ts", "src/engine/node.ts"],
    ["src/window.ts", "src/window/window.ts"],
    ["src/focus.ts", "src/window/focus.ts"],
    ["src/movement.ts", "src/window/movement.ts"],
    ["src/grab_op.ts", "src/window/grab_op.ts"],
    ["src/ecs.ts", "src/core/ecs.ts"],
    ["src/arena.ts", "src/core/arena.ts"],
    ["src/events.ts", "src/core/events.ts"],
    ["src/shell.ts", "src/system/shell.ts"],
    ["src/config.ts", "src/system/config.ts"],
    ["src/settings.ts", "src/system/settings.ts"],
    ["src/dbus_service.ts", "src/system/dbus_service.ts"],
    ["src/keybindings.ts", "src/system/keybindings.ts"],
    ["src/scheduler.ts", "src/system/scheduler.ts"],
    ["src/executor.ts", "src/system/executor.ts"],
    ["src/xprop.ts", "src/system/xprop.ts"],
    ["src/geom.ts", "src/utils/geom.ts"],
    ["src/rectangle.ts", "src/utils/rectangle.ts"],
    ["src/utils.ts", "src/utils/utils.ts"],
    ["src/paths.ts", "src/utils/paths.ts"],
    ["src/lib.ts", "src/utils/lib.ts"],
    ["src/log.ts", "src/utils/log.ts"],
    ["src/error.ts", "src/utils/error.ts"],
    ["src/result.ts", "src/utils/result.ts"],
    ["src/once_cell.ts", "src/utils/once_cell.ts"],
    ["src/tags.ts", "src/utils/tags.ts"]
];

const dirs = ["src/ui", "src/engine", "src/window", "src/core", "src/system", "src/utils"];
dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

for (const [from, to] of fileMoves) {
    const file = project.getSourceFile(from);
    if (file) {
        console.log(`Moving ${from} to ${to}`);
        file.moveToDirectory(project.createDirectory(to.substring(0, to.lastIndexOf("/"))));
    } else {
        console.warn(`File ${from} not found`);
    }
}

const dirMoves = [
    ["src/color_dialog", "src/ui"],
    ["src/floating_exceptions", "src/ui"],
    ["src/theme_consistency", "src/ui"]
];

for (const [from, to] of dirMoves) {
    const dir = project.getDirectory(from);
    if (dir) {
        console.log(`Moving dir ${from} to ${to}`);
        dir.moveToDirectory(project.createDirectory(to));
    } else {
        console.warn(`Dir ${from} not found`);
    }
}

// In GJS, relative imports must have .js extensions.
// After ts-morph moves files, it automatically updates import strings, but might strip or mess up .js
project.getSourceFiles().forEach(sf => {
    sf.getImportDeclarations().forEach(importDecl => {
        let specifier = importDecl.getModuleSpecifierValue();
        if (specifier.startsWith('.') && !specifier.endsWith('.js')) {
            // Check if it's missing .js and append it
            if (specifier.endsWith('.ts')) {
                specifier = specifier.replace('.ts', '.js');
            } else {
                specifier += '.js';
            }
            importDecl.setModuleSpecifier(specifier);
        } else if (specifier.startsWith('.') && specifier.endsWith('.ts.js')) {
            importDecl.setModuleSpecifier(specifier.replace('.ts.js', '.js'));
        }
    });
});

project.saveSync();
