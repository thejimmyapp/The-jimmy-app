const configuredBaseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || "https://thejimmyapp.com";

export const publicBaseUrl = configuredBaseUrl.replace(/\/+$/, "");

export const setCanonicalUrl = (pathname: string) => {
  const normalizedPath = pathname === "/" ? "/" : `/${pathname.replace(/^\/+|\/+$/g, "")}`;
  const href = `${publicBaseUrl}${normalizedPath}`;
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = href;
  return href;
};
