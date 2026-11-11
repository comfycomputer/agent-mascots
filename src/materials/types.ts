import type { Geometry } from '../types.js';

/** What a material gets to paint with. */
export interface MaterialContext {
  /** Gradients and filters. */
  defs: SVGElement;
  /** The body group, masked to the silhouette. Paint here, back to front. */
  paint: SVGElement;
  /** Id of the raw silhouette, for soft fills. */
  silhouette: string;
  /** Id of the silhouette with its joins melted, for anything that follows the outline. */
  solid: string;
}

export interface MaterialInstance {
  layout(geometry: Geometry): void;
  /** Adjust to the rendered size: `small` is 0 at large sizes and 1 at small ones. */
  fit?(small: number): void;
}

export type Material = (context: MaterialContext) => MaterialInstance;
