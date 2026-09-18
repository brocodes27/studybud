import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { CurveMark } from "./Preview";
import "./learning.css";

export function LearningAuth() {
  const [params, setParams] = useSearchParams();
  const signup = params.get("mode") === "signup";
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = signup
        ? await signUp(email.trim(), password, {
            full_name: name.trim(),
            role: "student",
          })
        : await signIn(email.trim(), password);
      if (result.error) throw result.error;
      if (signup && !result.data?.session)
        setMessage(
          "Check your email to confirm your account. Then come back to sign in.",
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setError("");
    try {
      const result = await signInWithGoogle();
      if (result.error) throw result.error;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Google sign-in is unavailable. Try email instead.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="learn auth-page">
      <section className="auth-story">
        <Link to="/" className="learn-brand">
          <CurveMark />
          curve
        </Link>
        <div>
          <span className="pill lavender">A LITTLE MORE CLARITY</span>
          <h1>
            Your courses.
            <br />
            Your pace.
            <br />
            <em>Your next chapter.</em>
          </h1>
          <p>
            Bring your notes. Find your focus.
            <br />
            Build understanding, one session at a time.
          </p>
          <div className="auth-notes">
            <span>Lecture notes</span>
            <span>Big ideas</span>
            <span>Small wins</span>
          </div>
        </div>
        <p className="tiny-label">MAKE ROOM FOR WHAT YOU CAN BECOME.</p>
      </section>
      <main className="auth-form">
        <Link className="back-link" to="/">
          <ArrowLeft size={16} />
          Back to Curve
        </Link>
        <h2>{signup ? "Make yourself at home." : "Welcome back."}</h2>
        <p>
          {signup
            ? "A fresh workspace for everything you’re learning."
            : "Your next small step is waiting."}
        </p>
        <button
          className="learn-button subtle full-width"
          disabled={busy}
          onClick={() => void google()}
        >
          <span className="google-letter">G</span>Continue with Google
        </button>
        <div className="auth-divider">
          <span />
          or use your email
          <span />
        </div>
        <form onSubmit={(e) => void submit(e)}>
          {signup && (
            <label>
              Your name
              <input
                required
                autoComplete="name"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
              />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
            />
          </label>
          <label>
            Password
            <input
              required
              minLength={signup ? 8 : undefined}
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={signup ? "At least 8 characters" : "Your password"}
            />
          </label>
          {error && (
            <p role="alert" className="learn-error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="hint-box">
              {message}
            </p>
          )}
          <button className="learn-button dark full-width" disabled={busy}>
            {busy ? (
              <Loader2 className="spin" size={17} />
            ) : (
              <>
                {signup ? "Create my workspace" : "Sign in"}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
        <p className="auth-switch">
          {signup ? "Already have an account?" : "New here?"}{" "}
          <button
            className="text-button"
            onClick={() => {
              setParams(signup ? {} : { mode: "signup" });
              setError("");
              setMessage("");
            }}
          >
            {signup ? "Sign in" : "Create an account"}
          </button>
        </p>
        <small>
          By continuing, you agree to our <Link to="/terms">Terms</Link> and{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </small>
      </main>
    </div>
  );
}
