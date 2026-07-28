import { afterEach, describe, expect, it } from "vitest";
import { publicBaseUrl, setCanonicalUrl } from "./publicUrl";

describe("public URL metadata", () => {
  afterEach(() => {
    document.head.querySelector('link[rel="canonical"]')?.remove();
  });

  it("uses the custom domain as the canonical public origin", () => {
    expect(publicBaseUrl).toBe("https://thejimmyapp.com");
    expect(setCanonicalUrl("/privacy/")).toBe("https://thejimmyapp.com/privacy");
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href)
      .toBe("https://thejimmyapp.com/privacy");
  });

  it("keeps the root canonical URL normalized", () => {
    expect(setCanonicalUrl("/")).toBe("https://thejimmyapp.com/");
  });
});
