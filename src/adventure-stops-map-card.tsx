import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { MapPin } from "lucide-react";
import type {
  AdventureStopsMapModuleProps,
  PreparedStopMap,
  StopMapCameraTarget,
} from "./adventure-stops-map";

function createLazyAdventureStopsMap() {
  return lazy(() => import("./adventure-stops-map-lazy"));
}

function MapLoadingState() {
  return (
    <div className="map-card map-state-card" role="status" aria-live="polite">
      <span className="access-spinner" aria-hidden="true" />
      <span>Loading stop map…</span>
    </div>
  );
}

function MapFailureState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="map-card map-state-card map-failure" role="alert">
      <MapPin aria-hidden="true" />
      <span>The stop map could not be loaded.</span>
      <button type="button" onClick={onRetry}>
        Retry map
      </button>
    </div>
  );
}

class MapChunkBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    if (import.meta.env.DEV)
      console.error("Adventure stop map failed during chunk loading.");
  }

  render() {
    return this.state.failed ? (
      <MapFailureState onRetry={this.props.onRetry} />
    ) : (
      this.props.children
    );
  }
}

export function AdventureStopsMapCard({
  preparedMap,
  cameraTarget,
  mapKey,
  selectedStopId,
  onSelectStop,
  mapComponent,
}: {
  preparedMap: PreparedStopMap;
  cameraTarget: StopMapCameraTarget | null;
  mapKey: string;
  selectedStopId: string | null;
  onSelectStop: (stopId: string) => void;
  mapComponent?: ComponentType<AdventureStopsMapModuleProps>;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [lazyMapComponent, setLazyMapComponent] = useState(
    createLazyAdventureStopsMap,
  );
  const MapComponent = mapComponent ?? lazyMapComponent;
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [runtimeFailure, setRuntimeFailure] = useState(false);
  const retry = () => {
    setRuntimeFailure(false);
    setRetryAttempt((current) => current + 1);
    if (!mapComponent) setLazyMapComponent(createLazyAdventureStopsMap());
    window.requestAnimationFrame(() => sectionRef.current?.focus());
  };
  const handleRuntimeFailure = useCallback(
    (stage: "initialization" | "style" | "webgl") => {
      if (import.meta.env.DEV)
        console.error(`Adventure stop map failed during ${stage}.`);
      setRuntimeFailure(true);
    },
    [],
  );

  if (preparedMap.totalStops === 0) return null;

  const mapStatus =
    preparedMap.mappedCount === preparedMap.totalStops
      ? `${preparedMap.mappedCount} ${preparedMap.mappedCount === 1 ? "stop" : "stops"} mapped.`
      : `${preparedMap.mappedCount} of ${preparedMap.totalStops} stops mapped.`;
  const finalStopUnmapped =
    preparedMap.totalStops > 0 && !preparedMap.finalStopMapped;

  let mapContent: ReactNode;
  if (preparedMap.mappedCount === 0 || !cameraTarget) {
    mapContent = (
      <div className="map-card map-state-card map-unmapped">
        <MapPin aria-hidden="true" />
        <span>Select stop locations to see them on the map.</span>
      </div>
    );
  } else if (!mapKey.trim()) {
    mapContent = (
      <div className="map-card map-state-card map-configuration" role="status">
        <MapPin aria-hidden="true" />
        <span>The stop map is not configured yet.</span>
      </div>
    );
  } else if (runtimeFailure) {
    mapContent = <MapFailureState onRetry={retry} />;
  } else {
    mapContent = (
      <MapChunkBoundary key={retryAttempt} onRetry={retry}>
        <Suspense fallback={<MapLoadingState />}>
          <MapComponent
            key={retryAttempt}
            markers={preparedMap.markers}
            cameraTarget={cameraTarget}
            mapKey={mapKey}
            selectedStopId={selectedStopId}
            onSelectStop={onSelectStop}
            onFailure={handleRuntimeFailure}
          />
        </Suspense>
      </MapChunkBoundary>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="itinerary-map"
      aria-label="Itinerary stop map"
      tabIndex={-1}
    >
      <div className="itinerary-map-status" aria-live="polite">
        <span>{mapStatus}</span>
        {finalStopUnmapped && (
          <strong>Final stop not mapped — select a location.</strong>
        )}
      </div>
      {mapContent}
    </section>
  );
}
