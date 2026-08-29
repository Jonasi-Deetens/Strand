/** Turns a stored catalog path into a URL the webview can fetch. */
export function catalogImageUrl(image: string | null | undefined): string | null {
  if (!image) return null;
  return image.startsWith("/") ? image : `/${image}`;
}
