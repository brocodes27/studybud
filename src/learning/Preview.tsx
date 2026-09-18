import { useId, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  FolderOpen,
  Home,
  Lightbulb,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const demoCourses = [
  {
    name: "Molecular biology",
    code: "BIO 201",
    notes: [
      "Photosynthesis converts light energy into chemical energy. The light-dependent reactions take place in the thylakoid membranes; the Calvin cycle takes place in the stroma and uses carbon dioxide to build sugars.",
      "DNA replication is semiconservative: each new DNA molecule contains one original strand and one newly synthesized strand. Complementary base pairing helps each original strand serve as a template.",
    ],
    exam: "Midterm in 8 days",
    topic: "Cellular respiration",
    topics: [
      { name: "Cellular respiration", correct: 8, total: 10 },
      { name: "Photosynthesis", correct: 6, total: 10 },
      { name: "DNA replication", correct: 4, total: 5 },
    ],
    files: [
      "Lecture 04 · Cellular energy",
      "Chapter 07 · Photosynthesis",
      "Week 05 · Replication notes",
    ],
    page: 6,
    quote:
      "Glycolysis takes place in the cytosol. It breaks one glucose molecule into two pyruvate molecules, with a net gain of two ATP molecules.",
    question: "Where does glycolysis take place?",
    options: [
      "In the cytosol",
      "In the nucleus",
      "In the mitochondrial matrix",
      "In the chloroplast",
    ],
    answer: 0,
    hint: "This first step happens before pyruvate enters a mitochondrion.",
    explanation:
      "Glycolysis happens in the cytosol. Later steps of aerobic respiration take place in the mitochondria.",
    practice: [2, 3, 1, 4, 2, 5, 3],
    checks: [0, 1, 1, 2, 1, 2, 2],
  },
  {
    name: "Principles of economics",
    code: "ECON 101",
    notes: [
      "A market is in equilibrium when quantity supplied equals quantity demanded. A shift in demand can change the equilibrium price and quantity, even when the supply curve stays the same.",
      "Price elasticity of demand measures how responsive quantity demanded is to a price change. It compares the percentage change in quantity demanded with the percentage change in price.",
    ],
    exam: "Quiz in 5 days",
    topic: "Opportunity cost",
    topics: [
      { name: "Opportunity cost", correct: 9, total: 10 },
      { name: "Supply & demand", correct: 7, total: 10 },
      { name: "Price elasticity", correct: 3, total: 5 },
    ],
    files: [
      "Lecture 03 · Choices & trade-offs",
      "Chapter 04 · Market equilibrium",
      "Tutorial 02 · Elasticity",
    ],
    page: 3,
    quote:
      "The opportunity cost of a choice is the value of the next best alternative you give up when making that choice.",
    question:
      "You spend an hour studying instead of taking a paid shift. What is the opportunity cost?",
    options: [
      "The price of your textbook",
      "The wages from the shift you gave up",
      "All the money you could ever earn",
      "There is no opportunity cost",
    ],
    answer: 1,
    hint: "Focus on the next best alternative you gave up.",
    explanation:
      "The forgone shift is the next best alternative in this example, so its wages represent the opportunity cost.",
    practice: [1, 2, 3, 2, 4, 2, 3],
    checks: [0, 1, 1, 1, 2, 1, 2],
  },
  {
    name: "Applied mathematics",
    code: "MATH 120",
    notes: [
      "A limit describes the value a function approaches as its input approaches a point. A two-sided limit exists when the left-hand and right-hand limits agree, even if the function is not defined at that point.",
      "A definite integral represents signed accumulation over an interval. By the fundamental theorem of calculus, if F is an antiderivative of a continuous function f, then the integral of f from a to b equals F(b) − F(a).",
    ],
    exam: "Final in 14 days",
    topic: "Derivatives",
    topics: [
      { name: "Derivatives", correct: 7, total: 10 },
      { name: "Limits", correct: 8, total: 10 },
      { name: "Integration", correct: 2, total: 5 },
    ],
    files: [
      "Lecture 06 · Rates of change",
      "Chapter 02 · Limits",
      "Workshop 03 · Integration",
    ],
    page: 4,
    quote:
      "The derivative of f(x) = x² is f′(x) = 2x. Substituting a point's x-coordinate gives the slope of the tangent at that point.",
    question: "For f(x) = x², what is the slope of the tangent at x = 3?",
    options: ["3", "9", "6", "2"],
    answer: 2,
    hint: "Differentiate first, then substitute x = 3.",
    explanation:
      "The derivative is 2x. At x = 3, the tangent's slope is 2 × 3 = 6.",
    practice: [3, 1, 2, 4, 3, 2, 4],
    checks: [1, 0, 1, 2, 1, 1, 2],
  },
  {
    name: "Introduction to psychology",
    code: "PSY 101",
    notes: [
      "Selective attention involves focusing on some information while giving less attention to other information. A study environment with fewer competing distractions can make it easier to stay focused on the current task.",
      "In operant conditioning, reinforcement increases the likelihood of a behavior. Positive reinforcement adds a consequence; negative reinforcement removes a consequence. Both are defined by their effect on future behavior.",
    ],
    exam: "Your own pace",
    topic: "Memory & retrieval",
    topics: [
      { name: "Memory & retrieval", correct: 8, total: 10 },
      { name: "Attention", correct: 6, total: 10 },
      { name: "Learning", correct: 4, total: 5 },
    ],
    files: [
      "Lecture 05 · Remembering",
      "Chapter 03 · Attention",
      "Week 04 · Learning notes",
    ],
    page: 2,
    quote:
      "Retrieval practice means attempting to recall information from memory before consulting the source. Feedback then helps identify gaps in what was recalled.",
    question: "Which activity is an example of retrieval practice?",
    options: [
      "Closing your notes and recalling the main ideas",
      "Copying a paragraph word for word",
      "Highlighting every sentence",
      "Reading the same page again",
    ],
    answer: 0,
    hint: "Which option requires you to produce an answer from memory?",
    explanation:
      "Recalling the main ideas without looking at the notes requires retrieval. Checking the source afterwards provides feedback.",
    practice: [1, 1, 2, 1, 3, 2, 2],
    checks: [0, 0, 1, 0, 1, 1, 1],
  },
];
const tabs = ["Dashboard", "Courses", "Progress"] as const;
type DemoTab = (typeof tabs)[number];

export function CurveMark() {
  return (
    <span className="learn-mark" aria-hidden="true">
      <svg width="24" height="25" viewBox="0 0 24 25" fill="none">
        <path d="M4 4H20V20H4V4Z" stroke="currentColor" strokeWidth="2.3" />
        <path
          d="M8 8V16H16V8M4 4L8 8M20 4L16 8"
          stroke="currentColor"
          strokeWidth="2.3"
        />
      </svg>
    </span>
  );
}

export function ProductPreview({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const [tab, setTab] = useState<DemoTab>("Dashboard");
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("week");
  const [studying, setStudying] = useState(false);
  const [answer, setAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [hint, setHint] = useState(false);
  const [plan, setPlan] = useState([true, false, false]);
  const course = demoCourses[selected];
  const correct = course.topics.reduce((n, t) => n + t.correct, 0);
  const total = course.topics.reduce((n, t) => n + t.total, 0);
  const accuracy = Math.round((100 * correct) / total);
  const practice =
    range === "week"
      ? course.practice
      : course.practice.map((n, i) => Math.max(0, n - 1 + (i % 2)));
  const checks =
    range === "week"
      ? course.checks
      : course.checks.map((n) => Math.max(0, n - 1));
  const sessions =
    practice.reduce((n, x) => n + x, 0) + checks.reduce((n, x) => n + x, 0);
  function openTab(next: DemoTab) {
    setTab(next);
    setStudying(false);
  }
  function resetQuestion() {
    setAnswer(null);
    setSubmitted(false);
    setHint(false);
  }
  function selectCourse(index: number) {
    setSelected(index);
    resetQuestion();
    setPlan([true, false, false]);
  }
  const chart = (
    <section className="preview-chart">
      <div className="preview-section-title">
        <div>
          Small steps. Real progress.
          <small>
            {course.code} · {sessions} completed sample sessions
          </small>
        </div>
        <select
          className="preview-select"
          aria-label="Demo activity period"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option value="week">This week</option>
          <option value="previous">Last week</option>
        </select>
      </div>
      <div className="chart-legend">
        <span>Practice</span>
        <span>Independent checks</span>
      </div>
      <svg
        viewBox="0 0 520 160"
        role="img"
        aria-label={`${course.name}: ${sessions} sample sessions ${range === "week" ? "this" : "last"} week`}
      >
        <title>
          Sample completed sessions per day. Each bar group separates practice
          from independent checks.
        </title>
        {[0, 2, 4, 6].map((n) => (
          <g key={n}>
            <line
              x1="20"
              y1={140 - n * 20}
              x2="520"
              y2={140 - n * 20}
              stroke="#eef0f0"
            />
            <text x="0" y={144 - n * 20} fontSize="9" fill="#687062">
              {n}
            </text>
          </g>
        ))}
        {practice.map((n, i) => (
          <g key={i}>
            <rect
              x={35 + i * 70}
              y={140 - n * 20}
              width="18"
              height={n * 20}
              rx="4"
              fill="#aaa1e5"
            >
              <title>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}: {n}{" "}
                practice sessions
              </title>
            </rect>
            <rect
              x={57 + i * 70}
              y={140 - checks[i] * 20}
              width="13"
              height={checks[i] * 20}
              rx="4"
              fill="#92cce1"
            >
              <title>{checks[i]} independent checks</title>
            </rect>
          </g>
        ))}
      </svg>
      <div className="preview-days">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </section>
  );
  const topicRows = (
    <div className="demo-topics">
      {course.topics.map((t) => (
        <div className="demo-topic" key={t.name}>
          <div>
            <span>{t.name}</span>
            <strong>{Math.round((100 * t.correct) / t.total)}%</strong>
          </div>
          <div className="demo-meter">
            <span style={{ width: `${(100 * t.correct) / t.total}%` }} />
          </div>
          <small>
            {t.correct} of {t.total} independent answers correct ·{" "}
            {t.correct / t.total < 0.7 ? "Worth revisiting" : "Keep practicing"}
          </small>
        </div>
      ))}
    </div>
  );
  return (
    <div
      className={`product-preview detailed-preview ${compact ? "compact" : ""}`}
    >
      <div className="preview-top">
        <CurveMark />
        <nav aria-label="Sample dashboard tabs">
          {tabs.map((t) => (
            <button
              key={t}
              aria-pressed={tab === t && !studying}
              className={tab === t && !studying ? "active" : ""}
              onClick={() => openTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <span className="preview-avatar" title="Jamie’s sample account">
          J
        </span>
      </div>
      <div className="preview-body">
        <aside className="preview-rail" aria-label="Demo navigation">
          {[
            { name: "Dashboard", icon: Home },
            { name: "Courses", icon: FolderOpen },
            { name: "Progress", icon: TrendingUp },
          ].map((n) => (
            <button
              key={n.name}
              aria-label={`Demo ${n.name.toLowerCase()}`}
              aria-pressed={tab === n.name && !studying}
              onClick={() => openTab(n.name as DemoTab)}
            >
              <n.icon />
            </button>
          ))}
          <button
            aria-label="Try demo practice"
            aria-pressed={studying}
            onClick={() => {
              resetQuestion();
              setStudying(true);
            }}
          >
            <BookOpen />
          </button>
        </aside>
        <div className="preview-content">
          <div className="preview-heading">
            <div>
              <p>Jamie’s semester · Your space to make progress</p>
              <h3>
                {studying
                  ? "One question. A little more clarity."
                  : tab === "Dashboard"
                    ? "A little clearer, every day."
                    : tab === "Courses"
                      ? "Your courses. All together."
                      : "See what’s starting to stick."}
              </h3>
            </div>
            <span className="sample-label">INTERACTIVE DEMO · SAMPLE DATA</span>
          </div>
          <div className="preview-grid">
            <section className="preview-courses">
              <div className="preview-section-title">
                Your courses{" "}
                <span className="demo-count">{demoCourses.length}</span>
              </div>
              <label className="preview-search">
                <Search size={13} />
                <input
                  aria-label="Search demo courses"
                  placeholder="Find a course"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="demo-course-list">
                {demoCourses.map(
                  (c, i) =>
                    c.name.toLowerCase().includes(query.toLowerCase()) && (
                      <button
                        key={c.code}
                        aria-pressed={selected === i}
                        onClick={() => selectCourse(i)}
                        className={`preview-course tone-${i} ${selected === i ? "selected" : ""}`}
                      >
                        <span className="preview-course-number">
                          {c.code}
                          <ArrowUpRight size={15} />
                        </span>
                        <strong>{c.name}</strong>
                        <small>{c.exam}</small>
                        <span className="preview-course-bottom">
                          <BookOpen size={12} />
                          {c.files.length} materials
                          <span>{c.topics.length} topics</span>
                        </span>
                      </button>
                    ),
                )}
              </div>
              {!demoCourses.some((c) =>
                c.name.toLowerCase().includes(query.toLowerCase()),
              ) && (
                <p className="demo-no-results">
                  No matching sample course.
                  <button onClick={() => setQuery("")}>Clear search</button>
                </p>
              )}
              <p className="demo-sidebar-note">
                These are examples. Your own materials can cover any course.
              </p>
            </section>
            <div className="preview-right" id={`${id}-content`}>
              {studying ? (
                <section className="demo-study">
                  <div className="preview-section-title">
                    <button
                      className="demo-back"
                      onClick={() => setStudying(false)}
                    >
                      <ArrowLeft size={13} />
                      Workspace
                    </button>
                    <span className="sample-label">
                      GUIDED PRACTICE · 1 QUESTION
                    </span>
                  </div>
                  <span className="demo-course-label">
                    {course.code} / {course.topic}
                  </span>
                  <h4>{course.question}</h4>
                  <fieldset className="demo-answers" disabled={submitted}>
                    <legend className="sr-only">Choose your demo answer</legend>
                    {course.options.map((option, i) => (
                      <label
                        key={option}
                        className={`${answer === i ? "chosen" : ""} ${submitted && i === course.answer ? "correct" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`${id}-answer`}
                          checked={answer === i}
                          onChange={() => setAnswer(i)}
                        />
                        <span>{String.fromCharCode(65 + i)}</span>
                        {option}
                        {submitted && i === course.answer && (
                          <Check size={15} />
                        )}
                      </label>
                    ))}
                  </fieldset>
                  {hint && !submitted && (
                    <p className="demo-hint">
                      <Lightbulb size={14} />
                      {course.hint}
                    </p>
                  )}
                  {!submitted ? (
                    <div className="demo-study-actions">
                      <button
                        className="demo-back"
                        onClick={() => setHint(!hint)}
                      >
                        <Lightbulb size={14} />
                        {hint ? "Hide hint" : "A little nudge"}
                      </button>
                      <button
                        className="preview-start"
                        disabled={answer === null}
                        onClick={() => setSubmitted(true)}
                      >
                        Check my answer <ArrowRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="demo-feedback" role="status">
                      <strong>
                        {answer === course.answer
                          ? "You’ve got it."
                          : "A useful thing to revisit."}
                      </strong>
                      <p>{course.explanation}</p>
                      <blockquote>
                        <span>
                          SAMPLE NOTE · {course.files[0]} · PAGE {course.page}
                        </span>
                        {course.quote}
                      </blockquote>
                      <button className="demo-back" onClick={resetQuestion}>
                        Try again <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                  <p className="demo-fine-print">
                    A prewritten example, not a live AI response. Your answer
                    stays in this demo and does not change the sample progress.
                  </p>
                </section>
              ) : tab === "Dashboard" ? (
                <>
                  <div className="demo-stat-row">
                    <div>
                      <span>Independent accuracy</span>
                      <strong>{accuracy}%</strong>
                      <small>
                        {correct} / {total} sample answers
                      </small>
                    </div>
                    <div>
                      <span>Study activity</span>
                      <strong>
                        {sessions}
                        <em>sessions</em>
                      </strong>
                      <small>
                        {range === "week" ? "This week" : "Last week"} ·
                        practice + checks
                      </small>
                    </div>
                    <div>
                      <span>Next milestone</span>
                      <strong>
                        {course.exam.includes("days")
                          ? course.exam.match(/\d+/)?.[0]
                          : "—"}
                        <em>
                          {course.exam.includes("days")
                            ? "days"
                            : "at your pace"}
                        </em>
                      </strong>
                      <small>
                        {course.code} · {course.exam.split(" in ")[0]}
                      </small>
                    </div>
                  </div>
                  {chart}
                  <div className="preview-lower">
                    <section className="preview-task">
                      <div className="preview-section-title">
                        A good next step <Sparkles size={16} />
                      </div>
                      <span className="tiny-label">
                        {course.code} · GUIDED PRACTICE
                      </span>
                      <h4>{course.topic}</h4>
                      <p>
                        Recall the idea, try a question, then see exactly where
                        the answer comes from.
                      </p>
                      <div className="preview-task-footer">
                        <span>About 1 minute</span>
                        <button
                          className="preview-start"
                          onClick={() => {
                            resetQuestion();
                            setStudying(true);
                          }}
                        >
                          Try a question <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </section>
                    <section className="preview-checklist">
                      <div className="preview-section-title">
                        Today’s study plan{" "}
                        <span className="demo-count">
                          {plan.filter(Boolean).length}/3
                        </span>
                      </div>
                      {[
                        "Review your lecture notes",
                        "Practice the tricky part",
                        "Check what you remember",
                      ].map((t, i) => (
                        <label className="demo-plan-item" key={t}>
                          <input
                            type="checkbox"
                            checked={plan[i]}
                            onChange={() =>
                              setPlan((p) =>
                                p.map((v, j) => (j === i ? !v : v)),
                              )
                            }
                          />
                          <span>{t}</span>
                          <small>{[5, 10, 5][i]} min</small>
                        </label>
                      ))}
                      <p>
                        Try checking an item. This sample plan resets when you
                        choose another course.
                      </p>
                    </section>
                  </div>
                </>
              ) : tab === "Courses" ? (
                <>
                  <section className="demo-course-detail">
                    <div className="preview-section-title">
                      <div>
                        {course.name}
                        <small>
                          {course.code} · {course.exam}
                        </small>
                      </div>
                      <span className="pill lavender">3 MATERIALS</span>
                    </div>
                    <p className="demo-section-description">
                      A home for your notes, chapters, and practice papers. Open
                      a sample source below.
                    </p>
                    <div className="demo-source-list">
                      {course.files.map((file, i) => (
                        <details key={file} open={i === 0}>
                          <summary>
                            <span className="demo-file-icon">
                              <FileText size={17} />
                            </span>
                            <span>
                              {file}
                              <small>
                                {i === 0
                                  ? "Lecture notes · sample excerpt"
                                  : i === 1
                                    ? "Textbook chapter · sample outline"
                                    : "Course notes · sample outline"}
                              </small>
                            </span>
                            <span className="demo-source-toggle">+</span>
                          </summary>
                          <div className="demo-source-content">
                            {i === 0 ? (
                              <>
                                <span className="tiny-label">
                                  PAGE {course.page}
                                </span>
                                <p>{course.quote}</p>
                              </>
                            ) : (
                              <>
                                <strong>{course.topics[i].name}</strong>
                                <p>{course.notes[i - 1]}</p>
                              </>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  </section>
                  <section className="demo-topic-panel">
                    <div className="preview-section-title">
                      What you’re working on{" "}
                      <span className="demo-count">3 topics</span>
                    </div>
                    {topicRows}
                    <button
                      className="preview-start"
                      onClick={() => {
                        resetQuestion();
                        setStudying(true);
                      }}
                    >
                      Practice {course.topic.toLowerCase()}{" "}
                      <ArrowRight size={14} />
                    </button>
                  </section>
                </>
              ) : (
                <>
                  {chart}
                  <section className="demo-topic-panel">
                    <div className="preview-section-title">
                      <div>
                        Understanding, topic by topic
                        <small>
                          Independent checks only · {correct} / {total} correct
                          · sample history
                        </small>
                      </div>
                      <strong className="demo-accuracy">{accuracy}%</strong>
                    </div>
                    {topicRows}
                  </section>
                  <section className="demo-history">
                    <div className="preview-section-title">
                      Recent sample sessions
                    </div>
                    {course.topics.slice(0, 2).map((t, i) => (
                      <div className="demo-history-row" key={t.name}>
                        <span className="demo-file-icon">
                          <Check size={15} />
                        </span>
                        <span>
                          {t.name}
                          <small>
                            Independent check ·{" "}
                            {i === 0 ? "Today" : "Yesterday"}
                          </small>
                        </span>
                        <strong>
                          {t.correct}/{t.total}
                        </strong>
                      </div>
                    ))}
                  </section>
                </>
              )}
            </div>
          </div>
          <div className="demo-bottom-note">
            <span>
              <Sparkles size={13} />
              Choose a course, explore the tabs, or try a practice question.
            </span>
            <Link to="/auth?mode=signup">
              Make it yours <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
