import * as Movement from './movement.js';

import type { Entity } from '../core/ecs.js';
import type { Rectangle } from '../utils/rectangle.js';

export class GrabOp {
    entity: Entity;
    rect: Rectangle;

    constructor(entity: Entity, rect: Rectangle) {
        this.entity = entity;
        this.rect = rect;
    }

    operation(change: Rectangle): Movement.Movement {
        return Movement.calculate(this.rect, change);
    }
}
