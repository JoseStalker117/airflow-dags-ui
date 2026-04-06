import { aiAPI } from "./api";

export async function sendAiChatMessage({ message, context, model }) {
  const { data } = await aiAPI.chat({
    message,
    context: context || {},
    model,
  });
  return {
    assistantMessage: String(data?.assistantMessage || "").trim(),
    actions: Array.isArray(data?.actions) ? data.actions : [],
    meta: data?.meta || {},
  };
}

