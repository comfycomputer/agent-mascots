/**
 * Types for `<agent-mascot>` in React, Vue, Svelte and Solid. Import this once
 * anywhere in a project, such as in a `.d.ts` file:
 *
 *     import 'agent-mascots/jsx';
 *
 * Each framework block below only applies when that framework is installed. The
 * `@ts-ignore` comments are what make that work: without them, projects that have
 * `skipLibCheck` off would see errors for the frameworks they don't use. They must
 * stay on the line directly above the code they cover.
 */
import type { MascotProps } from './attrs.js';
import type { AgentMascot } from './element.js';
import type { BuiltinAccessoryName, BuiltinShapeName, GyroState } from './types.js';

/** Numbers can also arrive as strings, such as an attribute or a range input's value. */
type Loose<T> = number extends T ? T | string | undefined : T | undefined;

/** Names a built-in, with room for shapes added through `registerShape`. */
type OrCustom<T extends string> = T | (string & {});

type AccessoryName = OrCustom<BuiltinAccessoryName | 'none'>;

/** `bodyWidth` to `body-width`. */
type Kebab<S extends string> = S extends `${infer Head}${infer Tail}`
  ? `${Head extends Lowercase<Head> ? Head : `-${Lowercase<Head>}`}${Kebab<Tail>}`
  : '';

/** The mascot's options under their property names. */
export type AgentMascotProps = {
  [K in Exclude<keyof MascotProps, 'shape'>]?: Loose<MascotProps[K]>;
} & {
  shape?: OrCustom<BuiltinShapeName> | undefined;
  /** Space-separated string or list. */
  accessories?: string | readonly AccessoryName[] | undefined;
  /** Element to follow, overriding `track`. Property only: it has no attribute. */
  trackElement?: Element | null | undefined;
};

type ScalarProps = Omit<AgentMascotProps, 'trackElement'>;

/** The same options under their attribute names, such as `body-width`. */
export type AgentMascotAttributes = {
  [K in keyof ScalarProps as Kebab<K & string>]?: ScalarProps[K];
};

/** Everything `<agent-mascot>` accepts beyond the framework's own HTML attributes. */
export type AgentMascotElementProps = AgentMascotProps & AgentMascotAttributes;

export type MascotPokeEvent = CustomEvent<null>;
export type MascotGyroEvent = CustomEvent<{ state: GyroState }>;

/** React 19 binds custom element events with `on` plus the exact event name. */
export interface ReactMascotEvents {
  'onmascot-poke'?: ((event: MascotPokeEvent) => void) | undefined;
  'onmascot-gyro'?: ((event: MascotGyroEvent) => void) | undefined;
}

/** Vue compiles `@mascot-poke` to `onMascotPoke`, in templates and in JSX. */
export interface VueMascotEvents {
  onMascotPoke?: ((event: MascotPokeEvent) => void) | undefined;
  onMascotGyro?: ((event: MascotGyroEvent) => void) | undefined;
}

/** Svelte 5 binds `onmascot-poke` as a listener for `mascot-poke`. */
export type SvelteMascotEvents = ReactMascotEvents;

/** Solid uses `on:` for events and `prop:` to force a property. */
export interface SolidMascotEvents {
  'on:mascot-poke'?: ((event: MascotPokeEvent) => void) | undefined;
  'on:mascot-gyro'?: ((event: MascotGyroEvent) => void) | undefined;
  'prop:trackElement'?: Element | null | undefined;
}

// @ts-ignore
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // @ts-ignore
      'agent-mascot': DetailedHTMLProps<HTMLAttributes<AgentMascot>, AgentMascot> & AgentMascotElementProps & ReactMascotEvents;
    }
  }
}

// `vue` re-exports these types, so unlike the other blocks they aren't in scope by name here.
// @ts-ignore
declare module 'vue' {
  interface IntrinsicElementAttributes {
    // @ts-ignore
    'agent-mascot': import('vue').HTMLAttributes & AgentMascotElementProps & VueMascotEvents;
  }
  interface GlobalComponents {
    // @ts-ignore
    'agent-mascot': import('vue').DefineComponent<AgentMascotElementProps & VueMascotEvents>;
  }
}

// @ts-ignore
declare module 'svelte/elements' {
  interface SvelteHTMLElements {
    // @ts-ignore
    'agent-mascot': HTMLAttributes<AgentMascot> & AgentMascotElementProps & SvelteMascotEvents;
  }
}

// Not `solid-js`: it re-exports JSX through an alias, which an augmentation can't reach.
// @ts-ignore
declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      // @ts-ignore
      'agent-mascot': HTMLAttributes<AgentMascot> & AgentMascotElementProps & SolidMascotEvents;
    }
  }
}
