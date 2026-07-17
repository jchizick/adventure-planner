import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import indexSource from "../index.html?raw";
import manifestSource from "../public/site.webmanifest?raw";
import iconSource from "../artwork-source/app-icon.svg?raw";
import maskableSource from "../artwork-source/app-icon-maskable.svg?raw";

const publicAsset = (name: string) => new URL(`../public/${name}`, import.meta.url);

function pngMetadata(name: string) {
  const file = readFileSync(publicAsset(name));
  expect(file.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
    colorType: file[25],
  };
}

describe("app icon package", () => {
  it("publishes the required opaque PNG sizes", () => {
    expect(pngMetadata("apple-touch-icon.png")).toEqual({ width: 180, height: 180, colorType: 2 });
    expect(pngMetadata("favicon-32x32.png")).toEqual({ width: 32, height: 32, colorType: 2 });
    expect(pngMetadata("favicon-16x16.png")).toEqual({ width: 16, height: 16, colorType: 2 });
    expect(pngMetadata("android-chrome-192x192.png")).toEqual({ width: 192, height: 192, colorType: 2 });
    expect(pngMetadata("android-chrome-512x512.png")).toEqual({ width: 512, height: 512, colorType: 2 });
    expect(pngMetadata("android-chrome-maskable-512x512.png")).toEqual({ width: 512, height: 512, colorType: 2 });
  });

  it("keeps the artwork on an opaque brand background with extra maskable padding", () => {
    expect(iconSource).toContain('<rect width="512" height="512" fill="#f7f3ed"');
    expect(iconSource).toContain('x="80" y="80" width="352" height="352"');
    expect(maskableSource).toContain('<rect width="512" height="512" fill="#f7f3ed"');
    expect(maskableSource).toContain('x="112" y="112" width="288" height="288"');
  });

  it("provides a multi-size legacy favicon", () => {
    const favicon = readFileSync(publicAsset("favicon.ico"));
    expect(favicon.readUInt16LE(0)).toBe(0);
    expect(favicon.readUInt16LE(2)).toBe(1);
    expect(favicon.readUInt16LE(4)).toBe(3);
  });

  it("uses stable root-relative HTML metadata links", () => {
    expect(indexSource).toContain('rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"');
    expect(indexSource).toContain('rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"');
    expect(indexSource).toContain('rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"');
    expect(indexSource).toContain('rel="manifest" href="/site.webmanifest"');
    expect(indexSource).toContain('name="theme-color" content="#f7f3ed"');
    expect(indexSource).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(indexSource).toContain('name="apple-mobile-web-app-status-bar-style" content="default"');
    expect(indexSource).toContain('name="apple-mobile-web-app-title" content="Our Adventures"');
  });

  it("configures the standalone manifest and all Android icon purposes", () => {
    expect(JSON.parse(manifestSource)).toEqual(expect.objectContaining({
      name: "Our Adventures",
      short_name: "Our Adventures",
      start_url: "/",
      display: "standalone",
      theme_color: "#f7f3ed",
      background_color: "#f7f3ed",
      icons: [
        expect.objectContaining({ src: "/android-chrome-192x192.png", sizes: "192x192", purpose: "any" }),
        expect.objectContaining({ src: "/android-chrome-512x512.png", sizes: "512x512", purpose: "any" }),
        expect.objectContaining({ src: "/android-chrome-maskable-512x512.png", sizes: "512x512", purpose: "maskable" }),
      ],
    }));
  });
});
