// The preset gallery under the hero. The pictures in site/src/landing/presets come from this list:
// run `bun scripts/media/presets.mjs` after `bun run build` whenever it or the library's look changes.
// An `accessories` list replaces the shape's own, so leave it out to keep them. `ground` is the
// page behind it: three light colours for the gradient, light enough for the page's text.

export interface Preset {
  name: string;
  /** What a screen reader and the tooltip call it: the name, or a generated look's description. */
  label?: string;
  attrs: Readonly<Record<string, string>>;
  ground: readonly [string, string, string];
}

export const PRESETS: readonly Preset[] = [
  // The first is the hero's own look, written into the page, and the page's ground in landing.css.
  { name: 'onyx', attrs: { shape: 'blob', color: '#000000', accent: '#ffd84d' }, ground: ['#ffe2b0', '#f8d6cf', '#fbf6ee'] },
  { name: 'tabby', attrs: { shape: 'cat', color: '#f2a65a', accessories: 'whiskers tail' }, ground: ['#ffd8b0', '#ffe9c7', '#fff6ec'] },
  { name: 'boo', attrs: { shape: 'ghost', material: 'glass', color: '#b9a7f5' }, ground: ['#e4dcff', '#d8ecff', '#f7f4ff'] },
  { name: 'twinkle', attrs: { shape: 'star', color: '#ffd84d' }, ground: ['#fff0a8', '#ffe1c2', '#fffbea'] },
  { name: 'sweetheart', attrs: { shape: 'heart', color: '#ff6b8b' }, ground: ['#ffd0dc', '#ffe3d6', '#fff5f7'] },
  { name: 'mochi', attrs: { shape: 'mochi', color: '#f4efe6' }, ground: ['#f3e9dc', '#e8eff2', '#fbf8f3'] },
  { name: 'diamond', attrs: { shape: 'gem', material: 'glass', color: '#5ec8f2' }, ground: ['#cfeefd', '#dcf5ef', '#f2fbff'] },
  { name: 'toadstool', attrs: { shape: 'cap', color: '#e8543c' }, ground: ['#ffd2c4', '#e9f0d8', '#fff6f0'] },
  { name: 'imp', attrs: { shape: 'blob', color: '#18c2a0', accessories: 'horns tail' }, ground: ['#c9f2e5', '#dff0d0', '#f2fbf7'] },
  { name: 'angel', attrs: { shape: 'orb', material: 'frost', color: '#a9c4ff', accessories: 'halo wings' }, ground: ['#dce6ff', '#fdf1d6', '#f7f9ff'] },
  { name: 'sprout', attrs: { shape: 'bean', color: '#7dd56f', accessories: 'leaf blush' }, ground: ['#dcf5c9', '#f3f0c8', '#f7fcf0'] },
  { name: 'professor', attrs: { shape: 'squircle', color: '#3b3f46', accessories: 'glasses antenna' }, ground: ['#e1e4ea', '#efe6d6', '#f8f8f8'] },
  { name: 'royal', attrs: { shape: 'drop', color: '#4fb6ff', accessories: 'crown' }, ground: ['#cfe8ff', '#fbe9b8', '#f3f9ff'] },
  { name: 'ember', attrs: { shape: 'flame', color: '#ff7a3d' }, ground: ['#ffd6bd', '#ffe9b3', '#fff5ec'] },
  { name: 'nimbus', attrs: { shape: 'cloud', material: 'frost', color: '#9cc3ff' }, ground: ['#d6e6ff', '#e6f4ff', '#f6f9ff'] },
  { name: 'jelly', attrs: { shape: 'bell', material: 'glass', color: '#ff9ecf' }, ground: ['#ffd6ec', '#dcd9ff', '#fff4fa'] },
  { name: 'bunny', attrs: { shape: 'egg', color: '#f1e6d8', accessories: 'ears blush' }, ground: ['#f3e6d6', '#fbdde3', '#fdf9f4'] },
  { name: 'ribbon', attrs: { shape: 'mochi', color: '#ffc4d6', accessories: 'bow blush' }, ground: ['#ffd5e2', '#fbe6f0', '#fff6f9'] },
  { name: 'devil', attrs: { shape: 'cat', color: '#d6334a', accent: '#ffd84d', accessories: 'horns tail' }, ground: ['#ffcfd3', '#ffe5b8', '#fff4f4'] },
  { name: 'robot', attrs: { shape: 'squircle', color: '#8fa3b8', 'eye-shape': 'square', accessories: 'antenna' }, ground: ['#dbe4ee', '#e3eef0', '#f6f8fb'] },
  { name: 'bumble', attrs: { shape: 'orb', color: '#ffc62e', accessories: 'wings stalk' }, ground: ['#fff0a3', '#ffe0b0', '#fffbe8'] },
  { name: 'midnight', attrs: { shape: 'ghost', color: '#3a3f6b', 'eye-shape': 'big' }, ground: ['#dcdcf6', '#e8dff3', '#f7f6fc'] },
  { name: 'pearl', attrs: { shape: 'egg', material: 'glass', color: '#d9cffc' }, ground: ['#e8e1ff', '#ddf3f0', '#fbf9ff'] },
  { name: 'saturn', attrs: { shape: 'orb', color: '#f7b267', accessories: 'ring' }, ground: ['#ffe2c2', '#f6e3d9', '#fff8f0'] },
  { name: 'sunny', attrs: { shape: 'blob', color: '#ffd84d', accessories: 'rays blush' }, ground: ['#fff2a6', '#ffdcae', '#fffbe6'] },
  { name: 'ninja', attrs: { shape: 'squircle', color: '#26272e', accent: '#e8543c', 'eye-shape': 'slit' }, ground: ['#e3e1ea', '#f3dcd6', '#f8f7f8'] },
  { name: 'cupid', attrs: { shape: 'heart', color: '#ff9ecf', accessories: 'wings halo blush' }, ground: ['#ffd9ec', '#fff0c9', '#fff7fb'] },
  { name: 'owl', attrs: { shape: 'egg', color: '#b08a5e', 'eye-shape': 'big', accessories: 'ears' }, ground: ['#efdcc3', '#e3ead2', '#faf6f0'] },
  { name: 'ufo', attrs: { shape: 'orb', material: 'glass', color: '#6fdcae', accessories: 'ring antenna' }, ground: ['#cdf3e2', '#dce4ff', '#f3fbf8'] },
  { name: 'ruby', attrs: { shape: 'gem', material: 'glass', color: '#e0345c' }, ground: ['#ffd0da', '#f6d9ec', '#fff5f7'] },
];
