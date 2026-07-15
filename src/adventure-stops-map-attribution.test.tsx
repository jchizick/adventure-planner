// @vitest-environment jsdom

import { cleanup, fireEvent } from "@testing-library/react";
import { AttributionControl, type Map as MapLibreMap } from "maplibre-gl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collapseAttributionControl } from "./adventure-stops-map-lazy";

const attributionHtml =
  '<a href="https://www.geoapify.com/">Geoapify</a> | ' +
  '<a href="https://openmaptiles.org/">© OpenMapTiles</a> | ' +
  '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>';

function addAttributionControl() {
  const host = document.createElement("div");
  const canvas = document.createElement("div");
  Object.defineProperty(canvas, "offsetWidth", {
    value: 320,
    configurable: true,
  });
  const map = {
    style: { stylesheet: null, tileManagers: {} },
    getCanvasContainer: () => canvas,
    _getUIString: () => "Toggle attribution",
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as MapLibreMap;
  const control = new AttributionControl({
    compact: true,
    customAttribution: attributionHtml,
  });
  host.append(control.onAdd(map));
  return host;
}

afterEach(cleanup);

describe("Adventure stop map attribution", () => {
  it("starts collapsed while preserving one accessible, normally toggled control", () => {
    const host = addAttributionControl();

    expect(collapseAttributionControl(host)).toBe(true);
    const controls = host.querySelectorAll(".maplibregl-ctrl-attrib");
    expect(controls).toHaveLength(1);
    const control = controls[0] as HTMLElement;
    const button = control.querySelector<HTMLElement>(
      ".maplibregl-ctrl-attrib-button",
    );
    expect(button?.tagName).toBe("SUMMARY");
    expect(button?.tabIndex).toBe(0);
    expect(button?.getAttribute("aria-label")).toBe("Toggle attribution");
    expect(control.classList.contains("maplibregl-compact-show")).toBe(false);
    expect(control.hasAttribute("open")).toBe(false);
    expect(control.textContent).toContain("Geoapify");
    expect(control.textContent).toContain("OpenMapTiles");
    expect(control.textContent).toContain("OpenStreetMap contributors");

    fireEvent.click(button!);
    expect(control.classList.contains("maplibregl-compact-show")).toBe(true);
    expect(control.hasAttribute("open")).toBe(true);
    fireEvent.click(button!);
    expect(control.classList.contains("maplibregl-compact-show")).toBe(false);
    expect(control.hasAttribute("open")).toBe(false);
  });

  it("fails safely when MapLibre's expected compact DOM is unavailable", () => {
    const host = document.createElement("div");
    host.innerHTML =
      '<details open class="maplibregl-ctrl-attrib maplibregl-compact maplibregl-compact-show">' +
      '<div class="maplibregl-ctrl-attrib-inner">Attribution</div></details>';

    expect(collapseAttributionControl(host)).toBe(false);
    expect(host.querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(
      host.querySelector("details")?.classList.contains(
        "maplibregl-compact-show",
      ),
    ).toBe(true);
    expect(host.textContent).toBe("Attribution");
  });
});
