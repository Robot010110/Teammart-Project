import { useState } from "react";
import { usePolling } from "./usePolling";
import { listMyNotifications } from "../services/notificationService";
import { listMyConversations } from "../services/chatService";

const POLL_MS = 20000;

// useUnreadBadges.js — polls just enough to keep the bottom-nav badges
// (unread notifications dot on Home, unread message count on Chat)
// honest without each tab needing to lift its own fetch up to the shell.
export function useUnreadBadges() {
  const [notifUnread, setNotifUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);

  usePolling(
    async () => {
      try {
        const { unreadCount } = await listMyNotifications({ limit: 1 });
        setNotifUnread(unreadCount);
      } catch {
        // Badge staying stale for one cycle is fine — not worth surfacing an error for.
      }
    },
    POLL_MS,
    []
  );

  usePolling(
    async () => {
      try {
        const conversations = await listMyConversations();
        setChatUnread(conversations.reduce((sum, c) => sum + c.unreadCount, 0));
      } catch {
        // Same as above.
      }
    },
    POLL_MS,
    []
  );

  return { notifUnread, chatUnread };
}
