import ReactMarkdown from 'react-markdown';
import { AssessmentView, ResearchView } from './AssessmentView';
import type { AssessmentDraftCache } from './useAssessmentDraft';
import type { ResearchStatus } from '../../../supabase/functions/_shared/learning-workflows';
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
  type WorkspaceTool,
  type WorkspaceEvent,
  type WorkspaceMessage,
  type WorkspaceSnapshot,
  type WorkspaceThread,
  emptyWorkspace,
  mergeWorkspaceMessages,
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
  const operationRef = useRef(false);
  const assessmentDrafts = useRef<AssessmentDraftCache>(new Map());
  useEffect(() => { assessmentDrafts.current.clear(); },[user?.id]);
  const [research,setResearch] = useState<ResearchStatus | undefined>();
  const [actionError,setActionError] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const loadedUserRef = useRef<string | null>(null);
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
  }, [messages, streamingText, runningActions, busy]);

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
    if (loadedUserRef.current !== user.id) {
      loadedUserRef.current = user.id;
      setMessages([]);
      setThread({ id: 'local', state: emptyWorkspace(), updated_at: new Date().toISOString() });
    }
    setWorkspaceLoading(true);
    setWorkspaceError('');
    // Load workspace agent state
    loadWorkspaceSnapshot()
      .then((snap) => {
        if (cancelled) return;
        setResearch(snap.research);
        setSnapshot(snap);
        setThread(snap.thread);
        setMessages(current => mergeWorkspaceMessages(current, snap.messages));
      })
      .catch(() => {
        if (!cancelled) setWorkspaceError('Your saved conversation could not load. Please retry.');
      })
      .finally(() => { if (!cancelled) setWorkspaceLoading(false); });

    return () => {
      cancelled = true;
    };
  }, [user?.id, workspaceRevision]);

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
      if (event.thread.state.activeId) setMobileTab('workspace');
    } else if (event.type === 'done') {
      if (event.snapshot) {
        setResearch(event.snapshot.research);
        setSnapshot(event.snapshot);
        setThread(event.snapshot.thread);
        setMessages(current => mergeWorkspaceMessages(current, event.snapshot.messages));
      }
      setStreamingText('');
      setRunningActions([]);
    } else if (event.type === 'error') {
      setActionError(event.error);
      setStreamingText('');
      setRunningActions([]);
    }
  };

  const handleSendMessage = async (textToSend?: string, signal?: AbortSignal) => {
    const text = (textToSend ?? input).trim();
    if (!text || operationRef.current || workspaceLoading || workspaceError) return;
    operationRef.current = true;
    setActionError('');

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
    tempUserMsg.request_id = tempUserMsg.id;
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const snap = await sendWorkspaceMessage(text, handleEvent, signal, tempUserMsg.id);
      if (snap) {
        setResearch(snap.research);
        setSnapshot(snap);
        setThread(snap.thread);
        setMessages(current => mergeWorkspaceMessages(current, snap.messages));
        return [...snap.messages].reverse().find(message => message.role === 'assistant' && message.request_id === tempUserMsg.id)?.content || null;
      }
    } catch (err) {
      if (signal?.aborted) return null;
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
      operationRef.current = false;
      setBusy(false);
      setStreamingText('');
      setRunningActions([]);
    }
  };

  const voice = useVoice({ onMessage: (text, signal) => handleSendMessage(text, signal), busy: busy || workspaceLoading || !!workspaceError });

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const runTool = async (tool: WorkspaceTool) => {
    if (operationRef.current || workspaceLoading || workspaceError) throw new Error('Please wait for the current action to finish.');
    operationRef.current = true; setBusy(true); setActionError('');
    try { await executeWorkspaceTool(tool,handleEvent); }
    catch(e) { setActionError(e instanceof Error ? e.message : 'Could not finish. Please retry.'); throw e; }
    finally { operationRef.current=false;setBusy(false);setStreamingText('');setRunningActions([]); }
  };
  const launchTool = (tool: WorkspaceTool) => { void runTool(tool).catch(()=>{}); };

  const handleSelectTab = async (artifactId: string | null) => {
    if (operationRef.current) return;
    operationRef.current=true;setBusy(true);setActionError('');
    try { await activateWorkspaceArtifact(artifactId,handleEvent); }
    catch(e) {setActionError(e instanceof Error ? e.message : 'Could not switch tabs.');}
    finally {operationRef.current=false;setBusy(false);}
  };

  const handleCloseTab = (artifactId: string) => launchTool({name:'close_artifact',args:{artifactId}});

  // Refresh completed background work on return and while the dashboard is open.
  // A response started before a foreground action must never overwrite that action.
  useEffect(() => {
    if (!user || workspaceLoading || workspaceError) return;
    let cancelled=false;
    const refresh=async()=>{
      if(operationRef.current || document.visibilityState==='hidden')return;
      const before=thread.updated_at;
      try {const snap=await loadWorkspaceSnapshot();if(cancelled || operationRef.current)return;
        setThread(current=>current.updated_at===before ? snap.thread : current);
        setResearch(snap.research);
        setMessages(current=>mergeWorkspaceMessages(current,snap.messages));
      }catch{/* Existing saved work stays visible; foreground retry remains available. */}
    };
    const timer=window.setInterval(()=>void refresh(),30000);
    const visible=()=>{void refresh();};window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
    return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
  },[user?.id,workspaceLoading,workspaceError,thread.updated_at]);

  const handlePlanStepClick = (step: StudyPlanStep) => launchTool({name:step.kind === 'learn' ? 'explain' : 'start_practice',args:{materialId:step.materialId,topic:step.topic,mode:step.kind === 'checkpoint' ? 'checkpoint' : 'practice'}});
  const handleOpenMaterial = (m: Material) => launchTool({name:'open_material',args:{materialId:m.id}});
  const handleOpenSession = (sessionId:string) => launchTool({name:'resume_session',args:{sessionId}});
  const handleStartPracticeFromMaterial = (material:Material,topic:string) => launchTool({name:'open_assessment',args:{goal:`Study ${topic}`,materialId:material.id,topic}});
  const handleOpenCitation = (c:Citation) => launchTool({name:'open_material',args:{materialId:c.materialId,page:c.page}});

  // Active artifact
  const artifacts = thread.state.artifacts || [];
  const activeArtifact = artifacts.find((a) => a.id === thread.state.activeId);

  return (
    <div
      className={`learn agent-workspace-container ${activeArtifact ? 'has-artifact' : 'is-dashboard'} ${messages.length || busy ? 'has-conversation' : 'is-welcome'}`}
      data-mobile-view={mobileTab}
    >
      <header className="agent-app-header">
        <Link className="learn-brand" to="/" aria-label="Curve dashboard">
          <CurveMark />
          <span className="rail-brand-name">curve</span>
        </Link>
        <nav aria-label="Workspace">
          <Link className="active" aria-current="page" to="/" title="Dashboard">
            <Home size={20} /><span>Dashboard</span>
          </Link>
          <Link to="/library" title="Library"><BookOpen size={20} /><span>Library</span></Link>
          <Link to="/courses" title="Courses"><FileText size={20} /><span>Courses</span></Link>
          <Link to="/progress" title="Progress"><TrendingUp size={20} /><span>Progress</span></Link>
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

      {/* Conversation and voice assistant */}
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

        <div className="assistant-greeting">
          <div><h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {fullName?.trim().split(/\s+/)[0] || 'friend'}.</h1><p>Your learning, a little more connected.</p></div>
          <time dateTime={new Date().toISOString()}>{new Date().toLocaleDateString(undefined, {weekday:'long', month:'short', day:'numeric'})}<span>Your study workspace</span></time>
        </div>
        {/* Living Curve Orb Stage */}
        <section
          className={`orb-hero-stage state-${voice.state}`}
          aria-label="Curve Voice Orb"
        >
          <CurveOrb
            state={voice.state}
            isMuted={voice.isMuted}
            size={156}
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
                  ? 'Curve is ready'
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
                ? 'Waiting for your instructions or voice command'
                : voice.state === 'connecting'
                  ? 'Connecting voice…'
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
        <div className="chat-messages-container" role="log" aria-label="Study conversation" aria-live="polite">
          {actionError && <p role="alert" className="learn-error">{actionError}</p>}
          {workspaceLoading && <p role="status">Loading your conversation…</p>}
          {voice.error && <p role="alert" className="learn-error">{voice.error}</p>}
          {workspaceError && (
            <div role="alert" className="learn-error">
              {workspaceError}{' '}
              <button type="button" onClick={() => setWorkspaceRevision(value => value + 1)}>Retry</button>
            </div>
          )}
          {!workspaceLoading && !workspaceError && messages.length === 0 && !streamingText && (
            <div className="chat-empty-hint">
              <p>
                Tell Curve what you want to study, ask a question, or talk
                through your materials.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`message-bubble ${m.role}`}>
              <div className="message-content"><ReactMarkdown>{m.content}</ReactMarkdown></div>
              <span className="message-time">
                {new Date(m.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}

          {busy && !streamingText && <div className="message-bubble assistant typing-bubble" role="status" aria-label="Curve is thinking"><span className="typing-dots" aria-hidden="true"><i/><i/><i/></span><span>Curve is {runningActions.length ? 'preparing your workspace' : 'thinking'}…</span></div>}

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
              <div className="message-content"><ReactMarkdown>{streamingText}</ReactMarkdown></div>
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
                    'My exam is tomorrow. Assess me and help me revise.'
                  )
                }
              >
                Exam tomorrow
              </button>
              <button
                className="chip-btn"
                onClick={() =>
                  void handleSendMessage('I want to submit my latest exam results and fix my mistakes.')
                }
              >
                Review exam results
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
                  : 'Ask Curve or give instructions…'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy || workspaceLoading || !!workspaceError}
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
              disabled={!input.trim() || busy || workspaceLoading || !!workspaceError}
              title="Send"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </aside>

      {/* Study activity and artifact workspace */}
      <main className="agent-working-pane">
        <section className="workspace-mode-bar" aria-label="Study modes">
          <button className="learn-button subtle small" disabled={busy || workspaceLoading} onClick={()=>launchTool({name:'open_assessment',args:{mode:'exam',goal:'Prepare for tomorrow’s exam based on what I already know.'}})}>Exam tomorrow</button>
          <button className="learn-button subtle small" disabled={busy || workspaceLoading} onClick={()=>launchTool({name:'open_exam_results',args:{goal:'Review my latest exam and fix the gaps.'}})}>Add exam results</button>
          <label className="research-toggle"><input type="checkbox" checked={research?.enabled ?? true} disabled={busy || !research} onChange={e=>launchTool({name:'set_daily_research',args:{enabled:e.target.checked}})}/> Daily research</label>
          <span className="research-status" role="status">{research?.enabled ? research.status === 'ready' ? 'Research ready in your tabs' : research.status === 'running' ? 'Research in progress' : research.status === 'failed' ? 'Research will retry' : 'Research scheduled' : 'Research paused'}</span>
        </section>
        {research?.error && <p className="research-notice">{research.error}</p>}
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
              disabled={busy}
              onClick={() => void handleSelectTab(null)}
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
                  {(a.kind === 'assessment' || a.kind === 'research') && <Sparkles size={14} />}
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
            activeArtifact.kind === 'assessment' ? (
              <AssessmentView drafts={assessmentDrafts.current} revision={thread.updated_at} key={activeArtifact.id} artifact={activeArtifact} materials={materials} busy={busy} onAction={runTool}/>
            ) : activeArtifact.kind === 'research' ? (
              <ResearchView artifact={activeArtifact} busy={busy} reviewed={!!thread.state.reviewedArtifactIds?.includes(activeArtifact.id)} onNext={()=>launchTool({name:'review_artifact',args:{artifactId:activeArtifact.id}})}/>
            ) : activeArtifact.kind === 'material' ? (
              <MaterialView
                materialId={activeArtifact.materialId}
                initialPage={activeArtifact.page}
                onSaved={() => setLibraryRevision(r => r + 1)}
                onStartPractice={handleStartPracticeFromMaterial}
              />
            ) : activeArtifact.kind === 'session' ? (
              <SessionView
                revision={thread.updated_at}
                key={activeArtifact.sessionId}
                sessionId={activeArtifact.sessionId}
                onCompleted={(s) => {
                  void handleSendMessage('I finished my independent check. Review my saved results and help me with the remaining gaps.');
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
