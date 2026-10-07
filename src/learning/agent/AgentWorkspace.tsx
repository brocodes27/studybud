import { useEffect, useRef, useState, FormEvent, KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Home,
  Settings2,
  CheckCircle2,
  FileText,
  HelpCircle,
  Mic,
  MicOff,
  Paperclip,
  PhoneOff,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchLibrary } from '../api';
import type { Material, StudySession } from '../model';
import { MaterialUpload } from '../Workspace';
import {
  type AgentAction,
  type Citation,
  type StudyPlanStep,
  type WorkspaceArtifact,
  type WorkspaceEvent,
  type WorkspaceMessage,
  type WorkspaceSnapshot,
  type WorkspaceThread,
  emptyWorkspace,
  putArtifact,
  removeArtifact,
} from './contracts';
import {
  activateWorkspaceArtifact,
  executeWorkspaceTool,
  loadWorkspaceSnapshot,
  sendWorkspaceMessage,
} from './api';
import { useVoice } from './useVoice';
import {
  ExplanationView,
  MaterialView,
  ProgressView,
  SessionView,
  StudyPlanBanner,
} from './WorkspaceViews';
import { HomeView } from './DashboardHome';
import { CurveMark } from '../Preview';
import { CurveOrb } from './CurveOrb';
import './workspace.css';

