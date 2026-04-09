import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState, useRef, useEffect, useContext, useCallback } from "react";
import { AuthContext } from "../AuthContext";
import {
  askQuestionStream, uploadDocument, fetchUserLibrary, fetchUserChats,
  createChatSession, fetchChatHistory, renameChatSession, deleteChatSession, deleteDocument,
} from "../api";
import './ChatBox.css';

/* ══════════════════════════════════════════════════
   Toast component
   ══════════════════════════════════════════════════ */
function Toast({ toasts, onRemove }) {
  return (
    <div className="hk-toasts">
      {toasts.map(t => (
        <div key={t.id} className={`hk-toast ${t.type}`}>
          <span className="hk-toast-icon">
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span className="hk-toast-msg">{t.message}</span>
          <button className="hk-toast-close" onClick={() => onRemove(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Dialog component  (confirm + prompt)
   ══════════════════════════════════════════════════ */
function Dialog({ dialog, onClose }) {
  const [inputVal, setInputVal] = useState('');

  useEffect(() => {
    if (dialog?.type === 'prompt') setInputVal(dialog.defaultValue || '');
  }, [dialog]);

  if (!dialog) return null;

  const handleConfirm = () => {
    dialog.resolve(dialog.type === 'prompt' ? (inputVal.trim() || null) : true);
    onClose();
  };
  const handleCancel = () => {
    dialog.resolve(dialog.type === 'prompt' ? null : false);
    onClose();
  };
  const handleKey = (e) => {
    if (e.key === 'Enter' && dialog.type === 'prompt') { e.preventDefault(); handleConfirm(); }
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <div className="hk-overlay" onClick={handleCancel} onKeyDown={handleKey}>
      <div className="hk-modal" onClick={e => e.stopPropagation()}>
        {dialog.type === 'confirm' && (
          <div className="hk-modal-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </div>
        )}
        <p className="hk-modal-title">
          {dialog.title || (dialog.type === 'confirm' ? 'Confirm Action' : 'Rename')}
        </p>
        <p className="hk-modal-msg">{dialog.message}</p>
        {dialog.type === 'prompt' && (
          <input
            className="hk-modal-input"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKey}
            placeholder={dialog.placeholder || ''}
            autoFocus
          />
        )}
        <div className="hk-modal-actions">
          <button className="hk-modal-cancel" onClick={handleCancel}>Cancel</button>
          <button
            className={`hk-modal-confirm${dialog.type === 'prompt' ? ' safe' : ''}`}
            onClick={handleConfirm}
          >
            {dialog.type === 'prompt' ? 'Save' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SVG icon helpers
   ══════════════════════════════════════════════════ */
const Icon = {
  bolt: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  boltPurple: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a89fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  user: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  menu: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  plus: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  send: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  image: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  doc: (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  edit: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  trash: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  ),
  clip: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  ),
  logout: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  check: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  copy: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  spinner: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin .8s linear infinite' }}>
      <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  ),
};

/* ══════════════════════════════════════════════════
   ChatBox — main component
   ══════════════════════════════════════════════════ */
function ChatBox() {
  const { logout } = useContext(AuthContext);

  // ── Core state ────────────────────────────────────
  const [question,      setQuestion]      = useState('');
  const [messages,      setMessages]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [isStrict,      setIsStrict]      = useState(true);
  const [attachedImage, setAttachedImage] = useState(null);

  // ── Data state ────────────────────────────────────
  const [libraryFiles,  setLibraryFiles]  = useState([]);
  const [chatSessions,  setChatSessions]  = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [activeMenu,    setActiveMenu]    = useState(null);

  // ── UI state ──────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDragging,       setIsDragging]       = useState(false);
  const [copiedId,         setCopiedId]         = useState(null);
  const [initialLoading,   setInitialLoading]   = useState(true);

  // ── Toast + dialog ────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);

  // ── Refs ──────────────────────────────────────────
  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);

  /* ── Helpers ─────────────────────────────────────── */
  const showToast = useCallback((message, type = 'info', ms = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ms);
  }, []);

  const removeToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const showDialog = useCallback((type, config) =>
    new Promise(resolve => setDialog({ type, resolve, ...config })), []);

  const closeDialog = useCallback(() => setDialog(null), []);

  /* ── File icon ───────────────────────────────────── */
  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['csv', 'xlsx', 'xls'].includes(ext)) return '📊';
    if (['txt', 'md'].includes(ext)) return '📝';
    return '📁';
  };

  /* ── Session helpers ─────────────────────────────── */
  async function handleSelectSession(session) {
    setActiveSession(session);
    setMessages([]);
    try {
      const history = await fetchChatHistory(session.id);
      setMessages(history);
    } catch {
      showToast('Could not load chat history.', 'error');
    }
  }

  async function handleStartNewChat(filename = null) {
    try {
      const newSession = await createChatSession(filename);
      setChatSessions(prev => [newSession, ...prev]);
      setActiveSession(newSession);
      setMessages([]);
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch {
      showToast('Failed to create new chat.', 'error');
    }
  }

  /* ── File upload ─────────────────────────────────── */
  async function handleFileUpload(eventOrFile) {
    const file = eventOrFile?.target?.files?.[0] ?? eventOrFile;
    if (!file) return;

    const allowed = ['.pdf', '.csv', '.xlsx', '.xls', '.txt', '.md'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      showToast(`Unsupported type. Allowed: ${allowed.join(', ')}`, 'error');
      return;
    }

    setUploading(true);
    try {
      await uploadDocument(file);
      if (!libraryFiles.includes(file.name)) setLibraryFiles(prev => [file.name, ...prev]);
      await handleStartNewChat(file.name);
      showToast(`"${file.name}" uploaded.`, 'success');
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    } finally {
      setUploading(false);
      if (eventOrFile?.target) eventOrFile.target.value = null;
    }
  }

  const handleImageAttach = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5 MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setAttachedImage(reader.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  /* ── Drag & drop ─────────────────────────────────── */
  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); };
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setAttachedImage(reader.result);
      reader.readAsDataURL(file);
    } else {
      await handleFileUpload(file);
    }
  };

  /* ── Ask ─────────────────────────────────────────── */
  async function handleAsk(overrideText = null) {
    const text   = overrideText || question;
    const imgSnap = attachedImage;
    if (!text.trim() && !imgSnap) return;
    if (!activeSession) return;

    const userContent  = imgSnap ? `![Attached Image](${imgSnap})\n\n${text}` : text;
    const chatHistory  = messages
      .filter(m => m.role === 'user' || m.role === 'ai')
      .map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, { role: 'user', content: userContent }]);
    setQuestion('');
    setAttachedImage(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);

    try {
      setMessages(prev => [...prev, { role: 'ai', content: '' }]);
      await askQuestionStream(
        text, chatHistory,
        (chunk) => setMessages(prev => {
          const arr  = [...prev];
          const last = arr.length - 1;
          arr[last]  = { ...arr[last], content: arr[last].content + chunk };
          return arr;
        }),
        activeSession.document_filename, activeSession.id, isStrict, imgSnap,
      );
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: `**Error:** ${err.message}` }]);
      showToast('Request failed.', 'error');
    }
    setLoading(false);
  }

  /* ── Copy ────────────────────────────────────────── */
  const handleCopy = useCallback((text, id) => {
    const clean = text.replace(/\[CONFIDENCE: (HIGH|MEDIUM|LOW|EXTERNAL)\]/g, '').trim();
    navigator.clipboard.writeText(clean).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1800);
    });
  }, []);

  /* ── Rename / Delete ─────────────────────────────── */
  const handleRenameChat = async (id, currentTitle, e) => {
    e.stopPropagation();
    setActiveMenu(null);
    const newTitle = await showDialog('prompt', {
      title:       'Rename Chat',
      message:     'Enter a new name for this chat.',
      defaultValue: currentTitle,
      placeholder: 'Chat name…',
    });
    if (!newTitle) return;
    try {
      await renameChatSession(id, newTitle);
      setChatSessions(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
      if (activeSession?.id === id) setActiveSession(prev => ({ ...prev, title: newTitle }));
    } catch { showToast('Failed to rename chat.', 'error'); }
  };

  const handleDeleteChat = async (id, e) => {
    e.stopPropagation();
    setActiveMenu(null);
    const ok = await showDialog('confirm', { message: 'This chat will be permanently deleted.' });
    if (!ok) return;
    try {
      await deleteChatSession(id);
      setChatSessions(prev => prev.filter(c => c.id !== id));
      if (activeSession?.id === id) { setActiveSession(null); setMessages([]); }
      showToast('Chat deleted.', 'success');
    } catch { showToast('Failed to delete chat.', 'error'); }
  };

  const handleDeleteDocument = async (filename, e) => {
    e.stopPropagation();
    setActiveMenu(null);
    const ok = await showDialog('confirm', { message: `Remove "${filename}" from your library?` });
    if (!ok) return;
    try {
      await deleteDocument(filename);
      setLibraryFiles(prev => prev.filter(f => f !== filename));
      showToast(`"${filename}" removed.`, 'success');
    } catch { showToast('Failed to remove document.', 'error'); }
  };

  /* ── Textarea auto-resize ────────────────────────── */
  const adjustHeight = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  };

  /* ── Render message content ──────────────────────── */
  const renderMessageContent = (content, msgIndex, isStreaming) => {
    let text      = content;
    let badge     = null;
    let badgeClass = '';

    if (text.includes('[CONFIDENCE: HIGH]'))     { badge = 'HIGH';     badgeClass = 'high';     text = text.replace('[CONFIDENCE: HIGH]', '');     }
    else if (text.includes('[CONFIDENCE: MEDIUM]')) { badge = 'MEDIUM';   badgeClass = 'medium';   text = text.replace('[CONFIDENCE: MEDIUM]', '');   }
    else if (text.includes('[CONFIDENCE: LOW]'))    { badge = 'LOW';      badgeClass = 'low';      text = text.replace('[CONFIDENCE: LOW]', '');      }
    else if (text.includes('[CONFIDENCE: EXTERNAL]')){ badge = 'EXTERNAL'; badgeClass = 'external'; text = text.replace('[CONFIDENCE: EXTERNAL]', ''); }

    text = text.replace(/\[Source: .*?, Page: (\d+)\]/g, '`[Pg. $1]`');
    const isEmpty = isStreaming && !text.trim();

    return (
      <>
        {badge && (
          <div style={{ marginBottom: 10 }}>
            <span className={`hk-badge ${badgeClass}`}>
              <span className="hk-badge-dot" />
              {badge}
            </span>
          </div>
        )}

        {isEmpty ? (
          <div className="hk-typing"><span /><span /><span /></div>
        ) : (
          <div className="hk-md">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <div style={{ borderRadius: 10, overflow: 'hidden', margin: '10px 0', boxShadow: '0 4px 14px rgba(0,0,0,.38)' }}>
                      <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code {...props}>{children}</code>
                  );
                },
              }}
            >{text}</ReactMarkdown>
            {isStreaming && <span className="hk-cursor" aria-hidden="true" />}
          </div>
        )}

        {!isStreaming && (
          <button
            className={`hk-copy-btn${copiedId === msgIndex ? ' copied' : ''}`}
            onClick={() => handleCopy(content, msgIndex)}
            title="Copy"
          >
            {copiedId === msgIndex ? <>{Icon.check} Copied</> : <>{Icon.copy} Copy</>}
          </button>
        )}
      </>
    );
  };

  /* ── Effects ─────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const [libData, chatsData] = await Promise.all([fetchUserLibrary(), fetchUserChats()]);
        setLibraryFiles(libData.files);
        setChatSessions(chatsData);
        if (chatsData.length > 0) await handleSelectSession(chatsData[0]);
      } catch {
        showToast('Failed to load data. Please refresh.', 'error');
      } finally {
        setInitialLoading(false);
      }
    })();
  }, []); // eslint-disable-line

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest('.hk-sb-dots') && !e.target.closest('.hk-dropdown'))
        setActiveMenu(null);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault(); handleStartNewChat(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault(); setSidebarCollapsed(p => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line

  const canSend = !!(( question.trim() || attachedImage) && activeSession && !loading && !uploading);

  /* ══════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════ */
  return (
    <>
      <Toast toasts={toasts} onRemove={removeToast} />
      <Dialog dialog={dialog} onClose={closeDialog} />

      <div
        className="hk-app"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* ── Sidebar ───────────────────────────────── */}
        <div className={`hk-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>

          <div className="hk-sb-brand">
            <div className="hk-sb-icon">{Icon.bolt}</div>
            <div className="hk-sb-name">Hal<span>kill</span></div>
          </div>

          <button className="hk-new-chat" onClick={() => handleStartNewChat(null)}>
            <span className="hk-nc-left">{Icon.plus} New Chat</span>
            <kbd className="hk-kbd">⌃K</kbd>
          </button>

          {/* Recent chats */}
          <div className="hk-sb-chats">
            <p className="hk-sb-section">Recent Chats</p>
            <div className="hk-sb-list">
              {initialLoading
                ? [1, 2, 3].map(i => (
                    <div key={i} style={{ padding: '9px 9px' }}>
                      <div className="hk-shimmer" style={{ width: `${55 + i * 12}%` }} />
                    </div>
                  ))
                : chatSessions.map(session => (
                    <button
                      key={`c-${session.id}`}
                      className={`hk-sb-item${activeSession?.id === session.id ? ' active' : ''}`}
                      onClick={() => handleSelectSession(session)}
                    >
                      <span className="hk-sb-item-text">
                        <span style={{ marginRight: 7, opacity: .5, fontSize: '.77rem' }}>💬</span>
                        {session.title}
                      </span>
                      <button
                        className="hk-sb-dots"
                        onClick={e => { e.stopPropagation(); setActiveMenu(`c-${session.id}`); }}
                        title="Options"
                      >⋯</button>
                      {activeMenu === `c-${session.id}` && (
                        <div className="hk-dropdown">
                          <button className="hk-dd-item" onClick={e => handleRenameChat(session.id, session.title, e)}>
                            {Icon.edit} Rename
                          </button>
                          <button className="hk-dd-item danger" onClick={e => handleDeleteChat(session.id, e)}>
                            {Icon.trash} Delete
                          </button>
                        </div>
                      )}
                    </button>
                  ))
              }
            </div>
          </div>

          {/* Library */}
          <div className="hk-sb-library">
            <p className="hk-sb-section">My Library</p>
            <div className="hk-sb-list">
              {libraryFiles.map((file, idx) => (
                <button
                  key={`f-${idx}`}
                  className="hk-sb-item"
                  onClick={() => handleStartNewChat(file)}
                >
                  <span className="hk-sb-item-text">
                    <span style={{ marginRight: 7, opacity: .6, fontSize: '.77rem' }}>{getFileIcon(file)}</span>
                    {file}
                  </span>
                  <button
                    className="hk-sb-dots"
                    onClick={e => { e.stopPropagation(); setActiveMenu(`f-${idx}`); }}
                    title="Options"
                  >⋯</button>
                  {activeMenu === `f-${idx}` && (
                    <div className="hk-dropdown">
                      <button className="hk-dd-item danger" onClick={e => handleDeleteDocument(file, e)}>
                        {Icon.trash} Remove
                      </button>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Upload */}
          <div className="hk-sb-upload">
            <input
              type="file" id="file-upload"
              accept=".pdf,.csv,.xlsx,.xls,.txt,.md"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              className="hk-upload-btn"
              onClick={() => document.getElementById('file-upload').click()}
              disabled={uploading || loading}
              title="Upload document"
            >
              {Icon.clip}
              {uploading ? 'Uploading…' : 'Upload File'}
            </button>
          </div>

        </div>

        {/* ── Main ──────────────────────────────────── */}
        <div className="hk-main">

          {/* Drag overlay */}
          {isDragging && (
            <div className="hk-drop-overlay">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#a89fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <div className="hk-drop-text">Drop file to upload</div>
              <div className="hk-drop-sub">PDF, CSV, Excel, TXT, Markdown · or image to attach</div>
            </div>
          )}

          {/* Topbar */}
          <div className="hk-topbar">
            <button
              className="hk-collapse-btn"
              onClick={() => setSidebarCollapsed(p => !p)}
              title="Toggle sidebar (Ctrl+B)"
            >
              {Icon.menu}
            </button>

            <div className="hk-topbar-info">
              <h1 className="hk-topbar-title">Halkill Engine</h1>
              <p className="hk-topbar-sub">
                {activeSession?.document_filename ? (
                  <><span>{Icon.doc}</span><span className="hk-doc-pill">{activeSession.document_filename}</span></>
                ) : (
                  <span style={{ opacity: .5 }}>No document context</span>
                )}
              </p>
            </div>

            <div className="hk-topbar-right">
              {activeSession?.document_filename && (
                <div className="hk-mode-group">
                  <span className={`hk-mode-label${!isStrict ? ' on' : ''}`}>Hybrid</span>
                  <label className="hk-toggle" title={isStrict ? 'Strict RAG' : 'Hybrid mode'}>
                    <input type="checkbox" checked={isStrict} onChange={() => setIsStrict(p => !p)} />
                    <div className="hk-toggle-track" />
                    <div className="hk-toggle-knob" />
                  </label>
                  <span className={`hk-mode-label${isStrict ? ' on' : ''}`}>Strict</span>
                </div>
              )}
              <button className="hk-sign-out" onClick={logout} title="Sign out">
                {Icon.logout} Sign out
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="hk-messages">
            <div className="hk-messages-inner">

              {messages.length === 0 && !loading && (
                <div className="hk-welcome">
                  <div className="hk-welcome-logo">{Icon.bolt}</div>
                  <h2 className="hk-welcome-h">What can I help with?</h2>
                  <p className="hk-welcome-p">
                    {activeSession?.document_filename
                      ? `Context: "${activeSession.document_filename}"`
                      : 'Start a new chat or upload a document to begin.'}
                  </p>

                  <div className="hk-suggestions">
                    {[
                      { icon: '📊', title: 'Analyze Document',  desc: 'Extract key points & insights.',          q: 'Give me a comprehensive summary of this document.' },
                      { icon: '🔍', title: 'Deep Dive',          desc: 'Explore a specific topic in depth.',      q: 'What are the most important topics covered?' },
                      { icon: '👁️', title: 'Vision Analysis',    desc: 'Attach an image for visual review.',     q: 'Describe and analyze this image in detail.' },
                    ].map((s, i) => (
                      <div key={i} className="hk-card" onClick={() => handleAsk(s.q)}>
                        <div className="hk-card-icon">{s.icon}</div>
                        <div className="hk-card-title">{s.title}</div>
                        <div className="hk-card-desc">{s.desc}</div>
                      </div>
                    ))}
                  </div>

                  <div className="hk-shortcuts">
                    {[
                      { keys: ['⌃K'], label: 'New chat'       },
                      { keys: ['⌃B'], label: 'Toggle sidebar' },
                      { keys: ['↵'],  label: 'Send'           },
                      { keys: ['⇧↵'], label: 'New line'       },
                    ].map((s, i) => (
                      <div key={i} className="hk-shortcut">
                        {s.keys.map((k, j) => <kbd key={j}>{k}</kbd>)}
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, index) => {
                const isLastMsg   = index === messages.length - 1;
                const isStreaming = loading && isLastMsg && msg.role === 'ai';
                return (
                  <div key={index} className={`hk-msg-wrap ${msg.role}`}>
                    <div className={`hk-avatar ${msg.role}`}>
                      {msg.role === 'ai' ? Icon.boltPurple : Icon.user}
                    </div>
                    <div className={`hk-bubble ${msg.role}`}>
                      {msg.role === 'user' ? (
                        <div className="hk-md">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : renderMessageContent(msg.content, index, isStreaming)}
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="hk-input-area">
            <div className="hk-input-inner">
              {attachedImage && (
                <div className="hk-img-preview">
                  <img src={attachedImage} alt="Attachment" />
                  <button className="hk-remove-img" onClick={() => setAttachedImage(null)} title="Remove">×</button>
                </div>
              )}

              <div className="hk-input-box">
                <input
                  type="file" id="image-upload" accept="image/*"
                  style={{ display: 'none' }} onChange={handleImageAttach}
                />
                <button
                  className="hk-attach"
                  onClick={() => document.getElementById('image-upload').click()}
                  title="Attach image"
                >
                  {Icon.image}
                </button>

                <textarea
                  ref={textareaRef}
                  className="hk-textarea"
                  rows={1}
                  value={question}
                  onChange={e => { setQuestion(e.target.value); adjustHeight(); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (canSend) handleAsk();
                    }
                  }}
                  placeholder={
                    activeSession
                      ? 'Ask a question… (Shift+Enter for new line)'
                      : 'Select or create a chat to begin…'
                  }
                  disabled={!activeSession}
                />

                <button
                  className={`hk-send${!canSend ? ' idle' : ''}`}
                  onClick={() => handleAsk()}
                  disabled={!canSend}
                  title="Send (Enter)"
                >
                  {loading ? Icon.spinner : <>{Icon.send} Send</>}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export default ChatBox;