import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../services/api";

interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  dependencies: unknown[],
): ApiState<T> & { reload: () => void } {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const [reloadToken, setReloadToken] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: null, loading: true });

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError(
                error instanceof Error ? error.message : "Unexpected API error",
                0,
                "unknown_error",
              );
        setState({ data: null, error: apiError, loading: false });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  return { ...state, reload };
}
