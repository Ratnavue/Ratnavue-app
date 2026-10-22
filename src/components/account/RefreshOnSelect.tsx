"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Forces a full router refresh (re-running every server component in the
 * route tree, including the account hub layout) once a conversation is
 * opened on /account/messages. Needed because Next.js layouts never
 * receive `searchParams` and so don't re-render on a search-param-only
 * navigation (clicking between conversations, which only changes
 * ?type=/&id=) — without this, the sidebar's unread-messages badge (fetched
 * once by the layout) stays stale even though the page's own server-side
 * read-marking (markNotificationsReadForRequest / ChatPanel's markChatRead)
 * genuinely succeeded. Keyed by the conversation identity so it fires once
 * per selection, not on every re-render.
 */
export function RefreshOnSelect({ selectedKey }: { selectedKey: string }) {
  const router = useRouter();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastKey.current === selectedKey) return;
    lastKey.current = selectedKey;
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router is stable; only re-run when the selected conversation actually changes.
  }, [selectedKey]);

  return null;
}
