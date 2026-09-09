import { Bell, LockKeyhole, Send } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { sendRoomEvent } from "../socket";
import { useCoachStore } from "../store";

type CollaborateTab = "chat" | "notes";

export interface CollaboratePanelProps {
  active: boolean;
  locked?: boolean;
  onUnreadChange?: (count: number) => void;
}

export function CollaboratePanel({ active, locked = false, onUnreadChange }: CollaboratePanelProps) {
  const [collaborateTab, setCollaborateTab] = useState<CollaborateTab>("chat");
  const [draft, setDraft] = useState("");
  const [unreadChat, setUnreadChat] = useState(0);
  const [lastNotice, setLastNotice] = useState("");
  const { messages, addMessage, displayName, globalPly, participants, roomId } = useCoachStore();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (locked || !draft.trim()) return;
    const item = { id: crypto.randomUUID(), author: displayName, content: draft.trim(), ply: globalPly, timestamp: new Date().toISOString() };
    addMessage(item);
    sendRoomEvent(collaborateTab === "chat" ? "chat.message" : "note.create", item);
    setDraft("");
  };

  useEffect(() => {
    if (active && collaborateTab === "chat") {
      setUnreadChat(0);
      setLastNotice("");
    }
  }, [active, collaborateTab]);

  useEffect(() => onUnreadChange?.(unreadChat), [onUnreadChange, unreadChat]);

  useEffect(() => {
    const onIncomingChat = (event: Event) => {
      const item = (event as CustomEvent).detail as { author?: string; content?: string } | undefined;
      if (!active || collaborateTab !== "chat") {
        setUnreadChat((current) => current + 1);
        setLastNotice(`${item?.author ?? "Partner"}: ${item?.content ?? "New message"}`);
      }
      if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        new Notification("New Jimmy App chat message", { body: `${item?.author ?? "Partner"}: ${item?.content ?? ""}`.slice(0, 140) });
      }
    };
    window.addEventListener("thejimmyapp:chat-message", onIncomingChat);
    return () => window.removeEventListener("thejimmyapp:chat-message", onIncomingChat);
  }, [active, collaborateTab]);

  const enableBrowserNotifications = async () => {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    await Notification.requestPermission();
  };

  if (!active) return null;
  return <>
    <div className="utility-secondary-tabs" role="tablist" aria-label="Collaboration views">
      {(["chat", "notes"] as CollaborateTab[]).map((tab) => <button key={tab} role="tab" aria-selected={collaborateTab === tab} className={collaborateTab === tab ? "active" : ""} disabled={locked} onClick={() => setCollaborateTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}{tab === "chat" && unreadChat > 0 && <span className="chat-unread">{unreadChat}</span>}</button>)}
    </div>
    {locked && <div className="study-collaboration-lock" role="status"><LockKeyhole size={11} aria-hidden="true" /> Locked</div>}
    <div className={`utility-pane collaborate-pane${locked ? " capability-locked" : ""}`}>
      <div className="presence"><span className="presence-dot" />{roomId ? <span><strong>{participants.length || 1}</strong> watching · {(participants.length ? participants : [{ display_name: displayName, client_id: "local" }]).map((item) => item.display_name).join(", ")}</span> : <span>Solo review · <strong>Move {globalPly}</strong></span>}{collaborateTab === "chat" && "Notification" in window && Notification.permission === "default" && <button type="button" className="notification-enable" disabled={locked} onClick={() => void enableBrowserNotifications()}><Bell size={12} /> Enable alerts</button>}</div>
      {lastNotice && collaborateTab !== "chat" && <div className="chat-toast" role="status"><Bell size={13} /> {lastNotice}</div>}
      <div className="message-list">{collaborateTab === "chat" ? messages.map((item) => <article key={item.id}><header><strong>{item.author}</strong><button title="Go to referenced move">A · {item.ply}</button></header><p>{item.content}</p></article>) : <div className="empty-panel">Notes attached to this room and move appear here.</div>}</div>
      <form className="composer" onSubmit={submit}><textarea value={draft} disabled={locked} onChange={(event) => setDraft(event.target.value)} placeholder={collaborateTab === "chat" ? "Message your partner" : "Add a shared note"} maxLength={5000} /><button aria-label="Send" disabled={locked}><Send size={17} /></button></form>
    </div>
  </>;
}
