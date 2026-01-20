import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

const STORY_STATUSES = [
  { key: "active", label: "Exploration active" },
  { key: "unstable", label: "Lieu instable" },
  { key: "sealed", label: "Entrée scellée" },
  { key: "lost", label: "Accès perdu" },
] as const;

export type StoryStatusKey = (typeof STORY_STATUSES)[number]["key"];

export const storyStatusLabel = (status?: StoryStatusKey | null): string | null => {
  if (!status) {
    return null;
  }
  return STORY_STATUSES.find((entry) => entry.key === status)?.label ?? null;
};

export type StoryEditorPublishPayload = {
  status?: StoryStatusKey;
  location?: string;
  danger: number;
};

const TEXT_SIZE_OPTIONS = [18, 22, 28];
const EMOJI_LIBRARY = ["🔥", "⚠️", "🗺️", "🕳️", "🧭"];
const DANGER_LABELS = [
  { max: 20, label: "Calme" },
  { max: 40, label: "Risque" },
  { max: 60, label: "Instable" },
  { max: 80, label: "Dangereux" },
  { max: 100, label: "Interdit" },
];

type StoryTool = "text" | "emoji" | "location" | "danger";

type TextSticker = {
  id: string;
  x: number;
  y: number;
  text: string;
  size: number;
};

type EmojiSticker = {
  id: string;
  x: number;
  y: number;
  emoji: string;
  scale: number;
};

