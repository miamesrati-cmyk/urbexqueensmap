import { useCallback, useEffect, useRef, useState } from "react";

type OptimisticActionResult<T> = {
  state: T;
  pending: boolean;
  applyOptimistic: (update: (current: T) => T) => void;
  commit: <R>(action: Promise<R>) => Promise<R>;
  rollback: () => void;
};

export function useOptimisticAction<T>(key: string, initialState: T): OptimisticActionResult<T> {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const stateRef = useRef(state);
  const rollbackRef = useRef(initialState);
  const pendingRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Fix: On ne synchronise QUE si le contenu JSON change, pas la référence
  const initialStateJSON = JSON.stringify(initialState);
  useEffect(() => {
    if (pendingRef.current) {
      return;
    }
    setState(initialState);
    rollbackRef.current = initialState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStateJSON, key]);

  const rollback = useCallback(() => {
    setState(rollbackRef.current);
    pendingRef.current = false;
    setPending(false);
  }, []);

  const applyOptimistic = useCallback((update: (current: T) => T) => {
    setState((previous) => {
      rollbackRef.current = previous;
      return update(previous);
    });
  }, []);

  const commit = useCallback(
    <R,>(action: Promise<R>) => {
      pendingRef.current = true;
      setPending(true);
      return action
        .then((result) => {
          pendingRef.current = false;
          setPending(false);
          rollbackRef.current = stateRef.current;
          return result;
        })
        .catch((error) => {
          pendingRef.current = false;
          rollback();
          throw error;
        });
    },
    [rollback]
  );

  return {
    state,
    pending,
    applyOptimistic,
    commit,
    rollback,
  };
}
