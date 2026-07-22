import { useEffect, useRef, useState } from "react";
import { sendAiChatMessage } from "../services/aiChatService";
import { summarizeAiActions } from "../services/aiActionSummary";

export default function AIChatPanel({
  variant = "sidebar",
  isOpen,
  onToggle,
  getContext,
  onApplyActions,
  onNotify,
}) {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "Hola, puedo ayudarte a editar el flow. Describe el cambio que quieres.",
      actions: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [applyingMessageId, setApplyingMessageId] = useState(null);
  const [expandedSummaries, setExpandedSummaries] = useState({});
  const listRef = useRef(null);
  const isDrawer = variant === "drawer";

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isOpen, loading]);

  const applyActions = async (actions, messageId) => {
    setApplyingMessageId(messageId);
    try {
      const result = await onApplyActions?.(actions);
      if (result?.appliedActions > 0) {
        const rejected = result.rejectedActions > 0
          ? ` (${result.rejectedActions} rechazada(s))`
          : "";
        onNotify?.(`✅ IA aplicó ${result.appliedActions} acción(es)${rejected}`, "success");
        setMessages((prev) => prev.map((message) => (
          message.id === messageId ? { ...message, status: "applied" } : message
        )));
      } else {
        onNotify?.("⚠️ La IA no propuso acciones válidas para el flow actual", "warning");
      }
      return result;
    } finally {
      setApplyingMessageId(null);
    }
  };

  const discardActions = (messageId) => {
    setMessages((prev) => prev.map((message) => (
      message.id === messageId ? { ...message, status: "discarded" } : message
    )));
    onNotify?.("Cambios descartados", "warning");
  };

  const toggleSummary = (messageId) => {
    setExpandedSummaries((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setLoading(true);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `user_${Date.now()}`, role: "user", text, actions: [] },
    ]);

    try {
      const context = getContext?.() || {};
      const response = await sendAiChatMessage({ message: text, context });
      const actions = Array.isArray(response.actions) ? response.actions : [];
      const assistantText =
        response.assistantMessage ||
        (actions.length
          ? `Preparé ${actions.length} acción(es) para el flow.`
          : "No encontré cambios para aplicar.");

      const assistantId = `assistant_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          text: assistantText,
          actions,
          status: actions.length > 0 ? "pending" : "none",
        },
      ]);

      if (actions.length > 0) {
        setExpandedSummaries((prev) => ({ ...prev, [assistantId]: true }));
        onNotify?.("Revisa el resumen y confirma antes de aplicar", "warning");
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant_error_${Date.now()}`,
          role: "assistant",
          text: error?.response?.data?.error || error?.message || "Error enviando mensaje al chat IA.",
          actions: [],
          status: "none",
        },
      ]);
      onNotify?.("❌ Error en chat IA", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const panelBody = (
    <>
      <div
        className={`border-b border-slate-200 px-2 flex items-center justify-between shrink-0 ${
          isDrawer ? "h-12" : "h-12"
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="h-9 w-9 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          title={isOpen ? "Cerrar chat IA" : "Abrir chat IA"}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isOpen ? "close" : "smart_toy"}
          </span>
        </button>
        {(isOpen || isDrawer) && (
          <div className="text-sm font-semibold text-slate-700 pr-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-blue-600">smart_toy</span>
            Asistente IA
          </div>
        )}
      </div>

      {isOpen && (
        <>
          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {messages.map((msg) => {
              const summary = msg.actions?.length ? summarizeAiActions(msg.actions) : null;
              const isPending = msg.status === "pending";
              const isExpanded = expandedSummaries[msg.id] ?? isPending;
              const isApplying = applyingMessageId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-50 border border-blue-200 text-blue-900"
                      : "bg-slate-50 border border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-wide mb-1 opacity-70">
                    {msg.role === "user" ? "Tú" : "IA"}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {summary && isPending && (
                    <div className="mt-3 rounded-md border border-slate-200 bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleSummary(msg.id)}
                        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-blue-600">
                            checklist
                          </span>
                          {summary.title}
                        </span>
                        <span className="material-symbols-outlined text-[18px] text-slate-400">
                          {isExpanded ? "expand_less" : "expand_more"}
                        </span>
                      </button>

                      {isExpanded && (
                        <ul className="px-2.5 pb-2 space-y-1.5 border-t border-slate-100">
                          {summary.items.map((item, index) => (
                            <li
                              key={`${msg.id}_${item.type}_${index}`}
                              className="text-[11px] text-slate-600 flex gap-1.5"
                            >
                              <span className="text-slate-400 shrink-0">{index + 1}.</span>
                              <span>
                                <span className="font-medium text-slate-700">{item.label}:</span>{" "}
                                {item.detail}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex gap-2 px-2.5 pb-2.5 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            void applyActions(msg.actions, msg.id);
                          }}
                          disabled={isApplying}
                          className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-60 ${
                            summary.destructive
                              ? "bg-amber-600 hover:bg-amber-700"
                              : "bg-blue-600 hover:bg-blue-700"
                          }`}
                        >
                          {isApplying ? "Aplicando…" : "Aplicar al flow"}
                        </button>
                        <button
                          type="button"
                          onClick={() => discardActions(msg.id)}
                          disabled={isApplying}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Descartar
                        </button>
                      </div>
                    </div>
                  )}

                  {summary && msg.status === "applied" && (
                    <div className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      {summary.count} cambio(s) aplicado(s) al flow.
                    </div>
                  )}

                  {summary && msg.status === "discarded" && (
                    <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">block</span>
                      Cambios descartados ({summary.count} acción(es)).
                    </div>
                  )}
                </div>
              );
            })}
            {loading && (
              <div className="rounded-lg px-3 py-2 text-sm bg-slate-50 border border-slate-200 text-slate-500">
                Pensando…
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-3 shrink-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ej: Agrega un PythonOperator llamado limpiar_datos y conéctalo al nodo raíz."
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">
                Enter envía · Shift+Enter nueva línea
              </span>
              <button
                type="button"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="rounded-md bg-blue-600 text-white text-sm px-3 py-1.5 hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );

  if (isDrawer) {
    if (!isOpen) {
      return (
        <button
          type="button"
          onClick={onToggle}
          className="fixed bottom-4 right-4 z-[180] h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 flex items-center justify-center"
          title="Abrir asistente IA"
        >
          <span className="material-symbols-outlined text-[24px]">smart_toy</span>
        </button>
      );
    }

    return (
      <>
        <button
          type="button"
          aria-label="Cerrar chat IA"
          onClick={onToggle}
          className="fixed inset-0 z-[180] bg-slate-900/40"
        />
        <div className="fixed right-0 top-12 bottom-0 z-[190] w-[min(360px,92vw)] min-w-[280px] border-l border-slate-200 bg-white flex flex-col shadow-2xl">
          {panelBody}
        </div>
      </>
    );
  }

  return (
    <div
      className={`h-full border-l border-slate-200 bg-white flex flex-col transition-all duration-200 flex-shrink-0 ${
        isOpen ? "w-[360px] min-w-[320px]" : "w-[56px] min-w-[56px]"
      }`}
    >
      {panelBody}
    </div>
  );
}
