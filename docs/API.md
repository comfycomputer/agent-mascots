# API reference

`<agent-mascot>` is a single custom element. Each attribute has a matching camelCase property: for
example, `eye-width` is `el.eyeWidth`.

- An invalid value is replaced by the default. Development builds also log a `console.warn` (see
  [Warnings](#warnings)).
- A number outside its range is clamped to the nearest limit.
- Colours accept any CSS colour, including `var()`. Values that could load a resource, such as
  `url()`, are rejected, even inside a `var()` fallback.

## Body

| Attribute | Values | Default |
|---|---|---|
| `shape` | `blob` `orb` `egg` `squircle` `flame` `cloud` `bell` `ghost` `cap` `gem` `bean` `drop` `star` `heart` `mochi` `cat`, or the name of a registered shape | `blob` |
| `material` | `glow` `frost` `glass` | `glow` |
| `color` | CSS colour | `var(--mascot-color, #18c2a0)` |
| `accent` | CSS colour | `var(--mascot-accent, #ffd84d)` |
| `body-width`, `body-height` | 0.6 to 1.4 | 1 |
| `softness` | 0 to 1. Rounds corners and blends joins. Shapes with neither don't change. | 0.4 |
| `accessories` | A space-separated list of `antenna` `stalk` `ears` `arms` `ring` `leaf` `rays` `spots` `stem` `tentacles` `facets` `blush` `sheen` `iridescent` `bubbles` `outline` `horns` `halo` `crown` `bow` `wings` `tail` `whiskers` `glasses`, or `none`. Unknown names are ignored. If no valid names remain, the shape's defaults are used. | Depends on the shape |

## Background and size

| Attribute | Values | Default |
|---|---|---|
| `sky` | `none`, `auto`, a colour, or two colours as `"top, bottom"` | `none` |
| `shadow` | `on` `none` | `on` |
| `size` | Width in pixels. Overrides CSS while set, and doesn't touch your inline styles. | 240px wide, or whatever CSS sets |
| `detail` | `auto` `full` `simple`. `auto` uses `full` above 64px wide and `simple` at 64px or below. | `auto` |

The mascot is always square, whether CSS sets its width or its height. When `sky` is set,
`--mascot-radius` rounds the corners of the background tile. At the `simple` level, colours and
materials are drawn flat, with no filters.

## Eyes

| Attribute | Values | Default |
|---|---|---|
| `eye-shape` | `auto` `pill` `round` `square` `dot` `oval` `slit` `bar` `big` | `auto` |
| `eye-width`, `eye-height` | 0.3 to 2.5 | 1 |
| `eye-spacing` | 0.5 to 2 | 1 |
| `eye-y` | -1 to 1 | 0 |
| `eye-color` | CSS colour | Based on `color` |

## Behaviour

| Attribute | Values | Default |
|---|---|---|
| `mood` | `idle` `thinking` `working` `success` `error` `listening` `speaking` `waiting` `sleeping` | `idle` |
| `level` | 0 to 1. Sets the mouth's opening while `speaking`. When unset, the mouth follows a built-in rhythm. | Unset |
| `motion` | 0 to 2. Scales all movement at once. Float, bounce and gaze stop growing at 2. | 1 |
| `float` `blink` `glance` `bounce` `gaze` | 0 to 2. Scales one kind of movement. | 1 |
| `track` | `self`, `window`, `none`, or a CSS selector. A selector is looked up in the mascot's root node first, then in the document. | `self` |
| `track-reach` | 0.2 to 50. How far the pointer has to be, in mascot widths, for the eyes to turn all the way. | 2, or 0.42 with `track="self"` |
| `gyro` | Boolean | Off |
| `label` | The accessible name. An empty value counts as unset. | `Assistant, <mood>` |

The eyes respond to one input at a time, in this order: `lookAt()`, then a pointer that moved in the
last 2 seconds, then the gyro, then the mood's own movement. A `sleeping` mascot ignores the pointer
and the gyro, and only responds to `lookAt()`.

If a `track` selector doesn't match anything yet, the mascot keeps trying for about 51 seconds, at
growing intervals, so it can follow an element that's added later. An invalid selector logs a
warning and falls back to `self`.

## Properties and methods

- `accessories` returns the active accessories as an array. You can set it to an array or a
  space-separated string.
- `trackElement` is the element whose pointer the eyes follow. It overrides `track`, and has no
  attribute.
- `poke()` squashes the mascot, makes it wink, and fires `mascot-poke`.
- `lookAt(clientX, clientY)` makes the eyes look at a point in the viewport, overriding every other
  input. While it's held, the aim is updated a few times a second as the mascot moves. It uses
  `track-reach` as set, so the default is 2 even with `track="self"`. Non-finite coordinates are
  ignored, with a warning.
- `lookAway()` releases `lookAt()`.
- `configure(options)` sets several properties at once, by property name. `null`, `undefined` and
  `false` clear an option. Unknown keys are ignored.
- `enableGyro()` returns a promise that resolves to `'granted'`, `'denied'` or `'unsupported'`. Call
  it from a click handler, because iOS only asks for permission during a user gesture. It sets
  `gyro`, and removes it again if the answer isn't `'granted'`.

On devices that don't ask for permission, `'granted'` is provisional. A device with no motion sensor
can only be detected once the listener is running, so the state can later change to
`'unsupported'`. `mascot-gyro` reports the change.

## Events

Both events bubble and cross shadow DOM boundaries.

- `mascot-poke` fires when the mascot is poked by a click, Enter, Space, or `poke()`. Holding a key
  down pokes once.
- `mascot-gyro` fires when the gyro state changes. `detail.state` holds the new state.

## Exports

`registerShape(name, { path, eyes, top?, bottom?, halfWidth?, shine?, accessories? })` adds a shape.
It throws a `TypeError` for invalid input, including eye sizes that aren't positive. Registering
an existing name again updates every mascot that uses it. All values are in a 240 × 240 coordinate
space:

| Option | Meaning | Default |
|---|---|---|
| `name` | A letter followed by letters, digits or `-` | Required |
| `path` | SVG path data, centred on x = 120 | Required |
| `eyes` | `{ y, w, h, gap, square? }`: the eyes' vertical centre, their width and height, the distance from the centre line to each eye's centre, and whether `eye-shape="auto"` draws them square | Required |
| `top`, `bottom`, `halfWidth` | The outline's extents. Used to place accessories and to stretch the body. | 60, 180, 60 |
| `shine` | The highlight ellipse, as `[cx, cy, rx, ry]` | Placed from the extents |
| `accessories` | The shape's default accessories, as an array or a space-separated string | None |

`MASCOT_SHAPES`, `MASCOT_MATERIALS`, `MASCOT_ACCESSORIES`, `MASCOT_EYE_SHAPES` and `MASCOT_MOODS`
are arrays of the built-in values.

`AgentMascot` is the element class. `defineAgentMascot()` registers it. Importing `agent-mascots`
or `agent-mascots/core` already does this. Calling it again is safe, and outside a browser it does
nothing.

The package also exports these types: `MascotProps`, `ConfigureOptions`, `MoodName`,
`MaterialName`, `EyeShapeName`, `DetailSetting`, `GyroState`, `ShapeOptions`, `EyeMetrics`,
`BuiltinShapeName` and `BuiltinAccessoryName`.

## Styling

- CSS parts: `tile`, `body` and `eyes`.
- Custom properties:
  - `--mascot-color` and `--mascot-accent`: the default `color` and `accent`.
  - `--mascot-radius`: the corner radius of the `sky` tile. Defaults to 22%.
  - `--mascot-cue`: the colour of the `waiting` question mark and the `sleeping` Zs. They use the
    accent by default. Set this when the accent is hard to see against your background.

## Accessibility

- The mascot has `role="img"`. Its name comes from `label`, or defaults to `Assistant, <mood>`.
  Mood changes aren't announced.
- An `aria-label` you set yourself is kept. For a decorative mascot, use `role="presentation"`,
  which removes the automatic name, or `aria-hidden="true"`.
- The mascot can only be focused if you give it a `tabindex`. When focused, Enter and Space poke it.
- With `prefers-reduced-motion`, looping animations stop and each mood is a still pose. The eyes
  still follow input, but jump instead of moving smoothly. `poke()` still makes it wink.
- With `forced-colors`, the mascot is drawn as an outline in system colours.

## Avoiding layout shift

The mascot is square and 240px wide by default, but the browser doesn't know that until the script
runs. To avoid a layout shift, give the tag the same size before it upgrades. Set the width in your
own CSS, because the `size` attribute only works once the script has run:

```css
agent-mascot {
  width: 96px;
}

agent-mascot:not(:defined) {
  display: inline-block;
  aspect-ratio: 1;
  vertical-align: middle;
}
```

The first rule sets the width. The second keeps the tag square until it upgrades. If you don't set
a width, put `width: 240px` in the second rule.

## Theming

Colours are applied with CSS, so changing a theme doesn't need JavaScript or a re-render. Set the
two custom properties on any ancestor, and every shade is derived from them:

```css
:root {
  --mascot-color: #e8442e;
  --mascot-accent: #ffc62e;
}

@media (prefers-color-scheme: dark) {
  :root {
    --mascot-color: #ffc62e;
    --mascot-accent: #e8442e;
  }
}
```

`color` and `accent` also accept your own design tokens. `sky` puts the mascot on a coloured tile,
which suits avatars, and `--mascot-radius` sets the tile's corners:

```html
<agent-mascot color="var(--brand, #e8442e)" sky="#17120f" style="--mascot-radius: 50%"></agent-mascot>
```

To style the inside of the mascot, use the CSS parts `tile`, `body` and `eyes`:

```css
agent-mascot::part(tile) {
  outline: 2px solid currentColor;
}
```

## Content Security Policy

The library doesn't evaluate code or use inline event handlers. Styles are added with
`adoptedStyleSheets`, so `script-src 'self'` and `style-src 'self'` are enough. Browsers without
constructable stylesheets get a `<style>` element instead, which needs `style-src 'unsafe-inline'`
or a nonce. If any element on the page has a `nonce` attribute, the mascot uses the same nonce.

## Warnings

An invalid value logs a `console.warn`, once per distinct message. Whether warnings are on depends
on how the library is loaded:

| How it's loaded | Warnings |
|---|---|
| Bundled, with `process.env.NODE_ENV` set to `production` | Off |
| Bundled for development | On |
| `agent-mascots/cdn` | Off. The messages aren't included in the file. |
| The unbundled modules in a browser, for example through an import map | On, because nothing marks the page as production |
| Node | On unless `NODE_ENV` is `production` |

Vite and webpack replace `process.env.NODE_ENV` in production builds without any configuration.
esbuild does it when minifying. Rollup needs `@rollup/plugin-replace`. If your bundler doesn't
replace it, warnings stay on and nothing breaks.

A production bundle still contains the message text, which adds about 200 B gzipped. To remove it,
mark `warnOnce` as a pure function in your bundler, as the CDN build does.

## Performance

- A mascot that's off-screen does no work each frame. `visibility: hidden` and `opacity: 0` still
  count as on-screen, because the browser doesn't report them. For a mascot that stays hidden for a
  long time, use the `hidden` attribute or `display: none` instead.
- `motion="0"` stops the mascot moving, but not its per-frame work. There's no pause method. A
  mascot's frame loop only stops when it's off-screen, `hidden`, `display: none`, or under reduced
  motion.
- Layout changes made while a mascot is off-screen are applied when it comes back into view.
