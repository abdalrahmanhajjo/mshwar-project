import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogImage, resolveImageSrc, responsiveSrcSet } from "./catalog-image";

describe("CatalogImage", () => {
  it("builds a width-based srcset for Unsplash photos only", () => {
    const set = responsiveSrcSet("https://images.unsplash.com/photo-1?auto=format&w=1600&q=80");
    expect(set?.split(", ")).toHaveLength(5);
    expect(set).toContain("w=480");
    expect(responsiveSrcSet("https://cdn.example.com/a.jpg")).toBeUndefined();
    expect(responsiveSrcSet("/local.jpg")).toBeUndefined();
  });

  it("lets ImageKit do the resizing", () => {
    const set = responsiveSrcSet("https://ik.imagekit.io/mshwar/listings/a.jpg");
    expect(set?.split(", ")).toHaveLength(5);
    expect(set).toContain("tr=w-800%2Cq-auto%2Cf-auto 800w");
  });

  it("resolves storage keys only when an ImageKit endpoint is configured", () => {
    expect(resolveImageSrc("https://images.unsplash.com/p.jpg")).toBe("https://images.unsplash.com/p.jpg");
    expect(resolveImageSrc("/api/v1/portal/files/abc")).toBe("/api/v1/portal/files/abc");
    expect(resolveImageSrc("")).toBe("");
    // No NEXT_PUBLIC_IMAGEKIT_URL in tests: a bare key renders the placeholder instead of a broken image.
    expect(resolveImageSrc("experiences/1/image-1.jpg")).toBe("");
    const { container } = render(<CatalogImage src="experiences/1/image-1.jpg" alt="Cedars" />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("lazy-loads by default and eager-loads priority images", () => {
    const { rerender } = render(<CatalogImage src="https://images.unsplash.com/p?w=1600" alt="Harbour" />);
    expect(screen.getByRole("img", { name: "Harbour" })).toHaveAttribute("loading", "lazy");
    rerender(<CatalogImage src="https://images.unsplash.com/p?w=1600" alt="Harbour" priority />);
    expect(screen.getByRole("img", { name: "Harbour" })).toHaveAttribute("loading", "eager");
    expect(screen.getByRole("img", { name: "Harbour" })).toHaveAttribute("sizes", "100vw");
  });

  it("never renders an empty src", () => {
    const { container } = render(<CatalogImage src="" alt="Missing photo" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Missing photo" })).toBeInTheDocument();
  });
});
