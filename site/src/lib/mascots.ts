// One observer that sees every <agent-mascot> arrive, leave or change the attributes the site
// manages. The detail budget uses it.

const SELECTOR = 'agent-mascot';
const WATCHED = ['detail'];

export interface MascotWatcher {
  added?(el: HTMLElement): void;
  removed?(el: HTMLElement): void;
  changed?(el: HTMLElement, attribute: string): void;
}

const watchers = new Set<MascotWatcher>();

function forEachMascot(nodes: NodeList, visit: (el: HTMLElement) => void) {
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.matches(SELECTOR)) visit(node);
    for (const nested of node.querySelectorAll<HTMLElement>(SELECTOR)) visit(nested);
  }
}

function onMutations(records: MutationRecord[]) {
  for (const record of records) {
    if (record.type === 'attributes') {
      const target = record.target as HTMLElement;
      if (target.matches(SELECTOR)) for (const watcher of watchers) watcher.changed?.(target, record.attributeName!);
      continue;
    }
    forEachMascot(record.removedNodes, (el) => {
      // A move shows up as a removal and an addition: only a real departure counts.
      if (!el.isConnected) for (const watcher of watchers) watcher.removed?.(el);
    });
    forEachMascot(record.addedNodes, (el) => {
      for (const watcher of watchers) watcher.added?.(el);
    });
  }
}

let observer: MutationObserver | undefined;

/**
 * Call the watcher as mascots come and go. `added` also runs at once for every mascot already on
 * the page, and it can run twice for one mascot, so it must be idempotent.
 */
export function watchMascots(watcher: MascotWatcher): void {
  watchers.add(watcher);
  for (const el of document.querySelectorAll<HTMLElement>(SELECTOR)) watcher.added?.(el);
  if (!observer) {
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: WATCHED });
  }
}
