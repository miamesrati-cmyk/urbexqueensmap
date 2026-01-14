import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "../../../lib/firebase";
import { useToast } from "../../../contexts/useToast";
import { savePostForUser, unsavePostForUser } from "../../../services/savedPosts";
import { useHaptics } from "./useHaptics";
import "./saveButton.css";

type SaveButtonProps = {
  postId: string;
  initialSaved?: boolean;
  onRequireAuth?: () => void;
  className?: string;
};

export function SaveButton({
  postId,
  initialSaved = false,
  onRequireAuth,
  className = "",
}: SaveButtonProps) {
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isAnimating, setIsAnimating] = useState(false);
  const toast = useToast();
  const { tap, success } = useHaptics();
  const animationTimer = useRef<number | null>(null);

  useEffect(() => {
    setIsSaved(initialSaved);
  }, [initialSaved]);

  useEffect(() => {
    return () => {
      if (animationTimer.current) {
        window.clearTimeout(animationTimer.current);
      }
    };
  }, []);

  const runAnimation = useCallback(() => {
    setIsAnimating(true);
    if (animationTimer.current) {
      window.clearTimeout(animationTimer.current);
    }
    animationTimer.current = window.setTimeout(() => {
      setIsAnimating(false);
    }, 600);
  }, []);

  const handleToggle = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      onRequireAuth?.();
      return;
    }

    const previousValue = isSaved;
    const nextValue = !previousValue;
    setIsSaved(nextValue);
    runAnimation();
    tap();

    try {
      if (nextValue) {
        await savePostForUser(currentUser.uid, postId);
      } else {
        await unsavePostForUser(currentUser.uid, postId);
      }
      success();
    } catch (error) {
      console.error("[SaveButton]", error);
      setIsSaved(previousValue);
      toast.error("Impossible de mettre à jour tes favoris pour l'instant.");
    }
  }, [isSaved, onRequireAuth, postId, runAnimation, toast]);

  return (
    <button
      type="button"
      className={`save-button ${isSaved ? "is-saved" : ""} ${
        isAnimating ? "is-animating" : ""
      } ${className}`}
      aria-label={isSaved ? "Retirer des favoris" : "Ajouter aux favoris"}
      onClick={handleToggle}
    >
      {isSaved ? "🔖" : "📌"}
    </button>
  );
}
