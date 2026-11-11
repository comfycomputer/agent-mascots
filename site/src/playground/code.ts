// The code panels. Every string comes from the playground's state, never from the stage's
// attributes. Svelte puts them in as text, so nothing here is ever parsed as HTML.

import type { ShapeOptions } from '../lib/drawn-shape';
import { AREA } from './state.svelte';

export const FRAMEWORKS = ['html', 'react', 'vue', 'svelte', 'solid'] as const;
export type Framework = (typeof FRAMEWORKS)[number];

type Attributes = readonly (readonly [name: string, value: string])[];

const DOCS_NOTE = "<!-- import 'agent-mascots' first -->";
const VUE_NOTE = '<!-- Set isCustomElement in the compiler options -->';

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const indent = (text: string, by: string) => text.split('\n').map((line) => (line ? by + line : line)).join('\n');

/** One tag: `selfClose` is how it ends, and `quote` is any extra escaping for that syntax. */
function element(rows: Attributes, { selfClose = false, quote = escape } = {}): string {
  const parts = rows.map(([name, raw]) => (name === 'gyro' ? name : `${name}="${quote(raw)}"`));
  const end = selfClose ? ' />' : '></agent-mascot>';
  const tag =
    parts.length < 3
      ? `<agent-mascot${parts.map((part) => ` ${part}`).join('')}${end}`
      : `<agent-mascot\n${parts.map((part) => `  ${part}`).join('\n')}\n${end.trim()}`;
  return rows.some(([name, raw]) => name === 'track' && raw === AREA) ? `<div id="${AREA.slice(1)}">\n${indent(tag, '  ')}\n</div>` : tag;
}

/** The import, and for a drawn shape the registration it needs before the tag can use it. */
const imports = (shape: ShapeOptions | null) =>
  shape ? `import { registerShape } from 'agent-mascots';\n\nregisterShape('drawn', ${JSON.stringify(shape, null, 2)});` : "import 'agent-mascots';";

const jsx = (body: string, shape: ShapeOptions | null) => `${imports(shape)}\n\nexport function Mascot() {\n  return (\n${indent(body, '    ')}\n  );\n}`;

/** The code for each framework. A drawn shape comes as the options `registerShape` takes. */
export function generate(framework: Framework, rows: Attributes, shape: ShapeOptions | null): string {
  switch (framework) {
    case 'html':
      return shape ? `<script type="module">\n${indent(imports(shape), '  ')}\n</script>\n\n${element(rows)}` : `${DOCS_NOTE}\n${element(rows)}`;
    case 'react':
    case 'solid':
      return jsx(element(rows, { selfClose: true }), shape);
    case 'vue':
      return `<script setup>\n${imports(shape)}\n</script>\n\n<template>\n${indent(VUE_NOTE, '  ')}\n${indent(element(rows, { selfClose: true }), '  ')}\n</template>`;
    case 'svelte':
      return `<script>\n${indent(imports(shape), '  ')}\n</script>\n\n${element(rows, { quote: (text) => escape(text).replace(/\{/g, '&#123;') })}`;
  }
}
