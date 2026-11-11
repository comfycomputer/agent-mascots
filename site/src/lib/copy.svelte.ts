// Copying text, for every copy button on the site. What happened is said twice: on the button,
// where the visitor is looking, and through the footer's status line, for a screen reader.

/** How long the button shows what happened. */
export const SHOWN_MS = 1600;
/** How long a mascot works before it shows success. */
export const WORKING_MS = 450;

export const announcer = $state({ message: '' });

export type CopyResult = 'copied' | 'copy failed';

export async function copyText(text: string): Promise<CopyResult> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    announcer.message = 'Copy failed';
    return 'copy failed';
  }
  announcer.message = 'Copied';
  return 'copied';
}
