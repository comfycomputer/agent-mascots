import { defineAgentMascot } from './element.js';

export {
  MASCOT_ACCESSORIES,
  MASCOT_EYE_SHAPES,
  MASCOT_MATERIALS,
  MASCOT_MOODS,
  MASCOT_SHAPES,
} from './constants.js';
export { AgentMascot, type ConfigureOptions, defineAgentMascot } from './element.js';
export { registerShape } from './registry.js';
export type { MascotProps } from './attrs.js';
export type {
  BuiltinAccessoryName,
  BuiltinShapeName,
  DetailSetting,
  EyeMetrics,
  EyeShapeName,
  GyroState,
  MaterialName,
  MoodName,
  ShapeOptions,
} from './types.js';

defineAgentMascot();
