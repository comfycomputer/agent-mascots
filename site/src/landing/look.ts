// What the page's small mascots take from the hero's look: as much as a small simple mascot can
// show, so no material or accessories.

import { resolve } from '$app/paths';

export type Look = Readonly<Record<string, string>>;

/** The face: the nav, install and copy mascots wear this and keep their own ink. */
const FACE = ['shape', 'eye-shape'];
/** The face and its colours: the mood picker's mascots wear this. */
const FACE_AND_TONE = [...FACE, 'color', 'accent'];

const only = (look: Look, names: string[]): Look => Object.fromEntries(names.filter((name) => name in look).map((name) => [name, look[name]!]));

export const faceOf = (look: Look) => only(look, FACE);
export const faceAndToneOf = (look: Look) => only(look, FACE_AND_TONE);

/** The playground link for a look, in the share-link format (formatHash in site/src/lib/hash.ts). The mood is left to the playground. */
export const playgroundLink = (look: Look) => `${resolve('/playground')}#${new URLSearchParams({ v: '1', ...look })}`;
