const $ = (id) => document.getElementById(id);

const state = {
  personas: [],
  persona: null,
  // Claude에 보낼 대화 기록. 인사말은 화면에만 보여주고 기록에는 넣지 않습니다
  // (API는 첫 메시지가 user여야 하므로).
  history: [],
  busy: false,
};

init();

async function init() {
  const res = await fetch("/api/personas");
  state.personas = await res.json();
  renderPicker();

  $("back").addEventListener("click", showPicker);
  $("reset").addEventListener("click", () => startChat(state.persona));
  $("composer").addEventListener("submit", onSubmit);
  $("input").addEventListener("keydown", (e) => {
    // Enter = 보내기, Shift+Enter = 줄바꿈. 한글 조합 중(isComposing)에는 무시.
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $("composer").requestSubmit();
    }
  });
  $("input").addEventListener("input", autoGrow);
}

function renderPicker() {
  const list = $("persona-list");
  list.replaceChildren(
    ...state.personas.map((p) => {
      const card = document.createElement("button");
      card.className = `persona-card ${p.gender}`;
      card.innerHTML = `
        <img class="avatar" src="${p.avatar}" alt="" />
        <div class="name">${p.name} <span class="meta">${p.gender === "female" ? "여성" : "남성"} · ${p.age}세</span></div>
        <div class="tagline">${p.tagline}</div>`;
      card.addEventListener("click", () => startChat(p));
      return card;
    }),
  );
}

function showPicker() {
  $("chat").classList.add("hidden");
  $("picker").classList.remove("hidden");
}

function startChat(persona) {
  state.persona = persona;
  state.history = [];
  $("picker").classList.add("hidden");
  $("chat").classList.remove("hidden");
  $("chat").dataset.gender = persona.gender;
  $("chat-name").textContent = persona.name;
  $("chat-avatar").src = persona.avatar;
  $("stage-avatar").src = persona.avatar;
  $("messages").replaceChildren();
  addBubble("assistant", persona.greeting);
  setStatus("대화 중");
  $("input").focus();
}

async function onSubmit(e) {
  e.preventDefault();
  const text = $("input").value.trim();
  if (!text || state.busy) return;

  $("input").value = "";
  autoGrow();
  addBubble("user", text);
  state.history.push({ role: "user", content: text });

  const bubble = addBubble("assistant", "");
  bubble.classList.add("typing");
  setBusy(true);

  let reply = "";
  try {
    reply = await streamReply((delta) => {
      bubble.classList.remove("typing");
      bubble.textContent += delta;
      scrollToBottom();
    });
    state.history.push({ role: "assistant", content: reply });
  } catch (err) {
    bubble.classList.remove("typing");
    bubble.classList.add("error");
    bubble.textContent = err.message || "응답을 받지 못했어요.";
    // 실패한 사용자 메시지는 기록에서 빼서 다음 요청이 꼬이지 않게 합니다.
    state.history.pop();
  } finally {
    setBusy(false);
    $("input").focus();
  }
}

// /api/chat 의 Server-Sent Events 스트림을 읽어 텍스트 조각마다 onDelta를 호출합니다.
async function streamReply(onDelta) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personaId: state.persona.id, messages: state.history }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `서버 오류 (${res.status})`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let sep;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const event = /^event: (.*)$/m.exec(raw)?.[1];
      const data = JSON.parse(/^data: (.*)$/m.exec(raw)?.[1] ?? "{}");
      if (event === "delta") {
        text += data.text;
        onDelta(data.text);
      } else if (event === "error") {
        throw new Error(data.error);
      }
    }
  }
  if (!text) throw new Error("빈 응답을 받았어요. 다시 시도해 주세요.");
  return text;
}

function addBubble(role, text) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  div.textContent = text;
  $("messages").append(div);
  scrollToBottom();
  return div;
}

function setBusy(busy) {
  state.busy = busy;
  $("send").disabled = busy;
  $("chat").classList.toggle("speaking", busy);
  setStatus(busy ? "입력 중…" : "대화 중");
}

function setStatus(text) {
  $("chat-status").textContent = text;
}

function scrollToBottom() {
  const box = $("messages");
  box.scrollTop = box.scrollHeight;
}

function autoGrow() {
  const el = $("input");
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}
