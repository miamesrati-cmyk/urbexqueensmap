import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  findOrCreateConversation,
  listenConversations,
  listenMessages,
  sendMessage,
  type Conversation,
  type Message,
} from "../services/dm";
import { uploadDmMedia } from "../services/storage";
import { type ProfileSearchResult } from "../services/userProfiles";
import SearchUsersBar from "./SearchUsersBar";
import { useAuthUI } from "../contexts/useAuthUI";

type Props = {
  partnerId?: string | null;
};

export default function DMPage({ partnerId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { requireAuth } = useAuthUI();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = listenConversations(user.uid, setConvs);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!activeId || !user) return;
    const unsub = listenMessages(activeId, (m) => {
      setMessages(m);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    return () => unsub && unsub();
  }, [activeId, user]);

  useEffect(() => {
    if (!user || !partnerId) return;
    findOrCreateConversation(user.uid, partnerId).then((id) => setActiveId(id));
  }, [partnerId, user]);

  useEffect(() => {
    if (!activeId && convs.length > 0) {
      setActiveId(convs[0].id);
    }
  }, [activeId, convs]);

  const partnerDisplay = useMemo(() => {
    if (!user) return "";
    const currentConv = convs.find((c) => c.id === activeId);
    const other = currentConv?.participantIds.find((p) => p !== user.uid);
    return other ? `@${other.slice(0, 8)}` : "DM";
  }, [activeId, convs, user]);

  const formattedTime = (ts?: number) => {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const formattedDay = (ts?: number) => {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleDateString([], {
        weekday: "short",
        day: "2-digit",
        month: "short",
      });
    } catch {
      return "";
    }
  };

  const activePartnerId = useMemo(() => {
    const currentConv = convs.find((c) => c.id === activeId);
    if (!currentConv || !user) return "";
    return currentConv.participantIds.find((p) => p !== user.uid) ?? "";
  }, [activeId, convs, user]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeId) return;
    if (!draft.trim() && !mediaFile) return;
    let mediaUrl: string | undefined;
    if (mediaFile) {
      setUploading(true);
      try {
        // store under dmMedia/{uidA}/{uidB}/...
        const other =
          convs.find((c) => c.id === activeId)?.participantIds.find((p) => p !== user.uid) ||
          "other";
        mediaUrl = await uploadDmMedia(user.uid, other, mediaFile);
      } finally {
        setUploading(false);
        setMediaFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
    await sendMessage({
      conversationId: activeId,
      fromUid: user.uid,
      text: draft.trim(),
      mediaUrl,
    });
    setDraft("");
  }

  const handleStartDm = async (targetUid: string) => {
    if (!user) return;
    const id = await findOrCreateConversation(user.uid, targetUid);
    setActiveId(id);
    setSidebarOpen(false);
    setSearchTerm("");
    setSearchResults([]);
  };

  const handleSearchResults = useCallback((query: string, results: ProfileSearchResult[]) => {
    setSearchTerm(query.trim());
    setSearchResults(results);
  }, []);

  const handleSearchLoading = useCallback((loading: boolean) => {
    setSearchLoading(loading);
  }, []);

  const searchActive = searchTerm.trim().length > 0;

  if (!user) {
    return (
      <GuestMessagingGuard
        onLogin={() =>
          requireAuth({ mode: "login", reason: "Se connecter" })
        }
        onSignup={() =>
          requireAuth({ mode: "signup", reason: "Créer un compte" })
        }
      />
    );
  }

  return (
    <div className={`dm-shell ${sidebarOpen ? "is-sidebar-open" : ""}`}>
      <aside className={`dm-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="dm-sidebar-head">
          <div className="dm-title">
            <span className="dm-title-icon">💬</span>
            <div className="dm-title-text">
              <span className="dm-title-label">Messages</span>
              <span className="dm-title-sub">Direct</span>
            </div>
          </div>
          <button
            type="button"
            className="dm-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer la liste des messages"
          >
            ✕
          </button>
        </div>

        <div className="dm-search-block">
          <SearchUsersBar
            placeholder="Rechercher un explorateur..."
            onResults={handleSearchResults}
            onLoadingChange={handleSearchLoading}
          />
        </div>

        {searchActive ? (
          <div className="dm-search-results">
            {searchResults.length === 0 && !searchLoading ? (
              <div className="dm-search-empty">Aucun explorateur trouvé</div>
            ) : null}
            {searchResults.map((r) => (
              <button
                key={r.uid}
                type="button"
                className="dm-search-result"
                onClick={() => handleStartDm(r.uid)}
              >
                <div className="dm-search-avatar">
                  {r.photoURL ? (
                    <img src={r.photoURL} alt={r.displayName || r.username || ""} />
                  ) : (
                    (r.displayName || r.username || "?").slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="dm-search-texts">
                  <span className="dm-search-username">@{r.username || r.uid.slice(0, 8)}</span>
                  <span className="dm-search-display">{r.displayName || "Exploratrice"}</span>
                </div>
                {r.isPro ? <span className="dm-search-badge">PRO</span> : null}
              </button>
            ))}
          </div>
        ) : convs.length === 0 ? (
          <div className="dm-sidebar-empty">
            <div className="dm-sidebar-empty-icon">📭</div>
            <div className="dm-sidebar-empty-title">Aucun message pour l’instant.</div>
            <div className="dm-sidebar-empty-sub">
              Découvre un explorateur sur la carte ou le feed pour lui écrire.
            </div>
          </div>
        ) : (
          <div className="dm-conv-list">
            {convs.map((c) => {
              const last = c.lastMessageText || "Commencez la discussion";
              const snippet =
                last.length > 70 ? `${last.slice(0, 70).trimEnd()}…` : last || "Message privé";
              const otherName =
                c.participantIds
                  .filter((p) => p !== user?.uid)
                  .map((p) => "@" + p.slice(0, 8))
                  .join(", ") || "Moi";
              const isActive = activeId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`dm-conv ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    setActiveId(c.id);
                    setSidebarOpen(false);
                  }}
                >
                  <div className="dm-conv-avatar">{otherName.replace("@", "").slice(0, 1)}</div>
                  <div className="dm-conv-body">
                    <div className="dm-conv-top">
                      <span className="dm-conv-name">{otherName}</span>
                      <span className="dm-conv-time">{formattedTime(c.lastMessageAt)}</span>
                    </div>
                    <div className="dm-conv-last">{snippet}</div>
                  </div>
                  {c.lastMessageSender !== user?.uid && c.lastMessageText && (
                    <span className="dm-conv-unread">•</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      <div className="dm-thread">
        <div className="dm-thread-header">
          <button
            type="button"
            className="dm-sidebar-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Afficher la liste des messages"
          >
            <span className="dm-toggle-menu">☰</span>
            <span className="dm-toggle-back">←</span>
          </button>
          <div className="dm-thread-persona">
            <div className="dm-thread-avatar">
              {(partnerDisplay || "DM").replace("@", "").slice(0, 1) || "?"}
            </div>
            <div className="dm-thread-meta">
              <div className="dm-thread-title">{partnerDisplay || "Discussion privée"}</div>
              {activePartnerId ? <div className="dm-thread-tag">Exploratrice</div> : null}
            </div>
          </div>
          <div className="dm-thread-actions">
            {activePartnerId ? <span className="dm-thread-badge">DM</span> : null}
            <button type="button" className="dm-thread-action" aria-label="Plus d’actions">
              …
            </button>
          </div>
        </div>
        <div className="dm-messages">
          {!activeId ? (
            <div className="dm-empty">
              <div className="dm-empty-icon">💌</div>
              <div className="dm-empty-title">Choisis une conversation</div>
              <div className="dm-empty-sub">
                Sélectionne un fil à gauche ou démarre un nouveau message.
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="dm-empty">
              <div className="dm-empty-icon">👻</div>
              <div className="dm-empty-title">Commence la conversation avec cette exploratrice.</div>
              <div className="dm-empty-sub">Partage un spot, une histoire ou une mission urbex.</div>
            </div>
          ) : (
            messages.map((m, index) => {
              const previous = messages[index - 1];
              const currentDay = formattedDay(m.createdAt);
              const prevDay = formattedDay(previous?.createdAt);
              const showDay = currentDay && currentDay !== prevDay;
              return (
                <Fragment key={m.id}>
                  {showDay ? <div className="dm-day-divider">{currentDay}</div> : null}
                  <div
                    className={`dm-message ${m.fromUid === user?.uid ? "from-me" : "from-them"}`}
                  >
                    <div className="dm-bubble">
                      <div className="dm-msg-text">{m.text}</div>
                      {m.mediaUrl && (
                        <a
                          className="dm-msg-media"
                          href={m.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Média
                        </a>
                      )}
                      <div className="dm-msg-meta">{formattedTime(m.createdAt)}</div>
                    </div>
                  </div>
                </Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        {user ? (
          <form className="dm-input" onSubmit={handleSend}>
            <input
              ref={fileInputRef}
              className="dm-hidden-file"
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="dm-file-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Choisir un fichier"
            >
              📎
            </button>
            <div className="dm-input-field">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écris un message urbex…"
              />
              {mediaFile ? <div className="dm-file-chip">{mediaFile.name}</div> : null}
            </div>
            <button type="submit" className="dm-send-btn" disabled={uploading}>
              {uploading ? "Upload..." : "Envoyer"}
            </button>
          </form>
        ) : (
          <div className="dm-need-auth">Connecte-toi pour chatter.</div>
        )}
      </div>
    </div>
  );
}

type GuestMessagingGuardProps = {
  onLogin: () => void;
  onSignup: () => void;
};

function GuestMessagingGuard({ onLogin, onSignup }: GuestMessagingGuardProps) {
  return (
    <div className="guest-messaging-guard">
      <div className="guest-messaging-guard-card">
        <p className="guest-messaging-guard-label">MESSAGERIE</p>
        <h1>La messagerie est réservée aux explorateurs inscrits</h1>
        <p className="guest-messaging-guard-sub">
          Rejoins la communauté pour planifier tes runs, échanger des récits et garder le secret.
        </p>
        <div className="guest-messaging-guard-actions">
          <button type="button" onClick={onLogin}>
            Se connecter
          </button>
          <button type="button" onClick={onSignup}>
            Créer un compte
          </button>
        </div>
      </div>
    </div>
  );
}
