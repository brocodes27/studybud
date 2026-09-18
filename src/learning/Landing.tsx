import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  Layers3,
  Menu,
  Play,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { CurveMark, ProductPreview } from "./Preview";
import "./learning.css";

const questions = [
  [
    "Can I bring any course?",
    "Yes. Your course materials define the topics—there is no fixed three-subject catalog. Upload searchable PDFs, text files, Markdown, or paste notes. The quality and coverage of practice depend on the material you provide.",
  ],
  [
    "What happens after I upload my notes?",
    "Curve suggests topics for you to review and edit. Confirm them, choose a topic, and start a short practice session. Each question links back to an excerpt from your material.",
  ],
  [
    "How do you measure progress?",
    "Practice and independent checks are tracked separately. Independent accuracy comes from completed checks without hints. It describes the questions you attempted, not a guaranteed exam grade.",
  ],
  [
    "Can I use it on my phone?",
    "Yes. Your library, study sessions, and progress work in a responsive web app. Sign in on another device to continue your saved sessions.",
  ],
  [
    "Is my material private?",
    "Material in your Curve library is private to your account. Excerpts are processed by our AI provider to create topics and practice. You can delete material from your library at any time.",
  ],
];

export function LearningLanding() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="learn landing">
      <header className="landing-nav">
        <Link className="learn-brand" to="/">
          <CurveMark />
          curve<span className="beta-tag">BETA</span>
        </Link>
        <nav className={menu ? "open" : ""} aria-label="Main navigation">
          <a href="#how-it-works" onClick={() => setMenu(false)}>
            How it works
          </a>
          <a href="#your-workspace" onClick={() => setMenu(false)}>
            Your workspace
          </a>
          <a href="#questions" onClick={() => setMenu(false)}>
            Questions
          </a>
        </nav>
        <div className="nav-actions">
          <Link to="/auth">Log in</Link>
          <Link className="learn-button dark" to="/auth?mode=signup">
            Start learning <ArrowUpRight size={15} />
          </Link>
          <button
            className="icon-button mobile-menu"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-eyebrow">
            <span className="small-spark">✳</span> A little structure. A lot
            more understanding.
          </div>
          <h1>
            Less “where do I start?”
            <br />
            More{" "}
            <span className="hero-highlight">
              “I’ve got this.”
              <svg viewBox="0 0 450 18" aria-hidden="true">
                <path
                  d="M5 10 Q200 -2 442 8M38 16 Q225 6 410 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p>
            Your notes, your courses, your next big exam.
            <br className="desktop-break" /> One calm space to turn it all into
            understanding.
          </p>
          <div className="hero-actions">
            <Link className="learn-button dark large" to="/auth?mode=signup">
              Find your flow <ArrowRight size={18} />
            </Link>
            <Link className="learn-button subtle large" to="/demo">
              <Play size={15} /> Explore the workspace
            </Link>
          </div>
          <div className="hero-caption">
            <Check size={13} /> Bring your own course materials <span>·</span>{" "}
            Built for your whole semester
          </div>
          <div className="hero-preview-wrap" id="product-demo">
            <span className="preview-note">
              your next chapter starts here{" "}
              <svg width="40" height="38" viewBox="0 0 40 38">
                <path
                  d="M2 2Q35 0 28 32M19 24L28 33L36 25"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
            </span>
            <ProductPreview />
          </div>
        </section>
        <section className="material-strip">
          <p>Everything you’re learning. Finally connected.</p>
          <div>
            <span>
              <FileText />
              Lecture notes
            </span>
            <span>
              <BookOpen />
              Textbook chapters
            </span>
            <span>
              <Layers3 />
              Course syllabi
            </span>
            <span>
              <Target />
              Practice papers
            </span>
          </div>
        </section>
        <section id="how-it-works" className="landing-section">
          <div className="section-intro">
            <span className="section-kicker">
              FROM OVERWHELMED TO ON YOUR WAY
            </span>
            <h2>
              Big syllabus.
              <br />
              Small, doable steps.
            </h2>
            <p>You bring the ambition. Curve helps you find the next step.</p>
          </div>
          <div className="steps-grid">
            <article>
              <span className="step-number">01</span>
              <div className="step-illustration paper-stack">
                <span>lecture_notes.pdf</span>
                <span>chapter_04.pdf</span>
                <span>
                  <FileText /> Your next “aha” moment
                </span>
              </div>
              <h3>Make yourself at home.</h3>
              <p>
                Drop in your material. Review your topics. Give every course a
                place to live.
              </p>
            </article>
            <article>
              <span className="step-number">02</span>
              <div className="step-illustration mini-focus">
                <span>
                  <Sparkles size={17} /> TODAY’S NEXT STEP
                </span>
                <strong>
                  Understand.
                  <br />
                  Then try it yourself.
                </strong>
                <div>One topic. One clear starting point.</div>
              </div>
              <h3>Find the thing that clicks.</h3>
              <p>
                Get focused practice with helpful nudges and explanations tied
                to your notes.
              </p>
            </article>
            <article>
              <span className="step-number">03</span>
              <div className="step-illustration mini-growth">
                <div>
                  {[28, 44, 38, 60, 56, 79, 92].map((h, i) => (
                    <span key={i} style={{ height: h }} />
                  ))}
                </div>
                <span>Little by little, it starts to stick.</span>
              </div>
              <h3>See your effort take shape.</h3>
              <p>
                Check what you remember independently. Return to weak topics
                before exam day.
              </p>
            </article>
          </div>
        </section>
        <section
          id="your-workspace"
          className="landing-section workspace-section"
        >
          <div className="section-intro">
            <span className="section-kicker">A WORKSPACE THAT GETS YOU</span>
            <h2>
              All your courses.
              <br />A clearer head.
            </h2>
            <p>
              No fixed subject list. No scattered tabs. Just your material and a
              plan to move forward.
            </p>
          </div>
          <div className="feature-bento">
            <article className="bento-library">
              <span className="feature-icon">
                <Layers3 />
              </span>
              <h3>Your semester, together.</h3>
              <p>
                Biology at nine. Economics after lunch. Whatever you’re taking,
                keep your materials and progress in one place.
              </p>
              <div className="folder-scene">
                <span>
                  Biology <BookOpen />
                </span>
                <span>
                  Economics <TrendingShape />
                </span>
                <span>
                  Your next course <PlusShape />
                </span>
              </div>
            </article>
            <article className="bento-sources">
              <span className="feature-icon">
                <FileText />
              </span>
              <h3>
                “Where did that come from?”
                <br />
                Right here.
              </h3>
              <p>
                Jump from a practice answer to the exact passage in your
                material. Understand the reason, not just the answer.
              </p>
              <div className="source-example">
                <span>FROM YOUR NOTES · PAGE 12</span>
                <p>
                  “The opportunity cost of a choice is the value of the next
                  best alternative…”
                </p>
                <small>Explanation with a place to start checking.</small>
              </div>
            </article>
            <article className="bento-coach">
              <span className="feature-icon">
                <Sparkles />
              </span>
              <div>
                <h3>
                  A nudge when you need it.
                  <br />
                  Space to think when you don’t.
                </h3>
                <p>
                  Use hints during practice. Take independent checks without
                  them. Both have a place in learning.
                </p>
              </div>
              <div className="coach-example">
                <span>Try thinking about the next best alternative.</span>
                <span>Okay, let me try that again.</span>
              </div>
            </article>
          </div>
        </section>
        <section className="quiet-manifesto">
          <span>MADE FOR THE WAY LEARNING REALLY HAPPENS</span>
          <h2>
            Some days it clicks.
            <br />
            Some days you need another try.
            <br />
            <em>There’s room for both here.</em>
          </h2>
          <p>
            Curve helps you build understanding, one honest attempt at a time.
            <br />
            Your progress belongs to you.
          </p>
        </section>
        <section id="questions" className="landing-section faq-section">
          <div>
            <span className="section-kicker">
              A FEW THINGS YOU MIGHT BE WONDERING
            </span>
            <h2>Good questions.</h2>
          </div>
          <div className="faq-list">
            {questions.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <ChevronDown size={18} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-final">
          <Sparkles size={30} />
          <h2>
            Your next “aha”
            <br />
            is closer than you think.
          </h2>
          <Link className="learn-button dark large" to="/auth?mode=signup">
            Let’s make a start <ArrowRight size={18} />
          </Link>
          <p>Bring one course. Make a little progress.</p>
        </section>
      </main>
      <footer className="landing-footer">
        <Link className="learn-brand" to="/">
          <CurveMark />
          curve
        </Link>
        <p>A calmer way to move forward.</p>
        <div>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <a href="#questions">Help</a>
        </div>
        <small>© {new Date().getFullYear()} ElevenFolks</small>
      </footer>
    </div>
  );
}
function TrendingShape() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <path
        d="M2 21L9 13L15 16L24 4M16 4H24V12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
function PlusShape() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="M12 3V21M3 12H21" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
