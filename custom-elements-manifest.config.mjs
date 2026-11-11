// Configures `cem analyze`. The element's attributes and properties are defined at runtime
// from the PROPS table, which static analysis can't see, so a plugin adds them from the built
// table. Names, defaults and enum values therefore can't drift from the code; descriptions
// live here, and a property with no description fails the build.
import {
  MASCOT_ACCESSORIES,
  MASCOT_EYE_SHAPES,
  MASCOT_MATERIALS,
  MASCOT_MOODS,
  MASCOT_SHAPES,
} from './dist/constants.js';
import { PROPS } from './dist/attrs.js';

const union = (values) => values.map((value) => `'${value}'`).join(' | ');
const dial = (description) => ({ description, type: 'number' });

const DOCS = {
  shape: {
    description: 'Body silhouette: a built-in, or a name passed to `registerShape`.',
    type: `${union(MASCOT_SHAPES)} | string`,
  },
  material: { description: 'What the body is made of.', type: union(MASCOT_MATERIALS) },
  color: { description: 'Body colour: any CSS colour, including `var()`.', type: 'string' },
  accent: { description: 'Accent colour: any CSS colour, including `var()`.', type: 'string' },
  bodyWidth: dial('Horizontal stretch, 0.6 to 1.4.'),
  bodyHeight: dial('Vertical stretch, 0.6 to 1.4.'),
  softness: dial('How much corners and joins melt, 0 to 1. Smooth outlines have none.'),
  sky: {
    description: 'Backdrop: `none`, `auto`, one colour, or "top, bottom".',
    type: 'string',
  },
  shadow: { description: 'Ground shadow.', type: "'on' | 'none'" },
  size: { description: 'Size in pixels. Omit to size with CSS; the mascot stays 1:1.', type: 'number | null' },
  detail: {
    description: '`auto` picks `simple` at 64px wide or less, and `full` above that.',
    type: "'auto' | 'full' | 'simple'",
  },
  eyeShape: { description: 'Eye shape.', type: union(MASCOT_EYE_SHAPES) },
  eyeWidth: dial('Eye width multiplier, 0.3 to 2.5.'),
  eyeHeight: dial('Eye height multiplier, 0.3 to 2.5.'),
  eyeSpacing: dial('Eye spacing multiplier, 0.5 to 2.'),
  eyeY: dial('Eye height on the body, -1 to 1.'),
  eyeColor: { description: 'Eye colour: any CSS colour.', type: 'string | null' },
  mood: { description: 'What the mascot is doing.', type: union(MASCOT_MOODS) },
  level: {
    description: 'Voice level, 0 to 1, driving `speaking`. Unset uses a built-in rhythm.',
    type: 'number | null',
  },
  motion: dial('Master dial multiplying every motion channel, 0 to 2. Float, bounce and gaze amplitude cap at 2.'),
  float: dial('Floating, 0 to 2.'),
  blink: dial('Blinking, 0 to 2.'),
  glance: dial('Idle glances, 0 to 2.'),
  bounce: dial('Bounce and squash, 0 to 2.'),
  gaze: dial('Eye tracking, 0 to 2.'),
  track: { description: 'What the eyes follow: `self`, `window`, `none` or a CSS selector.', type: 'string' },
  trackReach: dial('Distance for a full look, in mascot widths, 0.2 to 50. Unset with `track="self"`, the reach is 0.42.'),
  gyro: { description: 'Follow device orientation.', type: 'boolean' },
  label: { description: 'Accessible name. Defaults to `Assistant, <mood>`.', type: 'string | null' },
  accessories: {
    description: `Space-separated list of ${MASCOT_ACCESSORIES.join(', ')}, or \`none\`. Defaults per shape.`,
    type: 'string',
  },
};

/** Fill in what the element gets at runtime, and point the manifest at the published files. */
function describeElement() {
  return {
    name: 'agent-mascot-props',
    packageLinkPhase({ customElementsManifest: manifest }) {
      const missing = Object.keys(PROPS).filter((name) => !DOCS[name]);
      if (missing.length) throw new Error(`no manifest docs for: ${missing.join(', ')}`);

      const module = manifest.modules.find(({ path }) => path === 'src/element.ts');
      module.path = 'dist/element.js';
      for (const entry of module.exports) entry.declaration.module = module.path;

      const element = module.declarations.find(({ name }) => name === 'AgentMascot');
      element.superclass = { name: 'HTMLElement' };
      for (const event of element.events ?? []) event.type ??= { text: 'CustomEvent' };

      element.attributes = [];
      element.members = (element.members ?? []).filter(({ privacy }) => privacy !== 'private');
      for (const [name, spec] of Object.entries(PROPS)) {
        const { description, type } = DOCS[name];
        // Reading a missing attribute returns the default. The dynamic defaults are CSS.
        const value = name === 'accessories' ? null : spec.read(null);
        const entry = { description, type: { text: type } };
        if (value != null) entry.default = JSON.stringify(value);
        element.attributes.push({ name: spec.attr, fieldName: name, ...entry });
        // `accessories` is a real accessor, so the analyzer has already found it.
        const member = element.members.find((candidate) => candidate.name === name);
        if (member) member.attribute = spec.attr;
        else element.members.push({ kind: 'field', name, attribute: spec.attr, ...entry });
      }

      // The analyzer reads the definition as a tag called `TAG`. Core is what really defines it.
      module.exports = module.exports.filter(({ kind }) => kind !== 'custom-element-definition');
      manifest.modules.push({
        kind: 'javascript-module',
        path: 'dist/core.js',
        declarations: [],
        exports: [
          {
            kind: 'custom-element-definition',
            name: element.tagName,
            declaration: { name: element.name, module: module.path },
          },
        ],
      });
    },
  };
}

export default {
  globs: ['src/element.ts'],
  outdir: '.',
  plugins: [describeElement()],
};
