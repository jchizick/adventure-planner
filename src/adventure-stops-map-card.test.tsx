// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import cardSource from "./adventure-stops-map-card.tsx?raw";
import lazyMapSource from "./adventure-stops-map-lazy.tsx?raw";
import pagesSource from "./pages.tsx?raw";
import { AdventureStopsMapCard } from "./adventure-stops-map-card";
import type {
  AdventureStopsMapModuleProps,
  PreparedStopMap,
  StopMapCameraTarget,
} from "./adventure-stops-map";

const cameraTarget: StopMapCameraTarget = {
  kind: "single",
  center: [-79.38, 43.65],
  zoom: 14,
};

function prepared(overrides: Partial<PreparedStopMap> = {}): PreparedStopMap {
  return {
    markers: [
      {
        stopId: "stop-1",
        title: "Museum",
        displayIndex: 0,
        displayNumber: 1,
        color: "#b94d45",
        isActualFinalStop: true,
        latitude: 43.65,
        longitude: -79.38,
        offset: [0, 0],
        accessibleLabel: "Final stop 1: Museum",
      },
    ],
    totalStops: 1,
    mappedCount: 1,
    finalStopMapped: true,
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("AdventureStopsMapCard", () => {
  it("renders nothing and requests no lazy module for an empty itinerary", () => {
    const { container } = render(
      <AdventureStopsMapCard
        preparedMap={prepared({ markers: [], totalStops: 0, mappedCount: 0, finalStopMapped: false })}
        cameraTarget={null}
        mapKey="map-key"
        selectedStopId={null}
        onSelectStop={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows the zero-confirmed prompt without requesting MapLibre", () => {
    const MapComponent = vi.fn(() => <div>Unexpected map</div>);
    render(
      <AdventureStopsMapCard
        preparedMap={prepared({ markers: [], totalStops: 2, mappedCount: 0, finalStopMapped: false })}
        cameraTarget={null}
        mapKey="map-key"
        selectedStopId={null}
        onSelectStop={vi.fn()}
        mapComponent={MapComponent}
      />,
    );
    expect(screen.getByText("Select stop locations to see them on the map.")).toBeTruthy();
    expect(screen.getByText("Final stop not mapped — select a location.")).toBeTruthy();
    expect(MapComponent).not.toHaveBeenCalled();
  });

  it("shows a concise missing-key state without requesting MapLibre", () => {
    const MapComponent = vi.fn(() => <div>Unexpected map</div>);
    render(
      <AdventureStopsMapCard
        preparedMap={prepared()}
        cameraTarget={cameraTarget}
        mapKey="  "
        selectedStopId={null}
        onSelectStop={vi.fn()}
        mapComponent={MapComponent}
      />,
    );
    expect(screen.getByText("The stop map is not configured yet.")).toBeTruthy();
    expect(MapComponent).not.toHaveBeenCalled();
  });

  it("renders the map module only when mapped stops and a key exist", () => {
    const MapComponent = () => <div>Live renderer</div>;
    render(
      <AdventureStopsMapCard
        preparedMap={prepared()}
        cameraTarget={cameraTarget}
        mapKey="map-key"
        selectedStopId={null}
        onSelectStop={vi.fn()}
        mapComponent={MapComponent}
      />,
    );
    expect(screen.getByText("Live renderer")).toBeTruthy();
  });

  it("recovers from a runtime failure without removing adjacent itinerary UI", async () => {
    const MapComponent = ({ onFailure }: AdventureStopsMapModuleProps) => (
        <button type="button" onClick={() => onFailure("style")}>
          Simulate style failure
        </button>
      );
    render(
      <>
        <AdventureStopsMapCard
          preparedMap={prepared()}
          cameraTarget={cameraTarget}
          mapKey="map-key"
          selectedStopId={null}
          onSelectStop={vi.fn()}
          mapComponent={MapComponent}
        />
        <div>Itinerary remains available</div>
      </>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Simulate style failure" }));
    expect(screen.getByText("The stop map could not be loaded.")).toBeTruthy();
    expect(screen.getByText("Itinerary remains available")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Simulate style failure" })).toBeTruthy());
    await waitFor(() =>
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "Itinerary stop map",
      ),
    );
  });

  it("reports partial coverage and the true unresolved final stop", () => {
    const MapComponent = () => <div>Live renderer</div>;
    render(
      <AdventureStopsMapCard
        preparedMap={prepared({ totalStops: 3, mappedCount: 1, finalStopMapped: false })}
        cameraTarget={cameraTarget}
        mapKey="map-key"
        selectedStopId={null}
        onSelectStop={vi.fn()}
        mapComponent={MapComponent}
      />,
    );
    expect(screen.getByText("1 of 3 stops mapped.")).toBeTruthy();
    expect(screen.getByText("Final stop not mapped — select a location.")).toBeTruthy();
  });

  it("keeps the MapLibre runtime and stylesheet behind the lazy boundary", () => {
    expect(cardSource).toContain('lazy(() =>');
    expect(cardSource).toContain('import("./adventure-stops-map-lazy")');
    expect(lazyMapSource).toContain('from "maplibre-gl"');
    expect(lazyMapSource).toContain('maplibre-gl/dist/maplibre-gl.css');
    expect(lazyMapSource).toContain("https://openmaptiles.org/");
    expect(lazyMapSource).toContain("© OpenStreetMap contributors");
    expect(cardSource).not.toContain('from "maplibre-gl"');
    expect(pagesSource).not.toContain('from "maplibre-gl"');
    expect(pagesSource).not.toContain("route-line");
  });
});
