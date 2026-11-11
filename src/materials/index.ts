import type { MaterialName } from '../types.js';
import { frost } from './frost.js';
import { glass } from './glass.js';
import { glow } from './glow.js';
import type { Material } from './types.js';

export const MATERIALS: Record<MaterialName, Material> = { glow, frost, glass };
export type { Material, MaterialContext, MaterialInstance } from './types.js';
