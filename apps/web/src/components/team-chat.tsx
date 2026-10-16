"use client";

import { ArrowLeft, MessageCircle, Plus, Search, Send, Trash2, UsersRound, X } from "lucide-react";
import { type CSSProperties, type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ConversationType = "TEAM" | "DIRECT";
type Conversation = { id: string; type: ConversationType; title: string; userId: string | null; lastMessage: { body: string; senderName: string; mine: boolean; createdAt: string } | null; lastMessageAt: string; unread: number };
type Me = { id: string; name: string; canModerate: boolean };
type Message = { id: string; senderId: string; senderName: string; body: string; deleted: boolean; createdAt: string };
type Person = { id: string; name: string; roleName: string };
type Active = { id: string; title: string; type: ConversationType };
type View = "list" | "thread" | "new";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/chat/${path}`, { cache: "no-store", ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data ? (data as { message: unknown }).message : null;
    throw new Error(Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : "Something went wrong. Please try again.");
  }
  return data as T;
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
function shortStamp(iso: string) {
  const date = new Date(iso);
  return sameDay(date, new Date()) ? clock(iso) : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  return sameDay(date, today) ? "Today" : sameDay(date, yesterday) ? "Yesterday" : date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// Runs `callback` now and then every `ms` while `active`, skipping ticks when the browser tab is hidden.
function usePoll(callback: () => void, ms: number, active: boolean) {
  const saved = useRef(callback);
  useEffect(() => { saved.current = callback; });
  useEffect(() => {
    if (!active) return;
    saved.current();
    const timer = setInterval(() => { if (document.visibilityState === "visible") saved.current(); }, ms);
    return () => clearInterval(timer);
  }, [ms, active]);
}

function Avatar({ name, team = false, size = "md" }: { name: string; team?: boolean; size?: "sm" | "md" }) {
  return <span className={cn("grid shrink-0 place-items-center rounded-full font-semibold", size === "md" ? "size-11 text-[13px]" : "size-9 text-xs", team ? "bg-brand text-white" : "bg-brand-soft text-brand-dark")} aria-hidden="true">{team ? <UsersRound size={size === "md" ? 19 : 16} /> : initials(name)}</span>;
}

export function TeamChat() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [active, setActive] = useState<Active | null>(null);
  const [unread, setUnread] = useState(0);
  const [data, setData] = useState<{ me: Me; conversations: Conversation[] } | null>(null);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => { try { setUnread((await api<{ unread: number }>("summary")).unread); } catch { /* badge is best-effort */ } }, []);
  const loadList = useCallback(async () => {
    try {
      const next = await api<{ me: Me; conversations: Conversation[] }>("conversations");
      setData(next); setError("");
      setUnread(next.conversations.reduce((sum, item) => sum + item.unread, 0));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load conversations."); }
  }, []);

  const close = useCallback(() => { setOpen(false); setView("list"); setActive(null); }, []);

  usePoll(loadSummary, 30_000, !open);
  usePoll(loadList, 8_000, open && view !== "thread");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") close(); };
    const lockScroll = window.matchMedia("(max-width: 639px)").matches;
    const previous = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [open, close]);

  const openThread = (next: Active) => { setActive(next); setView("thread"); };
  const backToList = () => { setView("list"); setActive(null); loadList(); };

  return <>
    <button type="button" onClick={() => (open ? close() : setOpen(true))} className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-40 grid size-12 place-items-center rounded-full bg-brand text-white transition-colors duration-150 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 sm:right-5 lg:bottom-6" aria-label={open ? "Close team chat" : unread ? `Open team chat, ${unread} unread` : "Open team chat"} aria-expanded={open}>
      {open ? <X size={21} /> : <MessageCircle size={21} />}
      {!open && unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-danger px-1 text-[10px] font-semibold leading-none text-white">{unread > 99 ? "99+" : unread}</span>}
    </button>

    {open && <div role="dialog" aria-label="Team chat" className="fixed inset-0 z-[70] flex h-[100dvh] flex-col overflow-hidden bg-white sm:inset-auto sm:bottom-20 sm:right-5 sm:h-[min(640px,calc(100dvh-7rem))] sm:w-[380px] sm:rounded-xl sm:border sm:shadow-[0_12px_32px_rgba(15,23,42,0.14)] lg:bottom-24">
      {view === "list" && <ListView data={data} error={error} onRetry={loadList} onOpen={(item) => openThread({ id: item.id, title: item.title, type: item.type })} onNew={() => setView("new")} onClose={close} />}
      {view === "new" && <NewChatView onBack={backToList} onStarted={openThread} onClose={close} />}
      {view === "thread" && active && data && <ThreadView active={active} me={data.me} onBack={backToList} onClose={close} />}
    </div>}
  </>;
}

function PanelHeader({ title, subtitle, onBack, onClose, avatar }: { title: string; subtitle?: string; onBack?: () => void; onClose: () => void; avatar: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3 pt-[max(12px,env(safe-area-inset-top))] sm:pt-3">
    {onBack && <button type="button" onClick={onBack} className="-ml-1 grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground" aria-label="Back to conversations"><ArrowLeft size={18} /></button>}
    {avatar}
    <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold text-foreground">{title}</p>{subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}</div>
    <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground" aria-label="Close team chat"><X size={18} /></button>
  </div>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="relative shrink-0 px-4 py-3">
    <Search size={15} className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-subtle" />
    <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} className="bg-background pl-9 text-base sm:text-[13px]" />
  </div>;
}

function PanelNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-danger" role="alert">{message}{onRetry && <button type="button" onClick={onRetry} className="ml-2 font-semibold underline">Retry</button>}</div>;
}

function ListView({ data, error, onRetry, onOpen, onNew, onClose }: { data: { me: Me; conversations: Conversation[] } | null; error: string; onRetry: () => void; onOpen: (conversation: Conversation) => void; onNew: () => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const items = (data?.conversations ?? []).filter((item) => !term || item.title.toLowerCase().includes(term) || item.lastMessage?.body.toLowerCase().includes(term));
  return <>
    <PanelHeader title="Team Chat" subtitle="Bond Therapy internal team" onClose={onClose} avatar={<span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-white"><MessageCircle size={19} /></span>} />
    <SearchBox value={search} onChange={setSearch} placeholder="Search conversations" />
    <div className="flex shrink-0 items-center justify-between border-y bg-background px-4 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Recent conversations</p>
      <Button type="button" variant="secondary" onClick={onNew} className="h-8 px-3 text-xs"><Plus size={14} />New chat</Button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {error && !data && <PanelNotice message={error} onRetry={onRetry} />}
      {!data && !error && <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-background" />)}</div>}
      {data && !items.length && <p className="px-6 py-12 text-center text-sm text-muted">No conversations match your search.</p>}
      {items.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-background focus-visible:bg-background focus-visible:outline-none">
        <Avatar name={item.title} team={item.type === "TEAM"} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2"><span className={cn("truncate text-sm text-foreground", item.unread ? "font-semibold" : "font-medium")}>{item.title}</span>{item.lastMessage && <span className="shrink-0 text-[11px] text-subtle">{shortStamp(item.lastMessage.createdAt)}</span>}</span>
          <span className="mt-0.5 flex items-center justify-between gap-2"><span className={cn("truncate text-xs", item.unread ? "text-foreground" : "text-muted")}>{item.lastMessage ? `${item.lastMessage.mine ? "You: " : item.type === "TEAM" ? `${item.lastMessage.senderName.split(" ")[0]}: ` : ""}${item.lastMessage.body}` : "No messages yet. Say hello."}</span>{item.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[10px] font-semibold text-white">{item.unread > 99 ? "99+" : item.unread}</span>}</span>
        </span>
      </button>)}
    </div>
  </>;
}

function NewChatView({ onBack, onStarted, onClose }: { onBack: () => void; onStarted: (active: Active) => void; onClose: () => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const load = useCallback(async () => { try { setPeople(await api<Person[]>("people")); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load team members."); } }, []);
  useEffect(() => { (async () => { await load(); })(); }, [load]);
  const start = async (person: Person) => {
    setStarting(person.id); setError("");
    try { const conversation = await api<{ id: string; title: string; type: ConversationType }>("conversations/direct", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: person.id }) }); onStarted({ id: conversation.id, title: conversation.title, type: conversation.type }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to start this chat."); setStarting(null); }
  };
  const term = search.trim().toLowerCase();
  const items = (people ?? []).filter((person) => !term || person.name.toLowerCase().includes(term) || person.roleName.toLowerCase().includes(term));
  return <>
    <PanelHeader title="New chat" subtitle="Choose a team member" onBack={onBack} onClose={onClose} avatar={<span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-dark"><Plus size={19} /></span>} />
    <SearchBox value={search} onChange={setSearch} placeholder="Search by name or role" />
    <div className="min-h-0 flex-1 overflow-y-auto border-t">
      {error && <PanelNotice message={error} onRetry={people ? undefined : load} />}
      {!people && !error && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-background" />)}</div>}
      {people && !items.length && <p className="px-6 py-12 text-center text-sm text-muted">{people.length ? "No team members match your search." : "No other team members yet."}</p>}
      {items.map((person) => <button key={person.id} type="button" disabled={starting !== null} onClick={() => start(person)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-background focus-visible:bg-background focus-visible:outline-none disabled:opacity-60">
        <Avatar name={person.name} size="sm" />
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{person.name}</span><span className="block truncate text-xs text-muted">{person.roleName}</span></span>
      </button>)}
    </div>
  </>;
}

function ThreadView({ active, me, onBack, onClose }: { active: Active; me: Me; onBack: () => void; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const composer = useRef<HTMLTextAreaElement>(null);
  const loaded = useRef(false);

  // Polling refetches the latest page so new messages, deletions and "Seen" all stay in sync; older pages loaded by the user are kept.
  const load = useCallback(async () => {
    try {
      const fresh = await api<{ messages: Message[]; hasMore: boolean; otherLastReadAt: string | null }>(`conversations/${active.id}/messages`);
      setMessages((previous) => {
        if (!previous) return fresh.messages;
        const cutoff = fresh.messages[0]?.createdAt;
        return [...(cutoff ? previous.filter((item) => item.createdAt < cutoff) : []), ...fresh.messages];
      });
      if (!loaded.current) { loaded.current = true; setHasMore(fresh.hasMore); }
      setOtherReadAt(fresh.otherLastReadAt);
      setError((value) => (value.startsWith("Unable to load") ? "" : value));
    } catch (cause) { setError(cause instanceof Error ? `Unable to load messages. ${cause.message}` : "Unable to load messages."); }
  }, [active.id]);
  usePoll(load, 4_000, true);

  const lastId = messages?.at(-1)?.id;
  useEffect(() => {
    const element = scroller.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [lastId]);
  useEffect(() => { if (window.matchMedia("(min-width: 640px)").matches) composer.current?.focus(); }, []);

  const loadEarlier = async () => {
    const first = messages?.[0];
    const element = scroller.current;
    if (!first || !element) return;
    const before = element.scrollHeight - element.scrollTop;
    try {
      const older = await api<{ messages: Message[]; hasMore: boolean }>(`conversations/${active.id}/messages?before=${encodeURIComponent(first.createdAt)}`);
      setMessages((previous) => [...older.messages, ...(previous ?? [])]);
      setHasMore(older.hasMore);
      requestAnimationFrame(() => { element.scrollTop = element.scrollHeight - before; });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load earlier messages."); }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError("");
    try {
      const sent = await api<Message>(`conversations/${active.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
      stick.current = true;
      setMessages((previous) => (previous?.some((item) => item.id === sent.id) ? previous : [...(previous ?? []), sent]));
      setText("");
      composer.current?.focus();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to send your message."); }
    finally { setSending(false); }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } };

  const remove = async (id: string) => {
    try { await api(`messages/${id}`, { method: "DELETE" }); setConfirmId(null); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete this message."); setConfirmId(null); }
  };

  const lastMine = [...(messages ?? [])].reverse().find((item) => item.senderId === me.id && !item.deleted);
  const seen = lastMine && otherReadAt ? new Date(otherReadAt) >= new Date(lastMine.createdAt) : false;
  const isTeam = active.type === "TEAM";

  return <>
    <PanelHeader title={active.title} subtitle={isTeam ? "Everyone on the team" : "Direct message"} onBack={onBack} onClose={onClose} avatar={<Avatar name={active.title} team={isTeam} size="sm" />} />
    <div ref={scroller} onScroll={(event) => { const el = event.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-background/60 px-4 py-3">
      {!messages && !error && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className={cn("h-10 w-2/3 animate-pulse rounded-2xl bg-white", i % 2 && "ml-auto")} />)}</div>}
      {error && !messages && <PanelNotice message={error} onRetry={load} />}
      {hasMore && <div className="pb-2 text-center"><button type="button" onClick={loadEarlier} className="rounded-full border bg-white px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground">Load earlier messages</button></div>}
      {messages && !messages.length && <p className="px-6 py-12 text-center text-sm text-muted">{isTeam ? "No messages yet. Start the conversation with your team." : `No messages yet. Say hello to ${active.title.split(" ")[0]}.`}</p>}
      {messages?.map((message, index) => {
        const mine = message.senderId === me.id;
        const newDay = index === 0 || !sameDay(new Date(messages[index - 1]!.createdAt), new Date(message.createdAt));
        const grouped = index > 0 && !newDay && messages[index - 1]!.senderId === message.senderId;
        return <div key={message.id}>
          {newDay && <div className="flex justify-center py-2"><span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-muted">{dayLabel(message.createdAt)}</span></div>}
          <div className={cn("group flex items-end gap-1.5", mine ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-2")}>
            {mine && me.canModerate && !message.deleted && <button type="button" onClick={() => setConfirmId(message.id)} className="mb-1 grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-red-50 hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100" aria-label="Delete message"><Trash2 size={13} /></button>}
            <div className={cn("max-w-[78%] min-w-0", mine && "text-right")}>
              {!mine && !grouped && isTeam && <p className="mb-0.5 px-1 text-[11px] font-medium text-muted">{message.senderName}</p>}
              <div className={cn("inline-block max-w-full break-words rounded-2xl px-3 py-2 text-left text-[13px] leading-5", mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md border bg-white text-foreground", message.deleted && "italic opacity-70")} style={{ overflowWrap: "anywhere" }}>
                {message.deleted ? "This message was deleted" : <span className="whitespace-pre-wrap">{message.body}</span>}
              </div>
              <p className={cn("mt-0.5 px-1 text-[10px] text-subtle", mine && "text-right")}>{clock(message.createdAt)}{!isTeam && lastMine?.id === message.id && <span> · {seen ? "Seen" : "Sent"}</span>}</p>
              {confirmId === message.id && <div className="mt-1 flex items-center justify-end gap-2 text-xs"><span className="text-muted">Delete this message for everyone?</span><button type="button" onClick={() => remove(message.id)} className="font-semibold text-danger">Delete</button><button type="button" onClick={() => setConfirmId(null)} className="font-medium text-muted">Cancel</button></div>}
            </div>
            {!mine && me.canModerate && !message.deleted && <button type="button" onClick={() => setConfirmId(message.id)} className="mb-1 grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-red-50 hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100" aria-label="Delete message"><Trash2 size={13} /></button>}
          </div>
        </div>;
      })}
    </div>
    {error && messages && <p className="shrink-0 border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-danger" role="alert">{error}</p>}
    <div className="flex shrink-0 items-end gap-2 border-t bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <textarea ref={composer} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={onKeyDown} rows={1} maxLength={2000} placeholder="Type a message" aria-label="Message" className="max-h-28 min-h-11 flex-1 resize-none rounded-lg border bg-white px-3 py-2.5 text-base leading-5 outline-none transition placeholder:text-subtle focus:border-brand focus:ring-2 focus:ring-brand/10 sm:min-h-10 sm:text-[13px]" style={{ fieldSizing: "content" } as CSSProperties} />
      <button type="button" onClick={send} disabled={!text.trim() || sending} className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40 sm:size-10" aria-label="Send message"><Send size={17} /></button>
    </div>
  </>;
}
