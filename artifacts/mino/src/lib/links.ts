export function homeHashHref(hash: string): string {
  const base = import.meta.env.BASE_URL;
  const normalizedHash = hash.startsWith("#") ? hash : `#${hash}`;
  return `${base}${normalizedHash}`;
}

export function homeHref(): string {
  return import.meta.env.BASE_URL;
}
