import { useEffect, useMemo, useState, type FormEvent } from "react";
import { listenComments, addComment } from "../services/comments";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";

type Props = {
  placeId: string;
};

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("fr-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommentsSection({ placeId }: Props) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const { user } = useCurrentUserRole();

  useEffect(() => {
    const unsub = listenComments(placeId, setComments);
    return () => unsub();
  }, [placeId]);

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => b.createdAt - a.createdAt);
  }, [comments]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) {
      setError("Connecte-toi pour commenter.");
      return;
    }
    if (!text.trim()) return;
    try {
      setSending(true);
      await addComment({
        placeId,
        userId: user.uid,
        displayName: user.displayName || user.email?.split("@")[0] || "explorateur",
        text: text.trim().slice(0, 500),
      });
      setText("");
    } catch (err: any) {
      console.error("Erreur commentaire", err);
      setError("Impossible d’ajouter ton commentaire.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="comments-section">
      <div className="comments-header">
        <h2>Commentaires</h2>
        <p>Partage ton ressenti sur ce spot.</p>
      </div>
      {error && <p className="comments-error">{error}</p>}
      {user ? (
        <form className="comments-form" onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ton commentaire ici..."
            rows={4}
            maxLength={500}
          />
          <button type="submit" disabled={sending || !text.trim()}>
            {sending ? "Publication..." : "Publier"}
          </button>
        </form>
      ) : (
        <p className="comments-guest">
          Connecte-toi pour laisser un commentaire et rejoindre l’équipage.
        </p>
      )}
      <div className="comments-list">
        {sortedComments.map((comment) => (
          <article key={comment.id} className="comment-card">
            <div className="comment-card-head">
              <span className="comment-avatar">
                {(comment.displayName || "Explorateur").charAt(0)}
              </span>
              <div>
                <p className="comment-author">{comment.displayName}</p>
                <p className="comment-date">{formatDate(comment.createdAt)}</p>
              </div>
            </div>
            <p className="comment-body">{comment.text}</p>
          </article>
        ))}
        {sortedComments.length === 0 && (
          <p className="comments-empty">Soyez le premier à réagir à ce spot.</p>
        )}
      </div>
    </div>
  );
}
