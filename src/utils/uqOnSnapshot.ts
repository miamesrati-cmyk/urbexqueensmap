/**
 * 🔍 UQ_SNAP — Resubscription Loop Tracer
 * Wraps onSnapshot to log subscribe/unsubscribe patterns and identify rapid resubscribers
 */

import type {
  Query,
  DocumentReference,
  DocumentSnapshot,
  QuerySnapshot,
  FirestoreError,
  SnapshotListenOptions,
} from "firebase/firestore";
import { onSnapshot as firestoreOnSnapshot } from "firebase/firestore";

type SnapshotHandler<T> = (snapshot: T) => void;
type ErrorHandler = (error: FirestoreError) => void;

interface SubscriptionStats {
  sub: number;
  unsub: number;
  lastLogMs: number;
  firstStack?: string;
}

const counts = new Map<string, SubscriptionStats>();
const LOG_THROTTLE_MS = 1000;

/**
 * Extract app files from stack trace (lines containing /src/)
 */
function extractAppStack(stack: string): string {
  const lines = stack.split("\n");
  const appLines = lines
    .filter((line) => line.includes("/src/"))
    .slice(0, 3) // Top 3 app frames
    .map((line) => line.trim());
  return appLines.length > 0 ? appLines.join("\n") : "(no app stack)";
}

/**
 * Wrapped onSnapshot for DocumentReference
 */
export function uqOnSnapshot<T = DocumentSnapshot>(
  label: string,
  reference: DocumentReference,
  onNext: SnapshotHandler<DocumentSnapshot>,
  onError?: ErrorHandler,
  options?: SnapshotListenOptions
): () => void;

/**
 * Wrapped onSnapshot for Query
 */
export function uqOnSnapshot<T = QuerySnapshot>(
  label: string,
  query: Query,
  onNext: SnapshotHandler<QuerySnapshot>,
  onError?: ErrorHandler,
  options?: SnapshotListenOptions
): () => void;

/**
 * Implementation
 */
export function uqOnSnapshot(
  label: string,
  refOrQuery: DocumentReference | Query,
  onNext: SnapshotHandler<any>,
  onError?: ErrorHandler,
  options?: SnapshotListenOptions
): () => void {
  // Capture stack at subscribe time
  const stack = new Error(`[UQ_SNAP] ${label}`).stack || "";
  const appStack = extractAppStack(stack);

  // Update counters
  let stats = counts.get(label);
  if (!stats) {
    stats = { sub: 0, unsub: 0, lastLogMs: 0 };
    counts.set(label, stats);
  }
  stats.sub++;
  if (!stats.firstStack) {
    stats.firstStack = appStack;
  }

  // Throttled logging (DEV only)
  if (import.meta.env.DEV) {
    const now = Date.now();
    const shouldLog = now - stats.lastLogMs >= LOG_THROTTLE_MS;
    if (shouldLog) {
      stats.lastLogMs = now;
      console.warn(`[UQ_SNAP] SUB`, {
        label,
        sub: stats.sub,
        unsub: stats.unsub,
        stackTop: appStack.split("\n")[0] || "(none)",
      });
    }
  }

  // Subscribe with real onSnapshot
  let unsubscribe: () => void;
  
  if (options) {
    unsubscribe = onError
      ? (firestoreOnSnapshot as any)(refOrQuery, onNext, onError, options)
      : (firestoreOnSnapshot as any)(refOrQuery, onNext, options);
  } else {
    unsubscribe = onError
      ? (firestoreOnSnapshot as any)(refOrQuery, onNext, onError)
      : (firestoreOnSnapshot as any)(refOrQuery, onNext);
  }

  // Wrap unsubscribe
  return () => {
    stats!.unsub++;
    if (import.meta.env.DEV) {
      const nowUnsub = Date.now();
      const shouldLogUnsub = nowUnsub - stats!.lastLogMs >= LOG_THROTTLE_MS;
      if (shouldLogUnsub) {
        stats!.lastLogMs = nowUnsub;
        console.warn(`[UQ_SNAP] UNSUB`, {
          label,
          sub: stats!.sub,
          unsub: stats!.unsub,
        });
      }
    }
    unsubscribe();
  };
}
