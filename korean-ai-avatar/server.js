import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getPersona, publicPersonas } from "./personas.js";

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.CHAT_MODEL || "claude-opus-5-5";
// 일상 대화는 빠른 응답이 중요해서 effort를 낮게 둡니다. (low | medium | high | xhigh | max)
const EFFORT = process.env.CHAT_EFFORT || "low";
const MAX_HISTORY = 40; // 서버로 받는 최대 메시지 수 (비용/남용 방지)
const MAX_MESSAGE_LENGTH = 2000;

// ANTHROPIC_API_KEY 환경변수(.env)에서 키를 읽습니다.
const client = new Anthropic();
const app = express();

app.use(express.json({ limit: "200kb" }));
app.use(express.static("public"));

app.get("/api/personas", (_req, res) => {
  res.json(publicPersonas());
});

// 대화 기록을 받아 Claude 응답을 Server-Sent Events로 스트리밍합니다.
// 서버는 대화를 저장하지 않고, 브라우저가 기록을 들고 있다가 매번 보냅니다.
app.post("/api/chat", async (req, res) => {
  const { personaId, messages } = req.body ?? {};
  const persona = getPersona(personaId);

  if (!persona) {
    return res.status(400).json({ error: "알 수 없는 페르소나입니다." });
  }
  const validationError = validateMessages(messages);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    system: [
      // 페르소나 프롬프트는 대화 내내 같으므로 캐시해서 비용과 지연을 줄입니다.
      { type: "text", text: persona.system, cache_control: { type: "ephemeral" } },
    ],
    messages: messages.slice(-MAX_HISTORY),
    output_config: { effort: EFFORT },
    // 안전 분류기가 요청을 거절하면 서버가 다른 모델로 자동 재시도합니다.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  // 사용자가 창을 닫으면 생성을 중단해 비용을 아낍니다.
  res.on("close", () => {
    if (!res.writableEnded) stream.abort();
  });

  try {
    stream.on("text", (delta) => send("delta", { text: delta }));
    const final = await stream.finalMessage();

    if (final.stop_reason === "refusal") {
      send("error", { error: "이 주제는 대답하기 어려워요. 다른 이야기를 해볼까요?" });
    } else {
      send("done", { stopReason: final.stop_reason });
    }
  } catch (err) {
    if (!res.writableEnded && !stream.aborted) {
      console.error("Claude API error:", err);
      send("error", { error: describeError(err) });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
});

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "messages 배열이 비어 있습니다.";
  }
  for (const m of messages) {
    if (m?.role !== "user" && m?.role !== "assistant") return "잘못된 role 입니다.";
    if (typeof m.content !== "string" || m.content.length === 0) return "메시지 내용이 비어 있습니다.";
    if (m.content.length > MAX_MESSAGE_LENGTH) return `메시지는 ${MAX_MESSAGE_LENGTH}자 이하로 보내주세요.`;
  }
  if (messages.at(-1).role !== "user") return "마지막 메시지는 사용자 메시지여야 합니다.";
  return null;
}

function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return "API 키가 올바르지 않습니다. .env의 ANTHROPIC_API_KEY를 확인하세요.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Claude 서버에 연결하지 못했어요. 네트워크를 확인해 주세요.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Claude API 오류 (${err.status ?? "?"}): 잠시 후 다시 시도해 주세요.`;
  }
  return "알 수 없는 오류가 발생했어요.";
}

app.listen(PORT, () => {
  console.log(`한국어 AI 대화 서버: http://localhost:${PORT}  (model: ${MODEL}, effort: ${EFFORT})`);
});