export function AgentWorkspace() {
  const { user, fullName } = useAuth();
  const [, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [thread, setThread] = useState<WorkspaceThread>({
    id: 'local',
    state: emptyWorkspace(),
    updated_at: new Date().toISOString(),
  });
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [runningActions, setRunningActions] = useState<AgentAction[]>([]);
  const [streamingText, setStreamingText] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'workspace'>('workspace');

  // Library & sessions data for home state & fallback
  const [materials, setMaterials] = useState<Material[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [showUpload, setShowUpload] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat on new message or streaming delta
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, runningActions]);

  // Reload the library independently so retries preserve the conversation.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    setLibraryLoading(true);
    setLibraryError('');
    // Load materials and past sessions
    fetchLibrary(user.id)
      .then((data) => {
        if (cancelled) return;
        setMaterials(data.materials);
        setSessions(data.sessions);
      })
      .catch(() => {
        if (!cancelled)
          setLibraryError(
            'Your library could not load. Try again to pick up where you left off.'
          );
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, libraryRevision]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // Load workspace agent state
    loadWorkspaceSnapshot()
      .then((snap) => {
        if (cancelled) return;
        setSnapshot(snap);
        setThread(snap.thread);
        setMessages(snap.messages);
      })
      .catch(() => {
        // Fallback: start with clean local state
        if (cancelled) return;
        setThread({
          id: 'local',
          state: emptyWorkspace(),
          updated_at: new Date().toISOString(),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleEvent = (event: WorkspaceEvent) => {
    if (event.type === 'text') {
      setStreamingText((prev) => prev + event.text);
    } else if (event.type === 'action') {
      setRunningActions((prev) => {
        const filtered = prev.filter((a) => a.id !== event.action.id);
        return event.action.status === 'completed'
          ? filtered
          : [...filtered, event.action];
      });
    } else if (event.type === 'state') {
      setThread(event.thread);
    } else if (event.type === 'done') {
      if (event.snapshot) {
        setSnapshot(event.snapshot);
        setThread(event.snapshot.thread);
        setMessages(event.snapshot.messages);
      }
      setStreamingText('');
      setRunningActions([]);
      setBusy(false);
    } else if (event.type === 'error') {
      setBusy(false);
      setStreamingText('');
      setRunningActions([]);
    }
  };

  // Voice hook
  const voice = useVoice({
    onEvent: handleEvent,
    onTranscript: (role, text) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role,
          content: text,
          created_at: new Date().toISOString(),
        },
      ]);
    },
    checkpointId: thread.state.checkpointId,
  });

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || busy) return;

    setInput('');
    setBusy(true);
    setStreamingText('');

    // Optimistically show user message
    const tempUserMsg: WorkspaceMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const snap = await sendWorkspaceMessage(text, handleEvent);
      if (snap) {
        setSnapshot(snap);
        setThread(snap.thread);
        setMessages(snap.messages);
      }
    } catch (err) {
      const errText =
        err instanceof Error ? err.message : 'Could not complete action.';
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errText,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
      setStreamingText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const handleSelectTab = async (artifactId: string) => {
    setThread((prev) => ({
      ...prev,
      state: { ...prev.state, activeId: artifactId },
    }));
    try {
      await activateWorkspaceArtifact(artifactId);
    } catch {
      /* local optimistic switch succeeded */
    }
  };

  const handleCloseTab = (artifactId: string) => {
    setThread((prev) => ({
      ...prev,
      state: removeArtifact(prev.state, artifactId),
    }));
  };

  const handlePlanStepClick = async (step: StudyPlanStep) => {
    if (step.kind === 'learn') {
      const m = materials.find((x) => x.id === step.materialId);
      if (m) {
        const art: WorkspaceArtifact = {
          id: `material:${m.id}`,
          kind: 'material',
          materialId: m.id,
          title: m.title,
          page: 1,
        };
        setThread((prev) => ({
          ...prev,
          state: putArtifact(prev.state, art),
        }));
        setMobileTab('workspace');
      }
    } else {
      // Start or resume practice / checkpoint session
      setBusy(true);
      try {
        await executeWorkspaceTool(
          {
            name: 'start_practice',
            args: {
              materialId: step.materialId,
              topic: step.topic,
              mode: step.kind === 'checkpoint' ? 'checkpoint' : 'practice',
            },
          },
          handleEvent
        );
        setMobileTab('workspace');
      } catch {
        /* handled via event */
      } finally {
        setBusy(false);
      }
    }
  };

  const handleOpenMaterial = (m: Material) => {
    const art: WorkspaceArtifact = {
      id: `material:${m.id}`,
      kind: 'material',
      materialId: m.id,
      title: m.title,
      page: 1,
    };
    setThread((prev) => ({
      ...prev,
      state: putArtifact(prev.state, art),
    }));
    setMobileTab('workspace');
  };

  const handleOpenSession = (sessionId: string) => {
    const s = sessions.find((x) => x.id === sessionId);
    const art: WorkspaceArtifact = {
      id: `session:${sessionId}`,
      kind: 'session',
      sessionId,
      title: s?.topic || 'Practice session',
    };
    setThread((prev) => ({
      ...prev,
      state: putArtifact(prev.state, art),
    }));
    setMobileTab('workspace');
  };

  const handleStartPracticeFromMaterial = async (
    material: Material,
    topic: string
  ) => {
    setBusy(true);
    try {
      await executeWorkspaceTool(
        {
          name: 'start_practice',
          args: {
            materialId: material.id,
            topic,
            mode: 'practice',
          },
        },
        handleEvent
      );
      setMobileTab('workspace');
    } catch {
      /* handled via event */
    } finally {
      setBusy(false);
    }
  };

  const handleOpenCitation = (c: Citation) => {
    const m = materials.find((x) => x.id === c.materialId);
    if (!m) return;
    const art: WorkspaceArtifact = {
      id: `material:${m.id}`,
      kind: 'material',
      materialId: m.id,
      title: m.title,
      page: c.page,
    };
    setThread((prev) => ({
      ...prev,
      state: putArtifact(prev.state, art),
    }));
    setMobileTab('workspace');
  };

  // Active artifact
  const artifacts = thread.state.artifacts || [];
  const activeArtifact = artifacts.find((a) => a.id === thread.state.activeId);

  return (
    <div
      className="learn agent-workspace-container"
      data-mobile-view={mobileTab}
    >
      <header className="agent-app-header">
        <Link className="learn-brand" to="/" aria-label="Curve dashboard">
          <CurveMark />
          curve
        </Link>
        <nav aria-label="Workspace">
          <Link className="active" aria-current="page" to="/">
            Dashboard
          </Link>
          <Link to="/library">Library</Link>
          <Link to="/courses">Courses</Link>
          <Link to="/progress">Progress</Link>
        </nav>
        <Link
          className="agent-account"
          to="/settings"
          aria-label="Account settings"
        >
          <Settings2 size={17} />
          <span className="user-avatar">
            {(fullName || user?.email || 'S')[0].toUpperCase()}
          </span>
        </Link>
      </header>
      {/* Mobile Switcher */}
      <nav className="agent-mobile-tabs" aria-label="View selection">
        <button
          className={`mobile-tab-btn ${mobileTab === 'workspace' ? 'active' : ''}`}
          aria-pressed={mobileTab === 'workspace'}
          onClick={() => setMobileTab('workspace')}
        >
          Dashboard
        </button>
        <button
          className={`mobile-tab-btn ${mobileTab === 'chat' ? 'active' : ''}`}
          aria-pressed={mobileTab === 'chat'}
          onClick={() => setMobileTab('chat')}
        >
          Conversation {messages.length > 0 && `(${messages.length})`}
        </button>
      </nav>

      {/* LEFT PANE: Conversation & Agent */}
      <aside className="agent-chat-pane">
        <header className="chat-pane-header">
          <div className="chat-header-brand">
            <Sparkles size={16} />
            <strong>Your study companion</strong>
          </div>
          <div className="chat-header-actions">
            <Link to="/library" className="nav-link-subtle" title="Library">
              <BookOpen size={16} />
            </Link>
            <Link to="/progress" className="nav-link-subtle" title="Progress">
              <TrendingUp size={16} />
            </Link>
          </div>
        </header>

        {/* Living Curve Orb Stage */}
        <section
          className={`orb-hero-stage state-${voice.state}`}
          aria-label="Curve Voice Orb"
        >
          <CurveOrb
            state={voice.state}
            isMuted={voice.isMuted}
            size={112}
            onClick={() => {
              if (voice.state !== 'disconnected') {
                voice.disconnect();
              } else {
                void voice.connect();
              }
            }}
          />
          <div className="orb-status-details">
            <div className="orb-status-badge">
              <span className={`orb-status-light ${voice.state}`} />
              <span className="orb-status-text">
                {voice.state === 'disconnected'
                  ? 'Talk to Curve'
                  : voice.state === 'connecting'
                    ? 'Connecting…'
                    : voice.state === 'listening'
                      ? 'Listening'
                      : voice.state === 'working'
                        ? 'Synthesizing'
                        : voice.state === 'speaking'
                          ? 'Speaking'
                          : 'Muted'}
              </span>
            </div>
            <p className="orb-caption">
              {voice.state === 'disconnected'
                ? 'Tap orb to start voice conversation'
                : voice.state === 'listening'
                  ? 'Speak your goal or question naturally'
                  : voice.state === 'speaking'
                    ? 'Tap orb anytime to interrupt'
                    : voice.state === 'working'
                      ? 'Reasoning over materials…'
                      : 'Microphone is currently muted'}
            </p>

            {voice.state !== 'disconnected' && (
              <div className="orb-quick-controls">
                <button
                  type="button"
                  className={`orb-btn-compact ${voice.isMuted ? 'active-mute' : ''}`}
                  onClick={voice.toggleMute}
                  title={
                    voice.isMuted ? 'Unmute microphone' : 'Mute microphone'
                  }
                >
                  {voice.isMuted ? <MicOff size={13} /> : <Mic size={13} />}
                  <span>{voice.isMuted ? 'Unmute' : 'Mute'}</span>
                </button>
                <button
                  type="button"
                  className="orb-btn-compact end-call"
                  onClick={voice.disconnect}
                  title="End voice session"
                >
                  <PhoneOff size={13} />
                  <span>End call</span>
                </button>
              </div>
            )}
          </div>

          {/* Live Transcript ticker directly beneath the orb */}
          {voice.liveTranscript && (
            <div className="orb-live-ticker">
              <span className="ticker-dot" />
              <p className="ticker-text">{voice.liveTranscript}</p>
            </div>
          )}
        </section>

        {/* Scrollable messages */}
        <div className="chat-messages-container">
          {messages.length === 0 && !streamingText && (
            <div className="chat-empty-hint">
              <Sparkles size={24} className="text-mint" />
              <p>
                Tell Curve what you want to study, ask a question, or talk
                through your materials.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`message-bubble ${m.role}`}>
              <div className="message-content">{m.content}</div>
              <span className="message-time">
                {new Date(m.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}

          {/* Running Action Badges */}
          {runningActions.map((action) => (
            <div
              key={action.id}
              className={`action-status-card ${action.status}`}
            >
              <span>{action.name.replace(/_/g, ' ')}…</span>
            </div>
          ))}

          {/* Assistant Streaming Response */}
          {streamingText && (
            <div className="message-bubble assistant">
              <div className="message-content">{streamingText}</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="chat-composer-wrap">
          {messages.length === 0 && (
            <div className="composer-quick-chips">
              <button
                className="chip-btn"
                onClick={() =>
                  void handleSendMessage(
                    'My exam is Friday. I have 40 minutes.'
                  )
                }
              >
                40 min session
              </button>
              <button
                className="chip-btn"
                onClick={() =>
                  void handleSendMessage('Build a focused study plan.')
                }
              >
                Build study plan
              </button>
              <button
                className="chip-btn"
                onClick={() =>
                  void handleSendMessage('Test my independent understanding.')
                }
              >
                Independent check
              </button>
            </div>
          )}

          <form
            className="composer-form"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void handleSendMessage();
            }}
          >
            <button
              type="button"
              className="composer-tool-btn"
              title="Add course notes"
              onClick={() => setShowUpload(true)}
            >
              <Paperclip size={16} />
            </button>

            <textarea
              ref={textareaRef}
              aria-label="Message Curve"
              rows={1}
              className="composer-textarea"
              placeholder={
                thread.state.checkpointId
                  ? 'Independent check: type A, B, C, or D…'
                  : 'Speak or type your goal…'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
            />

            {/* Talk to Curve (Voice toggle) */}
            <button
              type="button"
              className={`voice-toggle-btn ${
                voice.state !== 'disconnected' ? 'active' : ''
              }`}
              onClick={() => {
                if (voice.state !== 'disconnected') {
                  voice.disconnect();
                } else {
                  void voice.connect();
                }
              }}
              title="Talk to Curve with voice"
            >
              <Mic size={15} />
              <span>{voice.state !== 'disconnected' ? 'Active' : 'Talk'}</span>
            </button>

            <button
              type="submit"
              className="composer-send-btn"
              disabled={!input.trim() || busy}
              title="Send"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </aside>

      {/* RIGHT PANE: Working Area */}
      <main className="agent-working-pane">
        {/* Compact Study Plan Banner */}
        {thread.state.plan && (
          <StudyPlanBanner
            plan={thread.state.plan}
            onStepClick={handlePlanStepClick}
          />
        )}

        {/* Artifact Tabs Header */}
        <div className="agent-tabs-bar">
          <div className="tabs-scroll-area">
            <button
              className={`artifact-tab ${!activeArtifact ? 'active' : ''}`}
              aria-pressed={!activeArtifact}
              onClick={() =>
                setThread((prev) => ({
                  ...prev,
                  state: { ...prev.state, activeId: null },
                }))
              }
            >
              <Home size={14} /> Dashboard
            </button>

            {artifacts.map((a) => (
              <div
                key={a.id}
                className={`artifact-tab ${
                  activeArtifact?.id === a.id ? 'active' : ''
                }`}
              >
                <button
                  className="artifact-tab-select"
                  aria-pressed={activeArtifact?.id === a.id}
                  onClick={() => void handleSelectTab(a.id)}
                >
                  {a.kind === 'material' && <FileText size={14} />}
                  {a.kind === 'session' && <HelpCircle size={14} />}
                  {a.kind === 'explanation' && <BookOpen size={14} />}
                  {a.kind === 'progress' && <CheckCircle2 size={14} />}
                  <span>{a.title}</span>
                </button>
                <button
                  type="button"
                  className="tab-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(a.id);
                  }}
                  aria-label={`Close ${a.title}`}
                  title="Close tab"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="tabs-quick-action">
            <button
              className="learn-button subtle small"
              onClick={() => setShowUpload(true)}
            >
              <Plus size={13} /> Add material
            </button>
          </div>
        </div>

        {/* Working Area Canvas View */}
        <div className="agent-view-canvas">
          {activeArtifact ? (
            activeArtifact.kind === 'material' ? (
              <MaterialView
                materialId={activeArtifact.materialId}
                initialPage={activeArtifact.page}
                onStartPractice={handleStartPracticeFromMaterial}
              />
            ) : activeArtifact.kind === 'session' ? (
              <SessionView
                sessionId={activeArtifact.sessionId}
                onCompleted={(s) => {
                  setSessions((prev) => [
                    s,
                    ...prev.filter((x) => x.id !== s.id),
                  ]);
                }}
              />
            ) : activeArtifact.kind === 'explanation' ? (
              <ExplanationView
                title={activeArtifact.title}
                text={activeArtifact.text}
                citations={activeArtifact.citations}
                onOpenCitation={handleOpenCitation}
              />
            ) : activeArtifact.kind === 'progress' ? (
              <ProgressView sessions={sessions} />
            ) : null
          ) : (
            <HomeView
              firstName={fullName?.trim().split(/\s+/)[0] || 'friend'}
              loading={libraryLoading}
              error={libraryError}
              busy={busy}
              onRetry={() => setLibraryRevision((value) => value + 1)}
              materials={materials}
              sessions={sessions}
              onOpenMaterial={handleOpenMaterial}
              onOpenSession={handleOpenSession}
              onUploadClick={() => setShowUpload(true)}
              onPromptClick={(p) => {
                setMobileTab('chat');
                void handleSendMessage(p);
              }}
            />
          )}
        </div>
      </main>

      {/* Upload Modal */}
      {showUpload && (
        <MaterialUpload
          onClose={() => setShowUpload(false)}
          onSaved={(newMat) => {
            setShowUpload(false);
            setMaterials((prev) => [newMat, ...prev]);
            handleOpenMaterial(newMat);
          }}
        />
      )}
    </div>
  );
}

export default AgentWorkspace;
