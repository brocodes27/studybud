// Browser integration harness. Vite serves this only as a separate development entry.
// All Supabase traffic is intercepted; no account or remote data is created.
import type { AuthContextType } from "../src/contexts/AuthContext";
const uid = "00000000-0000-4000-8000-000000000001";
const saved = JSON.parse(
  sessionStorage.getItem("curve-workflow-test") ||
    '{"materials":[],"sessions":[]}',
);
const realFetch = window.fetch.bind(window);
window.fetch = async (input, opts = {}) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  if (!url.hostname.endsWith(".supabase.co")) return realFetch(input, opts);
  const path = url.pathname,
    method = opts.method || "GET",
    body = JSON.parse(String(opts.body || "{}"));
  let data: unknown = [];
  if (path.endsWith("/materials")) {
    if (method === "POST") {
      const m = {
        ...body,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      saved.materials.push(m);
      data = m;
    } else {
      const id = url.searchParams.get("id")?.replace("eq.", "");
      const rows = saved.materials.filter(
        (m: { id: string }) => !id || m.id === id,
      );
      if (method === "PATCH") {
        rows.forEach((m: object) => Object.assign(m, body));
        data = rows[0];
      } else if (id) data = rows[0];
      else
        data = rows.map((m: { metadata: object }) => ({ ...m, ...m.metadata }));
    }
  } else if (path.endsWith("/curve_material_sessions")) {
    const id = url.searchParams.get("id")?.replace("eq.", "");
    data = id
      ? saved.sessions.find((s: { id: string }) => s.id === id)
      : saved.sessions;
  } else if (path.endsWith("/material-study")) {
    if (body.action === "analyze")
      data = {
        topics: ["Photosynthesis", "Energy conversion"],
        summary: "An overview of how plants store energy.",
      };
    if (body.action === "generate") {
      data = {
        id: body.session_id,
        material_id: body.material_id,
        mode: body.mode,
        topic: body.topic,
        questions: Array.from({ length: 3 }, (_, i) => ({
          id: `q${i + 1}`,
          topic: body.topic,
          question: [
            "What energy do plants capture?",
            "Where is chemical energy stored?",
            "Which material supplies carbon?",
          ][i],
          options: [
            ["Light", "Sound", "Heat only", "Motion"],
            ["Glucose", "Nitrogen", "Light", "Sound"],
            ["Carbon dioxide", "Oxygen", "Hydrogen", "Helium"],
          ][i],
          page: 1,
        })),
        answers: {},
        hints: [],
        results: null,
        created_at: new Date().toISOString(),
        completed_at: null,
      };
      saved.sessions.push(data);
    }
    const s = saved.sessions.find(
      (s: { id: string }) => s.id === body.session_id,
    );
    if (body.action === "save") {
      s.answers = body.answers;
      data = { saved: true };
    }
    if (body.action === "hint") {
      s.hints.push(body.question_id);
      data = { hint: "Think about what reaches a leaf from the sun." };
    }
    if (body.action === "submit") {
      s.answers = body.answers;
      s.completed_at = new Date().toISOString();
      s.results = s.questions.map((q: { id: string; options: string[] }) => ({
        question_id: q.id,
        correct: body.answers[q.id] === 0,
        expected: q.options[0],
        explanation: "The source explains this conversion.",
        quote:
          "Photosynthesis converts light energy into chemical energy stored in glucose.",
        page: 1,
        assisted: s.hints.includes(q.id),
      }));
      data = s;
    }
  }
  sessionStorage.setItem("curve-workflow-test", JSON.stringify(saved));
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
// Dynamic imports ensure the test transport is installed before Supabase initializes.
const [
  { default: React },
  { createRoot },
  { MemoryRouter, Routes, Route },
  { AuthContext },
  workspace,
] = await Promise.all([
  import("react"),
  import("react-dom/client"),
  import("react-router-dom"),
  import("../src/contexts/AuthContext"),
  import("../src/learning/Workspace"),
]);
await import("../src/index.css");
const auth = {
  user: { id: uid, email: "fixture@example.test" },
  fullName: "Alex",
  signOut: async () => undefined,
} as AuthContextType;
createRoot(document.getElementById("root")!).render(
  <AuthContext.Provider value={auth}>
    <MemoryRouter>
      <Routes>
        <Route path="/learn/:sessionId" element={<workspace.MaterialStudy />} />
        <Route path="*" element={<workspace.LearningWorkspace />} />
      </Routes>
    </MemoryRouter>
  </AuthContext.Provider>,
);
