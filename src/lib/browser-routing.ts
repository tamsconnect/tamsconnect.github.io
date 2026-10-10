/** Hash URLs work on GitHub Pages without a server-side route rewrite. */
export function readRoute(): string {
  const route = window.location.hash.slice(1);
  return route.startsWith('/') ? route : '/';
}

export function routeHref(route: string): string {
  return '#' + (route.startsWith('/') ? route : '/');
}

/** Resolve bundled assets within any /repository-name/ deployment. */
export function assetUrl(filename: string): string {
  return new URL(filename.replace(/^\/+/, ''), document.baseURI).href;
}
