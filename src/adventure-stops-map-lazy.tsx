import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  geoapifyMapStyleUrl,
  stopMapCameraDuration,
  stopMapPadding,
  type AdventureStopsMapModuleProps,
} from "./adventure-stops-map";

function createFlagGlyph() {
  const glyph = document.createElement("span");
  glyph.className = "itinerary-map-flag";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = "⚑";
  return glyph;
}

export default function AdventureStopsMap({
  markers,
  cameraTarget,
  mapKey,
  selectedStopId,
  onSelectStop,
  onFailure,
}: AdventureStopsMapModuleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerInstancesRef = useRef<
    Array<{ stopId: string; marker: MapLibreMarker }>
  >([]);
  const failureReportedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: MapLibreMap;
    const reportFailure = (stage: "initialization" | "style" | "webgl") => {
      if (failureReportedRef.current) return;
      failureReportedRef.current = true;
      onFailure(stage);
    };

    try {
      map = new MapLibreMap({
        container,
        style: geoapifyMapStyleUrl(mapKey),
        center: [0, 0],
        zoom: 1,
        attributionControl: false,
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
        reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      reportFailure(/webgl/i.test(message) ? "webgl" : "initialization");
      return;
    }

    mapRef.current = map;
    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution:
          '<a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> | <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>',
      }),
    );
    let hasLoaded = false;
    const handleLoad = () => {
      hasLoaded = true;
      setReady(true);
    };
    const handleError = () => {
      if (!hasLoaded) reportFailure("style");
    };
    map.on("load", handleLoad);
    map.on("error", handleError);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      markerInstancesRef.current.forEach(({ marker }) => marker.remove());
      markerInstancesRef.current = [];
      map.off("load", handleLoad);
      map.off("error", handleError);
      map.remove();
      mapRef.current = null;
    };
  }, [mapKey, onFailure]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    markerInstancesRef.current.forEach(({ marker }) => marker.remove());
    markerInstancesRef.current = markers.map((marker) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "itinerary-map-marker";
      if (marker.isActualFinalStop)
        element.classList.add("actual-final-stop");
      element.style.setProperty("--stop-color", marker.color);
      element.setAttribute("aria-label", marker.accessibleLabel);
      element.setAttribute("aria-pressed", "false");
      if (marker.isActualFinalStop) element.append(createFlagGlyph());
      else element.textContent = String(marker.displayNumber);
      element.addEventListener("click", () =>
        onSelectStop(marker.stopId),
      );

      return {
        stopId: marker.stopId,
        marker: new MapLibreMarker({
          element,
          offset: [...marker.offset],
        })
          .setLngLat([marker.longitude, marker.latitude])
          .addTo(map),
      };
    });

    return () => {
      markerInstancesRef.current.forEach(({ marker }) => marker.remove());
      markerInstancesRef.current = [];
    };
  }, [markers, onSelectStop, ready]);

  useEffect(() => {
    markerInstancesRef.current.forEach(({ stopId, marker }) => {
      const selected = stopId === selectedStopId;
      const element = marker.getElement();
      element.classList.toggle("selected-stop", selected);
      element.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }, [markers, ready, selectedStopId]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || !ready) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const duration = stopMapCameraDuration(reducedMotion);
    map.resize();
    if (cameraTarget.kind === "single") {
      map.easeTo({
        center: [...cameraTarget.center],
        zoom: cameraTarget.zoom,
        duration,
      });
      return;
    }

    const bounds = new LngLatBounds(
      [...cameraTarget.southwest],
      [...cameraTarget.northeast],
    );
    map.fitBounds(bounds, {
      padding: stopMapPadding(container.clientWidth),
      maxZoom: cameraTarget.maxZoom,
      duration,
      linear: true,
    });
  }, [cameraTarget, markers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedStopId) return;
    const selected = markers.find(
      (marker) => marker.stopId === selectedStopId,
    );
    if (!selected) return;
    map.easeTo({
      center: [selected.longitude, selected.latitude],
      zoom: Math.max(map.getZoom(), 14),
      duration: stopMapCameraDuration(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    });
  }, [markers, ready, selectedStopId]);

  return (
    <div className="map-card map-live-card">
      <div
        ref={containerRef}
        className="adventure-stops-map-canvas"
        role="region"
        aria-label="Map showing confirmed itinerary stops"
      />
      {!ready && (
        <div className="map-render-loading" role="status" aria-live="polite">
          <span className="access-spinner" aria-hidden="true" />
          <span>Loading map tiles…</span>
        </div>
      )}
    </div>
  );
}
