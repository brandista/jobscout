import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  EditorialShell,
  Masthead,
} from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";
import { Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type AgentId =
  | "career_coach"
  | "job_analyzer"
  | "company_intel"
  | "interview_prep"
  | "negotiator"
  | "signal_scout";

const AGENT_LABELS: Record<string, { name: string; role: string }> = {
  career_coach: { name: "KAISA", role: "URAVALMENTAJA" },
  signal_scout: { name: "VÄINÖ", role: "KENTTÄREPORTTERI" },
  job_analyzer: { name: "TYÖPAIKKA-ANALYYTIKKO", role: "KRIITIKKO" },
  company_intel: { name: "YRITYSTIEDUSTELU", role: "TUTKIVA TOIMITTAJA" },
  interview_prep: { name: "HAASTATTELUVALMENNUS", role: "TOIMITTAJA" },
  negotiator: { name: "NEUVOTTELUAPU", role: "TALOUSTOIMITTAJA" },
};

const VALID_AGENT_IDS: AgentId[] = [
  "career_coach",
  "job_analyzer",
  "company_intel",
  "interview_prep",
  "negotiator",
  "signal_scout",
];

function isValidAgentId(id: string): id is AgentId {
  return VALID_AGENT_IDS.includes(id as AgentId);
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AgentChat() {
  const [, params] = useRoute("/agents/:id");
  const [, navigate] = useLocation();
  const agentId = params?.id ?? "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  const chat = trpc.agent.chat.useMutation({
    onSuccess: (data: any) => {
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
        },
      ]);
    },
    onError: () => {
      toast.error("Viesti epäonnistui – yritä uudelleen");
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isValidAgentId(agentId)) {
    return (
      <EditorialShell>
        <p className="py-16 text-slate-500 italic">Agenttia ei löydy.</p>
      </EditorialShell>
    );
  }

  const label = AGENT_LABELS[agentId];

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || chat.isPending) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: new Date() },
    ]);
    setInput("");

    chat.mutate({
      agentType: agentId as AgentId,
      message: text,
      conversationId,
    });
  }

  return (
    <EditorialShell>
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={() => navigate("/agents")}
          className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" />
          Agents
        </button>
      </div>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="KÄYTÖSSÄ"
        title={label.name}
        subtitle={`${label.role} – Henkilökohtainen asiantuntija`}
      />

      {/* Transcript */}
      <div className="mt-8 lg:max-w-3xl space-y-0 min-h-[40vh]">
        {messages.length === 0 && (
          <p className="py-12 text-slate-400 italic text-base">
            Aloita keskustelu kirjoittamalla viesti alla olevaan kenttään.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`py-5 border-b border-slate-900/15 ${
              msg.role === "user" ? "" : "pl-4 border-l-[1.5px] border-l-slate-900"
            }`}
          >
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-2">
              {msg.role === "user"
                ? "SINÄ"
                : `${label.name} · ${msg.timestamp.toLocaleTimeString("fi-FI", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`}
            </p>
            {msg.role === "assistant" ? (
              <p className="text-base md:text-[17px] italic text-slate-700 leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </p>
            ) : (
              <p className="text-base md:text-lg text-slate-900 leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </p>
            )}
          </div>
        ))}

        {chat.isPending && (
          <div className="py-5 pl-4 border-l-[1.5px] border-l-slate-900">
            <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-slate-400 mb-2">
              {label.name}
            </p>
            <p className="text-base italic text-slate-400">
              Kirjoittaa…
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-8 lg:max-w-3xl">
        <form onSubmit={handleSend} className="flex items-end gap-4 border-b border-slate-900 pb-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as any);
              }
            }}
            placeholder="Kirjoita viestisi…"
            rows={2}
            className="flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 placeholder:italic text-base outline-none resize-none leading-relaxed"
          />
          <button
            type="submit"
            disabled={!input.trim() || chat.isPending}
            className="flex-shrink-0 mb-1 text-slate-900 hover:opacity-60 transition-opacity disabled:opacity-25"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Enter lähettää · Shift+Enter uusi rivi
        </p>
      </div>
    </EditorialShell>
  );
}
