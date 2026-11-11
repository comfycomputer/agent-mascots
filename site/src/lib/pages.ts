/** The site's pages, by the name of their HTML file. */
export const PAGES = ['index', 'playground', '404'] as const;
export type Page = (typeof PAGES)[number];
