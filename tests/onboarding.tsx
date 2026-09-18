// Isolated browser harness. Never sends auth, billing, or profile traffic remotely.
import type { AuthContextType } from "../src/contexts/AuthContext";
const uid = "00000000-0000-4000-8000-000000000001";
const realFetch = window.fetch.bind(window);
let paid = false;
let failSave = false;
let failAccess = false;
window.fetch = async (input, opts = {}) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  if (!url.hostname.endsWith(".supabase.co")) return realFetch(input, opts);
  let data: unknown = null;
  let status = 200;
  if (url.pathname.endsWith("/curve_study_preferences")) {
    if (opts.method === "POST") {
      if (failSave) {
        data = { message: "Fixture save error" };
        status = 500;
      } else {
        data = JSON.parse(String(opts.body));
        sessionStorage.setItem(
          "curve-onboarding-fixture",
          JSON.stringify(data),
        );
      }
    } else
      data = JSON.parse(
        sessionStorage.getItem("curve-onboarding-fixture") || "null",
      );
  } else if (url.pathname.endsWith("/curve_has_paid_access")) {
    data = failAccess ? { message: "Fixture access error" } : paid;
    status = failAccess ? 500 : 200;
  } else if (url.pathname.endsWith("/create-dodo-payment")) {
    data = { error: "Fixture checkout unavailable. Your saved setup is safe." };
    status = 503;
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};
const [
  { createRoot },
  { MemoryRouter, Link },
  { AuthContext },
  { LearningEntry },
] = await Promise.all([
  import("react-dom/client"),
  import("react-router-dom"),
  import("../src/contexts/AuthContext"),
  import("../src/learning/Onboarding"),
]);
await import("../src/index.css");
const auth = {
  user: { id: uid, email: "fixture@example.test" },
  session: { access_token: "fixture-not-a-real-token" },
  signOut: async () => undefined,
} as AuthContextType;
createRoot(document.getElementById("root")!).render(
  <AuthContext.Provider value={auth}>
    <MemoryRouter initialEntries={["/library"]}>
      <div
        style={{
          padding: 10,
          background: "#fff4d0",
          display: "flex",
          flexWrap: "wrap",
          gap: 15,
        }}
      >
        <b>Isolated fixture</b>
        <button
          onClick={() => {
            paid = true;
          }}
        >
          Simulate confirmed payment
        </button>
        <button
          onClick={() => {
            paid = false;
          }}
        >
          Simulate expired access
        </button>
        <button
          onClick={() => {
            failSave = !failSave;
          }}
        >
          Toggle save error
        </button>
        <button
          onClick={() => {
            failAccess = !failAccess;
          }}
        >
          Toggle access error
        </button>
        <Link to="/library">Direct workspace link</Link>
        <Link to="/subscription?checkout=returned">
          Simulate checkout return
        </Link>
      </div>
      <LearningEntry>
        <h1>Workspace unlocked</h1>
        <Link to="/subscription">View plan</Link>
      </LearningEntry>
    </MemoryRouter>
  </AuthContext.Provider>,
);
