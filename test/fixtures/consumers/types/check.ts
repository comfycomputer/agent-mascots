// Compiled with `skipLibCheck` off and no UI framework installed: the published declarations
// have to stand on their own, and the framework blocks in `@comfycomputer/agent-mascots/jsx` must stay silent.
import '@comfycomputer/agent-mascots/accessories/ring';
import '@comfycomputer/agent-mascots/jsx';
import '@comfycomputer/agent-mascots/shapes/orb';
import type { AgentMascotAttributes, AgentMascotProps } from '@comfycomputer/agent-mascots/jsx';
import {
  AgentMascot,
  type ConfigureOptions,
  type GyroState,
  MASCOT_MOODS,
  type MoodName,
  registerShape,
  type ShapeOptions,
} from '@comfycomputer/agent-mascots';
import { defineAgentMascot } from '@comfycomputer/agent-mascots/core';
import { MASCOT_SHAPES } from '@comfycomputer/agent-mascots/cdn';

defineAgentMascot();

const options: ShapeOptions = { path: 'M0 0L1 1Z', eyes: { y: 1, w: 1, h: 1, gap: 1 } };
registerShape('kite', options);

const mascot = document.createElement('agent-mascot');
const element: AgentMascot = mascot;
const mood: MoodName = element.mood;
const moods: readonly MoodName[] = MASCOT_MOODS;
const reach: number = element.trackReach;
const shapes: readonly string[] = MASCOT_SHAPES;

element.addEventListener('mascot-gyro', (event) => {
  const state: GyroState = event.detail.state;
  console.log(state);
});

const configured: ConfigureOptions = { mood: 'working', eyeWidth: 1.2 };
element.configure(configured);
const gyro: Promise<GyroState> = element.enableGyro();

const props: AgentMascotProps = { bodyWidth: '1.2', mood: 'success', accessories: ['ring', 'none'] };
const attributes: AgentMascotAttributes = { 'body-width': 1.2, 'eye-shape': 'dot', 'track-reach': 3 };

// @ts-expect-error not a mood
const badMood: AgentMascotProps = { mood: 'angry' };
// @ts-expect-error attributes use kebab case
const badAttribute: AgentMascotAttributes = { bodyWidth: 1 };
// @ts-expect-error trackElement has no attribute
const badTrack: AgentMascotAttributes = { 'track-element': element };

export { attributes, badAttribute, badMood, badTrack, gyro, mood, moods, props, reach, shapes };
