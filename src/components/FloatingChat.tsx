import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, ArrowLeft, Send, Search, GripHorizontal } from "lucide-react";
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

interface Conversation {
  profile: Profile;
  lastMessage: Message | null;
  unreadCount: number;
}

export function FloatingChat() {
  const { user, hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 16, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const chatRef = useRef<HTMLDivElement>(null);

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

  // Unread count + realtime badge + conversations preview
  useEffect(() => {
    if (!user || !canChat) return;
    const loadConversations = async () => {
      // Get all profiles with whom we have messages
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("sender_id,recipient_id")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100);

      const messagesData = (msgs as any[]) ?? [];
      const userIds = new Set<string>();
      messagesData.forEach(m => {
        if (m.sender_id !== user.id) userIds.add(m.sender_id);
        if (m.recipient_id !== user.id) userIds.add(m.recipient_id);
      });

      if (userIds.size === 0) {
        setConversations([]);
        return;
      }

      // Get profiles for those users
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id,full_name,phone")
        .in("id", Array.from(userIds));

      // Get last message and unread count for each conversation
      const convs: Conversation[] = [];
      for (const profile of (profilesData as Profile[]) ?? []) {
        const { data: lastMsg } = await supabase
          .from("chat_messages")
          .select("*")
          .or(
            `and(sender_id.eq.${user.id},recipient_id.eq.${profile.id}),and(sender_id.eq.${profile.id},recipient_id.eq.${user.id})`,
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count: unreadCount } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("recipient_id", user.id)
          .eq("sender_id", profile.id)
          .is("read_at", null);

        convs.push({
          profile,
          lastMessage: (lastMsg as Message) ?? null,
          unreadCount: unreadCount ?? 0,
        });
      }

      // Sort by most recent message
      convs.sort((a, b) => {
        const aTime = new Date(a.lastMessage?.created_at ?? 0).getTime();
        const bTime = new Date(b.lastMessage?.created_at ?? 0).getTime();
        return bTime - aTime;
      });

      setConversations(convs);

      // Also load unread count
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null);
      setUnread(count ?? 0);
    };
    void loadConversations();

    const ch = supabase
      .channel("chat-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `recipient_id=eq.${user.id}` },
        () => { void loadConversations(); },
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

  const handleDragStart = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    if (open) return; // Don't drag when chat is open
    setIsDragging(true);
    const element = e.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  };

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || open) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    
    const newX = clientX - dragOffset.x;
    const newY = window.innerHeight - clientY - dragOffset.y; // For bottom positioning
    
    // Keep within viewport bounds
    const maxX = window.innerWidth - 56; // Button width
    const maxY = window.innerHeight - 100; // Leave space for bottom nav
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(80, Math.min(newY, maxY)), // Keep above bottom nav
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging && !open) {
      const handleMove = (e: MouseEvent | TouchEvent) => handleDragMove(e);
      const handleEnd = () => handleDragEnd();
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("touchmove", handleMove);
      document.addEventListener("mouseup", handleEnd);
      document.addEventListener("touchend", handleEnd);
      return () => {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("touchmove", handleMove);
        document.removeEventListener("mouseup", handleEnd);
        document.removeEventListener("touchend", handleEnd);
      };
    }
  }, [isDragging, dragOffset, open]);

  if (!user || !canChat) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-transform hover:scale-105 cursor-grab active:cursor-grabbing touch-none"
          style={{
            left: `${position.x}px`,
            bottom: `${position.y}px`,
          }}
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
        <div
          ref={chatRef}
          className="fixed z-50 flex h-[520px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:bottom-6 md:right-4"
          style={{
            bottom: "24px",
            right: "16px",
          }}
        >
          <header
            onMouseDown={handleDragStart}
            className="flex items-center justify-between gap-2 border-b bg-primary p-3 text-primary-foreground cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-4 w-4 opacity-70" />
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
            </div>
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
                    placeholder="Search or view messages…"
                    className="h-9 pl-8"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {/* Show conversations with messages first */}
                {conversations.length > 0 && (
                  <div>
                    <div className="sticky top-0 bg-card px-3 py-2 text-xs font-semibold text-muted-foreground border-b">
                      Messages
                    </div>
                    <ul>
                      {conversations.map((conv) => (
                        <li key={conv.profile.id}>
                          <button
                            onClick={() => setActive(conv.profile)}
                            className="flex w-full items-start gap-3 border-b border-border/50 px-3 py-2 text-left hover:bg-muted/50"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary mt-0.5">
                              {(conv.profile.full_name ?? "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-medium">{conv.profile.full_name ?? "Unnamed"}</div>
                                {conv.unreadCount > 0 && (
                                  <span className="shrink-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                    {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                                  </span>
                                )}
                              </div>
                              {conv.lastMessage && (
                                <>
                                  <div className="truncate text-xs text-muted-foreground mt-0.5">
                                    {conv.lastMessage.body.substring(0, 60)}...
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-1">
                                    {new Date(conv.lastMessage.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </>
                              )}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Show all profiles if searching */}
                {q && (
                  <div>
                    {filtered.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">No users found</div>
                    ) : (
                      <>
                        <div className="sticky top-0 bg-card px-3 py-2 text-xs font-semibold text-muted-foreground border-b">
                          Start conversation
                        </div>
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
                      </>
                    )}
                  </div>
                )}

                {/* Show empty state if no conversations and no search */}
                {conversations.length === 0 && !q && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No messages yet. Search to start a conversation.
                  </div>
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
