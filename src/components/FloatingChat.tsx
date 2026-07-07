import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, ArrowLeft, Send, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export function FloatingChat() {
  const { user, hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Only staff-ish roles get chat
  const canChat = hasRole(["super_admin", "landlord", "caretaker", "accountant", "technician", "security"]);

  useEffect(() => {
    if (!user || !canChat) return;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,phone")
        .neq("id", user.id)
        .order("full_name", { ascending: true });
      setProfiles((data as Profile[]) ?? []);
    };
    void load();
  }, [user, canChat]);

  // Unread count + realtime badge
  useEffect(() => {
    if (!user || !canChat) return;
    const loadUnread = async () => {
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null);
      setUnread(count ?? 0);
    };
    void loadUnread();
    const ch = supabase
      .channel("chat-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `recipient_id=eq.${user.id}` },
        () => void loadUnread(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, canChat]);

  // Load & subscribe messages for active thread
  useEffect(() => {
    if (!user || !active) return;
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${active.id}),and(sender_id.eq.${active.id},recipient_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages((data as Message[]) ?? []);
      // mark received messages as read
      await supabase
        .from("chat_messages")
        .update({ read_at: new Date().toISOString() } as never)
        .eq("recipient_id", user.id)
        .eq("sender_id", active.id)
        .is("read_at", null);
    };
    void load();
    const ch = supabase
      .channel(`chat-${active.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const m = payload.new as Message;
          const inThread =
            (m.sender_id === user.id && m.recipient_id === active.id) ||
            (m.sender_id === active.id && m.recipient_id === user.id);
          if (inThread) setMessages((prev) => [...prev, m]);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, active]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, active]);

  const filtered = useMemo(() => {
    if (!q) return profiles;
    const s = q.toLowerCase();
    return profiles.filter(
      (p) => (p.full_name ?? "").toLowerCase().includes(s) || (p.phone ?? "").toLowerCase().includes(s),
    );
  }, [profiles, q]);

  const send = async () => {
    const text = body.trim();
    if (!text || !active || !user) return;
    setBody("");
    const { error } = await supabase.from("chat_messages").insert({
      sender_id: user.id,
      recipient_id: active.id,
      body: text,
    } as never);
    if (error) setBody(text);
  };

  if (!user || !canChat) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-transform hover:scale-105 md:bottom-6"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[520px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:bottom-6">
          <header className="flex items-center justify-between gap-2 border-b bg-primary p-3 text-primary-foreground">
            {active ? (
              <button onClick={() => setActive(null)} className="flex items-center gap-2 min-w-0">
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{active.full_name ?? "User"}</div>
                  <div className="truncate text-[11px] opacity-80">{active.phone ?? ""}</div>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span className="text-sm font-semibold">Team chat</span>
              </div>
            )}
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </header>

          {!active ? (
            <>
              <div className="border-b p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search users…"
                    className="h-9 pl-8"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No users found</div>
                ) : (
                  <ul>
                    {filtered.map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => setActive(p)}
                          className="flex w-full items-center gap-3 border-b border-border/50 px-3 py-3 text-left hover:bg-muted/50"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {(p.full_name ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{p.full_name ?? "Unnamed"}</div>
                            {p.phone && (
                              <div className="truncate text-xs text-muted-foreground">{p.phone}</div>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-3">
                {messages.length === 0 && (
                  <div className="pt-12 text-center text-xs text-muted-foreground">
                    Say hello 👋
                  </div>
                )}
                {messages.map((m) => {
                  const mine = m.sender_id === user.id;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                          mine
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm bg-card text-foreground border",
                        )}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div className={cn("mt-0.5 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); void send(); }}
                className="flex items-center gap-2 border-t bg-card p-2"
              >
                <Input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type a message"
                  className="h-10"
                />
                <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!body.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
