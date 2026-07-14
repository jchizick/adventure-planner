import { supabase } from "../lib/supabase";
import { parseLocationSearchResponse } from "../location-candidate";
import type { LocationCandidate } from "../types";

export type LocationSearchRequest = {
  spaceId: string;
  query: string;
  adventureId?: string;
};

type InvocationResult = {
  data: unknown;
  error: { message: string } | null;
};

export type LocationSearchInvoker = (
  request: LocationSearchRequest,
  signal?: AbortSignal,
) => Promise<InvocationResult>;

export class LocationSearchError extends Error {
  constructor(message = "Location search is temporarily unavailable.") {
    super(message);
    this.name = "LocationSearchError";
  }
}

function abortError() {
  return new DOMException("Location search was cancelled.", "AbortError");
}

export function createLocationCandidateSearch(invoker: LocationSearchInvoker) {
  return async function searchLocationCandidates(
    request: LocationSearchRequest,
    options?: { signal?: AbortSignal },
  ): Promise<LocationCandidate[]> {
    if (options?.signal?.aborted) throw abortError();
    const { data, error } = await invoker(request, options?.signal);
    if (options?.signal?.aborted) throw abortError();
    if (error) throw new LocationSearchError();
    const candidates = parseLocationSearchResponse(data);
    if (!candidates) throw new LocationSearchError("Invalid location response.");
    return candidates;
  };
}

const invokeSearchLocations: LocationSearchInvoker = async (request, signal) => {
  const { data, error } = await supabase.functions.invoke("search-locations", {
    body: request,
    signal,
  });
  return {
    data: data as unknown,
    error: error ? { message: error.message } : null,
  };
};

export const searchLocationCandidates = createLocationCandidateSearch(
  invokeSearchLocations,
);
