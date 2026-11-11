type VisibilityListener = (visible: boolean) => void;
type ResizeListener = (width: number) => void;

const visibility = new WeakMap<Element, VisibilityListener>();
const sizes = new WeakMap<Element, ResizeListener>();
let intersection: IntersectionObserver | undefined;
let resize: ResizeObserver | undefined;

/** One shared observer per kind: a list of 50 mascots stays one callback per frame. */
export function observeVisibility(el: Element, listener: VisibilityListener): void {
  intersection ??= new IntersectionObserver((entries) => {
    for (const entry of entries) visibility.get(entry.target)?.(entry.isIntersecting);
  });
  visibility.set(el, listener);
  intersection.observe(el);
}

export function unobserveVisibility(el: Element): void {
  visibility.delete(el);
  intersection?.unobserve(el);
}

export function observeSize(el: Element, listener: ResizeListener): void {
  resize ??= new ResizeObserver((entries) => {
    for (const entry of entries) sizes.get(entry.target)?.(entry.contentRect.width);
  });
  sizes.set(el, listener);
  resize.observe(el);
}

export function unobserveSize(el: Element): void {
  sizes.delete(el);
  resize?.unobserve(el);
}
