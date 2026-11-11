// Browser storage can be missing, blocked or throw on access, so nothing here ever does.

function store(name: 'localStorage' | 'sessionStorage') {
  return {
    get(key: string): string | null {
      try {
        return window[name].getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string): void {
      try {
        window[name].setItem(key, value);
      } catch {
        // Not remembered, which is fine: every use of this has a working default.
      }
    },
  };
}

export const local = store('localStorage');
export const session = store('sessionStorage');
