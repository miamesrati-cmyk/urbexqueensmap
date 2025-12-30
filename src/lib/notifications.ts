export type NotificationType = "follow" | "like" | "comment" | "pro" | "spot";

export type NotificationActorSnapshot = {
  displayName?: string | null;
  username?: string | null;
  photoURL?: string | null;
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  actorId?: string;
  targetUserId: string;
  postId?: string;
  commentId?: string;
  createdAt: number;
  isRead: boolean;
  actorSnapshot?: NotificationActorSnapshot;
  message?: string;
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  follow: "Abonnement",
  like: "Like",
  comment: "Commentaire",
  pro: "Alertes PRO",
  spot: "Spot",
};

const NOW = Date.now();

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "follow-1",
    type: "follow",
    targetUserId: "dev",
    createdAt: NOW - 2 * 60 * 1000,
    isRead: false,
    actorSnapshot: {
      displayName: "Camila",
      username: "camila.urbex",
      photoURL:
        "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=64&h=64&q=60",
    },
  },
  {
    id: "like-1",
    type: "like",
    targetUserId: "dev",
    createdAt: NOW - 14 * 60 * 1000,
    isRead: false,
    actorSnapshot: {
      displayName: "Lola",
      username: "lola.adventures",
      photoURL:
        "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=64&h=64&q=60",
    },
  },
  {
    id: "comment-1",
    type: "comment",
    targetUserId: "dev",
    createdAt: NOW - 35 * 60 * 1000,
    isRead: false,
    message: "Tu dois vraiment partager la route complète !",
    actorSnapshot: {
      displayName: "Lola",
      username: "lola.adventures",
      photoURL:
        "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=64&h=64&q=60",
    },
  },
];

export function createNotificationSeed(): NotificationItem[] {
  return INITIAL_NOTIFICATIONS.map((entry) => ({ ...entry }));
}

export function getNotificationMessage(item: NotificationItem): string {
  const actor = item.actorSnapshot;
  const actorName = actor?.displayName || actor?.username || "Quelqu’un";
  switch (item.type) {
    case "follow":
      return `${actorName} te suit`;
    case "like":
      return `${actorName} a aimé ta publication`;
    case "comment":
      return `${actorName} a commenté ta publication`;
    case "pro":
      return item.message ?? "Nouvelle alerte PRO";
    case "spot":
      return item.message ?? "Nouveau spot près de toi";
    default:
      return item.message ?? "Nouvelle activité";
  }
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Math.max(0, Date.now() - timestamp);
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

export function getUnreadCount(items: NotificationItem[]): number {
  return items.filter((entry) => !entry.isRead).length;
}

export function markAllAsRead(items: NotificationItem[]): NotificationItem[] {
  return items.map((entry) => ({ ...entry, isRead: true }));
}

export function markNotificationAsRead(items: NotificationItem[], id: string): NotificationItem[] {
  return items.map((entry) => (entry.id === id ? { ...entry, isRead: true } : entry));
}
