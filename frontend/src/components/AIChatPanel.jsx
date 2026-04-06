import { useState } from "react";
import { sendAiChatMessage } from "../services/aiChatService";

export default function AIChatPanel({
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
      const assistantText =
        response.assistantMessage ||
        (response.actions?.length
          ? `Preparé ${response.actions.length} acción(es) para el flow.`
          : "No encontré cambios para aplicar.");

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant_${Date.now()}`,
          role: "assistant",
          text: assistantText,
          actions: response.actions || [],
        },
      ]);

      if (Array.isArray(response.actions) && response.actions.length > 0) {
        const result = onApplyActions?.(response.actions);
        if (result?.applied) {
          onNotify?.(`✅ IA aplicó ${response.actions.length} acción(es)`, "success");
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant_error_${Date.now()}`,
          role: "assistant",
          text: error?.response?.data?.error || error?.message || "Error enviando mensaje al chat IA.",
          actions: [],
        },
      ]);
      onNotify?.("❌ Error en chat IA", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`h-full border-l border-slate-200 bg-white flex flex-col transition-all duration-200 ${
        isOpen ? "w-[360px] min-w-[320px]" : "w-[56px] min-w-[56px]"
      }`}
    >
      <div className="h-12 border-b border-slate-200 px-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="h-9 w-9 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          title={isOpen ? "Contraer chat IA" : "Expandir chat IA"}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isOpen ? "chevron_right" : "chevron_left"}
          </span>
        </button>
        {isOpen && (
          <div className="text-sm font-semibold text-slate-700 pr-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-blue-600">smart_toy</span>
            Asistente IA
          </div>
        )}
      </div>

      {isOpen && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((msg) => (
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
                <div>{msg.text}</div>
                {msg.actions?.length > 0 && (
                  <div className="mt-2 text-[11px] text-slate-500">
                    Acciones: {msg.actions.map((a) => a.type).join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: Agrega un PythonOperator llamado limpiar_datos y conéctalo al nodo raíz."
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Contexto del flow incluido automáticamente</span>
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
    </div>
  );
}

