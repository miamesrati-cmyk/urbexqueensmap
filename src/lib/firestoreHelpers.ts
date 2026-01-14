import { 
  onSnapshot as firestoreOnSnapshot, 
  type Query, 
  type DocumentReference, 
  type FirestoreError,
  type DocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
  type DocumentData
} from "firebase/firestore";

/**
 * Wrapper around Firestore onSnapshot for documents that gracefully handles permission-denied errors
 * This prevents console spam from permission errors on documents that don't exist or user can't access
 */
export function onSnapshot<AppModelType = DocumentData, DbModelType extends DocumentData = DocumentData>(
  reference: DocumentReference<AppModelType, DbModelType>,
  onNext: (snapshot: DocumentSnapshot<AppModelType, DbModelType>) => void,
  onError?: (error: FirestoreError) => void,
  onCompletion?: () => void
): Unsubscribe;

/**
 * Wrapper around Firestore onSnapshot for queries that gracefully handles permission-denied errors
 */
export function onSnapshot<AppModelType = DocumentData, DbModelType extends DocumentData = DocumentData>(
  reference: Query<AppModelType, DbModelType>,
  onNext: (snapshot: QuerySnapshot<AppModelType, DbModelType>) => void,
  onError?: (error: FirestoreError) => void,
  onCompletion?: () => void
): Unsubscribe;

/**
 * Implementation
 */
export function onSnapshot<AppModelType = DocumentData, DbModelType extends DocumentData = DocumentData>(
  reference: DocumentReference<AppModelType, DbModelType> | Query<AppModelType, DbModelType>,
  onNext: ((snapshot: DocumentSnapshot<AppModelType, DbModelType>) => void) | ((snapshot: QuerySnapshot<AppModelType, DbModelType>) => void),
  onError?: (error: FirestoreError) => void,
  onCompletion?: () => void
): Unsubscribe {
  const errorHandler = (error: FirestoreError) => {
    // Silently ignore permission-denied and insufficient permissions errors
    if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
      // Call completion handler if provided
      if (onCompletion) {
        onCompletion();
      }
      return;
    }
    
    // Handle CORS/network errors from Firestore
    if (error.code === 'unavailable' || error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
      console.warn('[Firestore] Network/CORS error - check Firebase Console configuration:', {
        code: error.code,
        message: error.message,
        troubleshooting: [
          '1. Firebase Console → Authentication → Authorized domains → Add "localhost"',
          '2. Google Cloud Console → API Key → Add "http://localhost:*" to HTTP referrers',
          '3. Clear browser cache and disable extensions',
          '4. Check if API key is restricted'
        ]
      });
      if (onCompletion) {
        onCompletion();
      }
      return;
    }
    
    // For other errors, call the provided error handler or log
    if (onError) {
      onError(error);
    } else {
      console.error("[Firestore] Snapshot error:", error);
    }
  };

  try {
    return firestoreOnSnapshot(reference as any, onNext as any, errorHandler, onCompletion);
  } catch (error) {
    // If onSnapshot itself throws an error (e.g., during query setup), handle it
    console.warn("[Firestore] onSnapshot setup error:", error);
    // Return a no-op unsubscribe function
    return () => {};
  }
}