type StoryEditorModalProps = {
  open: boolean;
  file: File | null;
  previewUrl: string | null;
  initialStatus?: StoryStatusKey | null;
  initialLocation?: string;
  initialDanger?: number;
  onClose: () => void;
  onPublish: (payload: StoryEditorPublishPayload) => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const createStickerId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sticker-${Math.random().toString(36).slice(2, 10)}`;

export default function StoryEditorModal({
  open,
  file,
  previewUrl,
  initialStatus,
  initialLocation,
  initialDanger,
  onClose,
  onPublish,
}: StoryEditorModalProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const draggingStickerRef = useRef<{
    id: string;
    type: "text" | "emoji";
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [statusOpen, setStatusOpen] = useState(false);
  const [status, setStatus] = useState<StoryStatusKey | null>(initialStatus ?? null);
  const [location, setLocation] = useState(initialLocation ?? "");
  const [danger, setDanger] = useState(() => clamp(initialDanger ?? 40, 0, 100));
  const [activeTool, setActiveTool] = useState<StoryTool>("text");
  const [textStickers, setTextStickers] = useState<TextSticker[]>([]);
  const [emojiStickers, setEmojiStickers] = useState<EmojiSticker[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setStatus(initialStatus ?? null);
    setLocation(initialLocation ?? "");
    setDanger(clamp(initialDanger ?? 40, 0, 100));
    setTextStickers([]);
    setEmojiStickers([]);
    setActiveTool("text");
    setStatusOpen(false);
  }, [open, initialStatus, initialLocation, initialDanger]);

  useEffect(() => {
    if (open) {
      setIsPublishing(false);
    }
  }, [open]);

  const addTextSticker = useCallback(
    (x: number, y: number) => {
      setTextStickers((prev) => [
        ...prev,
        {
          id: createStickerId(),
          x,
          y,
          text: "Expédition",
          size: TEXT_SIZE_OPTIONS[prev.length % TEXT_SIZE_OPTIONS.length],
        },
      ]);
    },
    [setTextStickers]
  );

  const addEmojiSticker = useCallback(
    (x: number, y: number, emoji = EMOJI_LIBRARY[Math.floor(Math.random() * EMOJI_LIBRARY.length)]) => {
      setEmojiStickers((prev) => [
        ...prev,
        {
          id: createStickerId(),
          x,
          y,
          emoji,
          scale: 1,
        },
      ]);
    },
    [setEmojiStickers]
  );

  const handleEmojiToolSelect = useCallback(() => {
    setActiveTool("emoji");
    addEmojiSticker(0.5, 0.5);
  }, [addEmojiSticker]);

  const handleStickerMove = useCallback(
    (event: PointerEvent) => {
      const drag = draggingStickerRef.current;
      if (!drag || !canvasRef.current) {
        return;
      }
      if (typeof window === "undefined") {
        return;
      }
      const rect = canvasRef.current.getBoundingClientRect();
      const rawX = event.clientX - rect.left - drag.offsetX;
      const rawY = event.clientY - rect.top - drag.offsetY;
      const x = clamp(rawX / rect.width, 0, 1);
      const y = clamp(rawY / rect.height, 0, 1);
      if (drag.type === "text") {
        setTextStickers((prev) =>
          prev.map((sticker) => (sticker.id === drag.id ? { ...sticker, x, y } : sticker))
        );
        return;
      }
      setEmojiStickers((prev) =>
        prev.map((sticker) => (sticker.id === drag.id ? { ...sticker, x, y } : sticker))
      );
    },
    [setEmojiStickers, setTextStickers]
  );

  const handleStickerEnd = useCallback(() => {
    draggingStickerRef.current = null;
    if (typeof window === "undefined") {
      return;
    }
    window.removeEventListener("pointermove", handleStickerMove);
    window.removeEventListener("pointerup", handleStickerEnd);
    window.removeEventListener("pointercancel", handleStickerEnd);
  }, [handleStickerMove]);

  useEffect(() => {
    return () => {
      handleStickerEnd();
    };
  }, [handleStickerEnd]);

  const startDraggingSticker = useCallback(
    (type: "text" | "emoji", sticker: TextSticker | EmojiSticker) => (
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      event.stopPropagation();
      if (!canvasRef.current) {
        return;
      }
      const rect = canvasRef.current.getBoundingClientRect();
      const offsetX = event.clientX - (rect.left + sticker.x * rect.width);
      const offsetY = event.clientY - (rect.top + sticker.y * rect.height);
      draggingStickerRef.current = { id: sticker.id, type, offsetX, offsetY };
      if (typeof window === "undefined") {
        return;
      }
      window.addEventListener("pointermove", handleStickerMove);
      window.addEventListener("pointerup", handleStickerEnd);
      window.addEventListener("pointercancel", handleStickerEnd);
    },
    [handleStickerEnd, handleStickerMove]
  );

  const handleCanvasPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (activeTool !== "text") {
        return;
      }
      if (draggingStickerRef.current) {
        return;
      }
      if (!canvasRef.current) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest(".uq-story-sticker")) {
        return;
      }
      const rect = canvasRef.current.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      addTextSticker(x, y);
    },
    [activeTool, addTextSticker]
  );

  const handleStatusChange = useCallback((nextStatus: StoryStatusKey) => {
    setStatus(nextStatus);
    setStatusOpen(false);
  }, []);

  const dangerDescriptor = useMemo(
    () => DANGER_LABELS.find((entry) => danger <= entry.max)?.label ?? "Interdit",
    [danger]
  );

  const handlePublish = useCallback(async () => {
    if (!previewUrl || isPublishing) {
      return;
    }
    setIsPublishing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 380));
      onPublish({
        status: status ?? undefined,
        location: location.trim() || undefined,
        danger,
      });
    } finally {
      setIsPublishing(false);
    }
  }, [danger, isPublishing, location, onPublish, previewUrl, status]);

  if (!open) {
    return null;
  }

  const isVideo = file?.type.startsWith("video/");
  const statusLabel = storyStatusLabel(status);

  return (
    <div className="uq-story-modal-backdrop" role="dialog" aria-modal="true">
      <div className="uq-story-modal">
        <div className="uq-story-editor">
          <div className="uq-story-editor-top">
            <button type="button" className="uq-story-editor-close" onClick={onClose}>
              ×
            </button>
            <button
              type="button"
              className="uq-story-editor-publish"
              onClick={handlePublish}
              disabled={!previewUrl || isPublishing}
            >
              {isPublishing && <span className="uq-story-spinner" aria-hidden="true" />}
              Publier
            </button>
          </div>
          <div
            className="uq-story-editor-preview"
            ref={canvasRef}
            onPointerUp={handleCanvasPointerUp}
          >
            {previewUrl ? (
              isVideo ? (
                <video src={previewUrl} autoPlay muted loop playsInline />
              ) : (
                <img src={previewUrl} alt="Story preview" />
              )
            ) : (
              <div className="uq-story-preview-placeholder">Sélectionne une photo ou vidéo</div>
            )}
            {statusLabel && (
              <div className="uq-story-stamp">{statusLabel}</div>
            )}
            {location && (
              <div className="uq-story-pill">{location}</div>
            )}
            {textStickers.map((sticker) => (
              <div
                key={sticker.id}
                className="uq-story-sticker uq-story-text"
                style={{
                  left: `${sticker.x * 100}%`,
                  top: `${sticker.y * 100}%`,
                  fontSize: `${sticker.size}px`,
                }}
                onPointerDown={startDraggingSticker("text", sticker)}
              >
                {sticker.text}
              </div>
            ))}
            {emojiStickers.map((sticker) => (
              <div
                key={sticker.id}
                className="uq-story-sticker uq-story-emoji"
                style={{
                  left: `${sticker.x * 100}%`,
                  top: `${sticker.y * 100}%`,
                  transform: `translate(-50%, -50%) scale(${sticker.scale})`,
                }}
                onPointerDown={startDraggingSticker("emoji", sticker)}
              >
                {sticker.emoji}
              </div>
            ))}
          </div>

          <div className="uq-story-tools">
            <button
              type="button"
              className={`uq-tool-chip${statusOpen ? " is-active" : ""}`}
              onClick={() => setStatusOpen((prev) => !prev)}
            >
              Statut
            </button>
            <button
              type="button"
              className={`uq-tool-chip${activeTool === "text" ? " is-active" : ""}`}
              onClick={() => setActiveTool("text")}
            >
              Texte
            </button>
            <button
              type="button"
              className={`uq-tool-chip${activeTool === "emoji" ? " is-active" : ""}`}
              onClick={handleEmojiToolSelect}
            >
              Emoji
            </button>
            <button
              type="button"
              className={`uq-tool-chip${activeTool === "location" ? " is-active" : ""}`}
              onClick={() => setActiveTool("location")}
            >
              Lieu
            </button>
            <button
              type="button"
              className={`uq-tool-chip${activeTool === "danger" ? " is-active" : ""}`}
              onClick={() => setActiveTool("danger")}
            >
              Danger🔥
            </button>
          </div>

          {statusOpen && (
            <div className="uq-story-status-panel">
              {STORY_STATUSES.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className={`uq-story-status-option${status === entry.key ? " is-active" : ""}`}
                  onClick={() => handleStatusChange(entry.key)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          )}

          {activeTool === "location" && (
            <div className="uq-story-location">
              <input
                type="text"
                value={location}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setLocation(event.target.value)}
                placeholder="Lieu"
              />
            </div>
          )}

          {activeTool === "danger" && (
            <div className="uq-danger">
              <div className="uq-danger-top">
                <span className="uq-danger-ico">🔥 Danger</span>
                <span>{danger}%</span>
              </div>
              <p className="uq-danger-meter">{dangerDescriptor}</p>
              <input
                type="range"
                min={0}
                max={100}
                value={danger}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setDanger(clamp(Number(event.target.value), 0, 100))
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
