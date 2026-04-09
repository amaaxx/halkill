import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState, useRef, useEffect, useContext } from "react";
import { AuthContext } from "../AuthContext";
import { 
  askQuestionStream, uploadDocument, fetchUserLibrary, fetchUserChats, 
  createChatSession, fetchChatHistory, renameChatSession, deleteChatSession, deleteDocument 
} from "../api";

const CHATBOX_STYLES = `
  /* ── Layout ─────────────────── */
  .hk-app {
    display: flex;
    height: 100vh;
    width: 100vw;
    background: #0a0a0f;
    color: #e8e8f0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
  }

  /* ── Sidebar ─────────────────── */
  .hk-sidebar {
    width: 260px;
    min-width: 260px;
    background: #0d0d18;
    border-right: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 18px 12px;
    position: relative;
    z-index: 10;
  }

  .hk-sidebar-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    margin-bottom: 16px;
  }

  .hk-brand-icon {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: linear-gradient(135deg, #6c5ce7, #9d8fff);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 14px rgba(124,108,252,0.35);
    flex-shrink: 0;
  }

  .hk-brand-name {
    font-size: 0.98rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: #e8e8f0;
  }
  .hk-brand-name span { color: #7c6cfc; }

  .hk-new-chat-btn {
    width: 100%;
    padding: 10px 14px;
    background: rgba(124,108,252,0.08);
    color: #a89fff;
    border: 1px solid rgba(124,108,252,0.2);
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 500;
    font-size: 0.85rem;
    font-family: inherit;
    transition: all 0.18s ease;
    margin-bottom: 20px;
    letter-spacing: 0.01em;
  }
  .hk-new-chat-btn:hover {
    background: rgba(124,108,252,0.15);
    border-color: rgba(124,108,252,0.35);
    color: #c0b5ff;
    box-shadow: 0 0 16px rgba(124,108,252,0.12);
  }

  .hk-section-title {
    font-size: 0.67rem;
    color: #5a5a72;
    font-weight: 600;
    margin: 0 0 8px 6px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .hk-sidebar-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .hk-chats-container {
    flex: 1;
    min-height: 0;
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
  }

  .hk-library-container {
    max-height: 32%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .hk-list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 10px;
    border-radius: 8px;
    cursor: pointer;
    color: #6a6a85;
    transition: all 0.15s ease;
    position: relative;
    border: none;
    font-size: 0.83rem;
    font-family: inherit;
    background: transparent;
    width: 100%;
    text-align: left;
  }
  .hk-list-item:hover {
    background: rgba(255,255,255,0.04);
    color: #a8a8c0;
  }
  .hk-list-item.active {
    background: rgba(124,108,252,0.1);
    color: #c0b8ff;
    border: 1px solid rgba(124,108,252,0.15);
  }

  .hk-item-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hk-dots-btn {
    opacity: 0;
    background: transparent;
    border: none;
    color: #5a5a72;
    cursor: pointer;
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 1rem;
    transition: all 0.15s;
    line-height: 1;
    flex-shrink: 0;
  }
  .hk-list-item:hover .hk-dots-btn { opacity: 1; }
  .hk-dots-btn:hover { background: rgba(255,255,255,0.08); color: #a8a8c0; }

  .hk-dropdown {
    position: absolute;
    right: 8px;
    top: 34px;
    background: #141420;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    z-index: 200;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-width: 130px;
    animation: fade-in 0.12s ease;
  }
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .hk-dropdown-item {
    padding: 9px 14px;
    background: transparent;
    border: none;
    color: #a8a8c0;
    text-align: left;
    cursor: pointer;
    font-size: 0.82rem;
    font-family: inherit;
    transition: background 0.12s;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .hk-dropdown-item:hover { background: rgba(255,255,255,0.05); color: #e8e8f0; }
  .hk-dropdown-item.danger:hover { background: rgba(224,82,82,0.15); color: #ff8080; }

  /* ── Upload Btn ────────────────── */
  .hk-upload-section {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  .hk-upload-btn {
    width: 100%;
    padding: 11px;
    background: rgba(255,255,255,0.04);
    color: #a8a8c0;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.83rem;
    font-family: inherit;
    transition: all 0.18s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
  }
  .hk-upload-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.07);
    border-color: rgba(255,255,255,0.12);
    color: #e8e8f0;
  }
  .hk-upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Main Area ─────────────────── */
  .hk-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: #0a0a0f;
    position: relative;
  }

  /* ── Topbar ─────────────────── */
  .hk-topbar {
    padding: 16px 32px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(10,10,15,0.8);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    position: relative;
    z-index: 5;
  }

  .hk-topbar-title {
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #e8e8f0;
    margin: 0 0 3px 0;
  }

  .hk-topbar-sub {
    margin: 0;
    color: #5a5a72;
    font-size: 0.78rem;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .hk-doc-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(124,108,252,0.08);
    border: 1px solid rgba(124,108,252,0.2);
    border-radius: 100px;
    padding: 1px 8px;
    color: #a89fff;
    font-size: 0.75rem;
    font-weight: 500;
  }

  /* ── Toggle ─────────────────── */
  .hk-toggle-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255,255,255,0.03);
    padding: 7px 14px;
    border-radius: 100px;
    border: 1px solid rgba(255,255,255,0.07);
    gap: 8px;
  }

  .hk-toggle-label {
    font-size: 0.77rem;
    font-weight: 500;
    color: #5a5a72;
    white-space: nowrap;
    transition: color 0.18s;
  }
  .hk-toggle-label.active { color: #a89fff; }

  .hk-toggle {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .hk-toggle input { opacity: 0; width: 0; height: 0; }
  .hk-toggle-track {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    border-radius: 100px;
    background: #2a2a40;
    transition: background 0.25s;
  }
  .hk-toggle input:checked + .hk-toggle-track { background: #7c6cfc; box-shadow: 0 0 10px rgba(124,108,252,0.4); }
  .hk-toggle-knob {
    position: absolute;
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background: white;
    border-radius: 50%;
    transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }
  .hk-toggle input:checked ~ .hk-toggle-knob,
  .hk-toggle input:checked + .hk-toggle-track + .hk-toggle-knob { transform: translateX(16px); }

  /* ── Messages ─────────────────── */
  .hk-messages {
    flex: 1;
    overflow-y: auto;
    padding: 32px 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .hk-messages-inner {
    max-width: 820px;
    width: 100%;
    margin: 0 auto;
    padding: 0 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── Welcome Screen ─────────────── */
  .hk-welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 0 20px;
    text-align: center;
  }

  .hk-welcome-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, #6c5ce7, #9d8fff);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    box-shadow: 0 0 30px rgba(124,108,252,0.3), 0 8px 24px rgba(0,0,0,0.4);
  }

  .hk-welcome-title {
    font-size: 1.6rem;
    font-weight: 600;
    letter-spacing: -0.04em;
    color: #e8e8f0;
    margin: 0 0 8px;
  }

  .hk-welcome-sub {
    color: #5a5a72;
    font-size: 0.88rem;
    margin: 0 0 36px;
  }

  .hk-suggestions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    width: 100%;
    max-width: 680px;
  }

  .hk-suggestion-card {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 18px 16px;
    cursor: pointer;
    transition: all 0.18s ease;
    text-align: left;
  }
  .hk-suggestion-card:hover {
    background: rgba(124,108,252,0.07);
    border-color: rgba(124,108,252,0.25);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.3), 0 0 20px rgba(124,108,252,0.08);
  }

  .hk-suggestion-icon {
    font-size: 1.2rem;
    margin-bottom: 10px;
    display: block;
  }

  .hk-suggestion-title {
    font-size: 0.83rem;
    font-weight: 600;
    color: #c0c0d8;
    margin-bottom: 4px;
  }

  .hk-suggestion-desc {
    font-size: 0.76rem;
    color: #5a5a72;
    line-height: 1.4;
  }

  /* ── Message Bubbles ─────────────── */
  .hk-msg-row {
    display: flex;
    width: 100%;
  }
  .hk-msg-row.user { justify-content: flex-end; }
  .hk-msg-row.ai { justify-content: flex-start; }

  .hk-bubble {
    max-width: 80%;
    padding: 14px 18px;
    border-radius: 16px;
    line-height: 1.65;
    font-size: 0.92rem;
    color: #d8d8ec;
    text-align: left;
  }

  .hk-bubble.user {
    background: rgba(124,108,252,0.12);
    border: 1px solid rgba(124,108,252,0.18);
    border-radius: 16px 16px 4px 16px;
    color: #d0c8ff;
  }

  .hk-bubble.ai {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 4px 16px 16px 16px;
    min-width: 300px;
    position: relative;
  }

  /* ── Confidence Badge ─────────────── */
  .hk-confidence-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.63rem;
    letter-spacing: 0.06em;
    padding: 3px 9px;
    border-radius: 100px;
    font-weight: 700;
    margin-bottom: 10px;
  }
  .hk-badge-high { background: rgba(82,183,136,0.15); color: #52b788; border: 1px solid rgba(82,183,136,0.25); }
  .hk-badge-medium { background: rgba(244,162,97,0.15); color: #f4a261; border: 1px solid rgba(244,162,97,0.25); }
  .hk-badge-low { background: rgba(224,82,82,0.15); color: #e05252; border: 1px solid rgba(224,82,82,0.25); }
  .hk-badge-external { background: rgba(168,159,255,0.15); color: #a89fff; border: 1px solid rgba(168,159,255,0.25); }

  /* ── Copy Btn ────────────────── */
  .hk-copy-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    color: #5a5a72;
    border-radius: 6px;
    padding: 4px 9px;
    cursor: pointer;
    font-size: 0.7rem;
    font-family: inherit;
    transition: all 0.15s;
    opacity: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .hk-bubble.ai:hover .hk-copy-btn { opacity: 1; }
  .hk-copy-btn:hover { background: rgba(255,255,255,0.08); color: #a8a8c0; }

  /* ── Markdown ────────────────── */
  .hk-md p { margin: 0 0 10px; }
  .hk-md p:last-child { margin-bottom: 0; }
  .hk-md ul, .hk-md ol { margin: 0 0 10px; padding-left: 18px; }
  .hk-md li { margin-bottom: 4px; }
  .hk-md h1, .hk-md h2, .hk-md h3 { margin: 12px 0 6px; color: #e8e8f0; }
  .hk-md code { background: rgba(124,108,252,0.1); color: #a89fff; padding: 2px 6px; border-radius: 5px; font-size: 0.84em; font-family: 'JetBrains Mono', monospace; }
  .hk-md img { max-width: 100%; max-height: 280px; border-radius: 10px; margin-bottom: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
  .hk-md blockquote { border-left: 2px solid rgba(124,108,252,0.4); padding-left: 12px; color: #9090a8; margin: 8px 0; }

  /* ── Typing Indicator ────────────── */
  .hk-typing {
    display: flex;
    gap: 4px;
    padding: 4px 0;
    align-items: center;
  }
  .hk-typing span {
    width: 6px;
    height: 6px;
    background: #5a5a72;
    border-radius: 50%;
    animation: blink 1.2s ease-in-out infinite;
  }
  .hk-typing span:nth-child(2) { animation-delay: 0.2s; }
  .hk-typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink {
    0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1); }
  }

  /* ── Input Bar ─────────────────── */
  .hk-input-area {
    padding: 0 32px 28px;
  }

  .hk-input-inner {
    max-width: 820px;
    margin: 0 auto;
  }

  .hk-image-preview {
    margin-bottom: 10px;
    display: inline-block;
    position: relative;
  }
  .hk-image-preview img {
    height: 58px;
    border-radius: 8px;
    border: 2px solid rgba(124,108,252,0.4);
  }
  .hk-remove-img {
    position: absolute; top: -7px; right: -7px;
    background: #e05252; color: white; border: none;
    border-radius: 50%; width: 18px; height: 18px;
    cursor: pointer; font-size: 11px; font-weight: bold;
    display: flex; align-items: center; justify-content: center;
    line-height: 1;
  }

  .hk-input-box {
    display: flex;
    gap: 8px;
    padding: 8px 8px 8px 16px;
    background: rgba(20,20,32,0.9);
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.07);
    box-shadow: 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04);
    align-items: center;
    backdrop-filter: blur(10px);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .hk-input-box:focus-within {
    border-color: rgba(124,108,252,0.3);
    box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 0 3px rgba(124,108,252,0.07), inset 0 1px 0 rgba(255,255,255,0.04);
  }

  .hk-attach-btn {
    background: transparent;
    border: none;
    color: #5a5a72;
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .hk-attach-btn:hover { background: rgba(255,255,255,0.05); color: #a8a8c0; }

  .hk-text-input {
    flex-grow: 1;
    background: transparent;
    border: none;
    color: #d8d8ec;
    outline: none;
    font-size: 0.92rem;
    font-family: inherit;
    padding: 8px 0;
    letter-spacing: 0.01em;
  }
  .hk-text-input::placeholder { color: rgba(144,144,168,0.35); }

  .hk-send-btn {
    padding: 10px 20px;
    background: linear-gradient(135deg, #6c5ce7, #7c6cfc);
    color: #fff;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.83rem;
    font-family: inherit;
    transition: all 0.18s ease;
    flex-shrink: 0;
    box-shadow: 0 2px 12px rgba(124,108,252,0.3);
    letter-spacing: 0.02em;
  }
  .hk-send-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 18px rgba(124,108,252,0.5);
  }
  .hk-send-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
  .hk-send-btn.empty {
    background: rgba(255,255,255,0.04);
    color: #5a5a72;
    box-shadow: none;
  }
`;

function ChatBox() {
  const { logout } = useContext(AuthContext);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isStrict, setIsStrict] = useState(true);
  const [attachedImage, setAttachedImage] = useState(null);

  const [libraryFiles, setLibraryFiles] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [libData, chatsData] = await Promise.all([fetchUserLibrary(), fetchUserChats()]);
        setLibraryFiles(libData.files);
        setChatSessions(chatsData);
        if (chatsData.length > 0) handleSelectSession(chatsData[0]);
      } catch (err) { console.error(err); }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const closeMenu = () => setActiveMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleStartNewChat(null);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['csv', 'xlsx', 'xls'].includes(ext)) return '📊';
    if (['txt', 'md'].includes(ext)) return '📝';
    return '📁';
  };

  async function handleSelectSession(session) {
    setActiveSession(session);
    setMessages([]);
    try {
      const history = await fetchChatHistory(session.id);
      setMessages(history);
    } catch (err) { console.error(err); }
  }

  async function handleStartNewChat(filename = null) {
    try {
      const newSession = await createChatSession(filename);
      setChatSessions(prev => [newSession, ...prev]);
      setActiveSession(newSession);
      setMessages([]);
    } catch (err) { console.error(err); }
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument(file);
      if (!libraryFiles.includes(file.name)) setLibraryFiles((prev) => [file.name, ...prev]);
      await handleStartNewChat(file.name);
    } catch (error) {
      alert("Upload failed: " + error.message);
    } finally {
      setUploading(false);
      event.target.value = null;
    }
  }

  const handleImageAttach = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAttachedImage(reader.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  async function handleAsk(overrideText = null) {
    const textToAsk = overrideText || question;
    const currentImage = attachedImage;
    if (!textToAsk.trim() && !currentImage) return;
    if (!activeSession) return;

    const userDisplayContent = currentImage ? `![Attached Image](${currentImage})\n\n${textToAsk}` : textToAsk;
    const userMessage = { role: "user", content: userDisplayContent };
    const chatHistory = messages
      .filter(m => m.role === "user" || m.role === "ai")
      .map(m => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideText) setQuestion("");
    setAttachedImage(null);
    setLoading(true);

    try {
      setMessages((prev) => [...prev, { role: "ai", content: "" }]);
      await askQuestionStream(
        textToAsk, chatHistory,
        (newText) => {
          setMessages((prev) => {
            const updatedMessages = [...prev];
            const lastIndex = updatedMessages.length - 1;
            updatedMessages[lastIndex] = { ...updatedMessages[lastIndex], content: updatedMessages[lastIndex].content + newText };
            return updatedMessages;
          });
        },
        activeSession.document_filename, activeSession.id, isStrict, currentImage
      );
    } catch (error) {
      setMessages((prev) => [...prev, { role: "ai", content: "Error: " + error.message }]);
    }
    setLoading(false);
  }

  const handleCopy = (text, id) => {
    const cleanText = text.replace(/\[CONFIDENCE: (HIGH|MEDIUM|LOW|EXTERNAL)\]/g, "").trim();
    navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRenameChat = async (id, currentTitle, e) => {
    e.stopPropagation();
    setActiveMenu(null);
    const newTitle = window.prompt("Enter new chat name:", currentTitle);
    if (newTitle && newTitle.trim() !== "") {
      try {
        await renameChatSession(id, newTitle);
        setChatSessions(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
        if (activeSession?.id === id) setActiveSession({ ...activeSession, title: newTitle });
      } catch (err) { alert("Failed to rename chat"); }
    }
  };

  const handleDeleteChat = async (id, e) => {
    e.stopPropagation();
    setActiveMenu(null);
    if (window.confirm("Delete this chat?")) {
      try {
        await deleteChatSession(id);
        setChatSessions(prev => prev.filter(c => c.id !== id));
        if (activeSession?.id === id) setActiveSession(null);
        setMessages([]);
      } catch (err) { alert("Failed to delete chat"); }
    }
  };

  const handleDeleteDocument = async (filename, e) => {
    e.stopPropagation();
    setActiveMenu(null);
    if (window.confirm(`Remove "${filename}" from library?`)) {
      try {
        await deleteDocument(filename);
        setLibraryFiles(prev => prev.filter(f => f !== filename));
      } catch (err) { alert("Failed to delete document"); }
    }
  };

  const renderMessageContent = (content, msgIndex) => {
    let text = content;
    let badge = null;
    let badgeClass = "";

    if (text.includes("[CONFIDENCE: HIGH]")) { badge = "HIGH"; badgeClass = "hk-badge-high"; text = text.replace("[CONFIDENCE: HIGH]", ""); }
    else if (text.includes("[CONFIDENCE: MEDIUM]")) { badge = "MEDIUM"; badgeClass = "hk-badge-medium"; text = text.replace("[CONFIDENCE: MEDIUM]", ""); }
    else if (text.includes("[CONFIDENCE: LOW]")) { badge = "LOW"; badgeClass = "hk-badge-low"; text = text.replace("[CONFIDENCE: LOW]", ""); }
    else if (text.includes("[CONFIDENCE: EXTERNAL]")) { badge = "EXTERNAL"; badgeClass = "hk-badge-external"; text = text.replace("[CONFIDENCE: EXTERNAL]", ""); }

    text = text.replace(/\[Source: .*?, Page: (\d+)\]/g, "`[Pg. $1]`");

    const isEmpty = !text.trim() && loading;

    return (
      <>
        {badge && (
          <div style={{ marginBottom: 10 }}>
            <span className={`hk-confidence-badge ${badgeClass}`}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              {badge}
            </span>
          </div>
        )}
        {isEmpty ? (
          <div className="hk-typing">
            <span /><span /><span />
          </div>
        ) : (
          <div className="hk-md">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <div style={{ borderRadius: 10, overflow: 'hidden', margin: '10px 0', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                      <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className="hk-inline-code" {...props}>{children}</code>
                  );
                }
              }}
            >{text}</ReactMarkdown>
          </div>
        )}
        <button
          onClick={() => handleCopy(content, msgIndex)}
          className="hk-copy-btn"
          title="Copy"
        >
          {copiedId === msgIndex ? (
            <>✓ Copied</>
          ) : (
            <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
          )}
        </button>
      </>
    );
  };

  const canSend = (question.trim() || attachedImage) && activeSession && !loading && !uploading;

  return (
    <>
      <style>{CHATBOX_STYLES}</style>
      <div className="hk-app">

        {/* SIDEBAR */}
        <div className="hk-sidebar">
          <div className="hk-sidebar-brand">
            <div className="hk-brand-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className="hk-brand-name">Hal<span>kill</span></div>
          </div>

          <button className="hk-new-chat-btn" onClick={() => handleStartNewChat(null)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Chat
            </span>
            <kbd style={{ fontSize: '0.65rem', color: '#5a5a72', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '2px 5px' }}>⌃K</kbd>
          </button>

          {/* Recent Chats */}
          <div className="hk-chats-container">
            <p className="hk-section-title">Recent Chats</p>
            <div className="hk-sidebar-list">
              {chatSessions.map((session) => (
                <button
                  key={`chat-${session.id}`}
                  className={`hk-list-item ${activeSession?.id === session.id ? 'active' : ''}`}
                  onClick={() => handleSelectSession(session)}
                >
                  <span className="hk-item-text">
                    <span style={{ marginRight: 7, opacity: 0.5, fontSize: '0.8rem' }}>💬</span>
                    {session.title}
                  </span>
                  <button
                    className="hk-dots-btn"
                    onClick={(e) => { e.stopPropagation(); setActiveMenu(`chat-${session.id}`); }}
                  >⋯</button>
                  {activeMenu === `chat-${session.id}` && (
                    <div className="hk-dropdown">
                      <button className="hk-dropdown-item" onClick={(e) => handleRenameChat(session.id, session.title, e)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Rename
                      </button>
                      <button className="hk-dropdown-item danger" onClick={(e) => handleDeleteChat(session.id, e)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        Delete
                      </button>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Library */}
          <div className="hk-library-container">
            <p className="hk-section-title">My Library</p>
            <div className="hk-sidebar-list">
              {libraryFiles.map((file, index) => (
                <button
                  key={`file-${index}`}
                  className="hk-list-item"
                  onClick={() => handleStartNewChat(file)}
                >
                  <span className="hk-item-text">
                    <span style={{ marginRight: 7, opacity: 0.6, fontSize: '0.8rem' }}>{getFileIcon(file)}</span>
                    {file}
                  </span>
                  <button
                    className="hk-dots-btn"
                    onClick={(e) => { e.stopPropagation(); setActiveMenu(`file-${index}`); }}
                  >⋯</button>
                  {activeMenu === `file-${index}` && (
                    <div className="hk-dropdown">
                      <button className="hk-dropdown-item danger" onClick={(e) => handleDeleteDocument(file, e)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        Remove
                      </button>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="hk-upload-section">
            <input type="file" id="file-upload" accept=".pdf,.csv,.xlsx,.xls,.txt,.md" style={{ display: "none" }} onChange={handleFileUpload} />
            <button
              className="hk-upload-btn"
              onClick={() => document.getElementById("file-upload").click()}
              disabled={uploading || loading}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              {uploading ? "Uploading..." : "Upload File"}
            </button>
          </div>
        </div>

        {/* MAIN AREA */}
        <div className="hk-main">
          {/* Topbar */}
          <div className="hk-topbar">
            <div>
              <h1 className="hk-topbar-title">Halkill Engine</h1>
              <p className="hk-topbar-sub">
                {activeSession?.document_filename ? (
                  <>
                    Active context:
                    <span className="hk-doc-chip">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      {activeSession.document_filename}
                    </span>
                  </>
                ) : (
                  <span style={{ color: '#3a3a55' }}>No document selected</span>
                )}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {activeSession?.document_filename && (
                <div className="hk-toggle-wrap">
                  <span className={`hk-toggle-label ${!isStrict ? 'active' : ''}`}>Hybrid</span>
                  <label className="hk-toggle">
                    <input type="checkbox" checked={isStrict} onChange={() => setIsStrict(!isStrict)} />
                    <div className="hk-toggle-track" />
                    <div className="hk-toggle-knob" />
                  </label>
                  <span className={`hk-toggle-label ${isStrict ? 'active' : ''}`}>Strict</span>
                </div>
              )}
              <button
                onClick={logout}
                style={{
                  padding: '7px 14px',
                  background: 'rgba(224,82,82,0.08)',
                  color: '#e05252',
                  border: '1px solid rgba(224,82,82,0.2)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,82,82,0.15)'; e.currentTarget.style.borderColor = 'rgba(224,82,82,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(224,82,82,0.08)'; e.currentTarget.style.borderColor = 'rgba(224,82,82,0.2)'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign out
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="hk-messages">
            <div className="hk-messages-inner">
              {messages.length === 0 && (
                <div className="hk-welcome">
                  <div className="hk-welcome-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                  <h2 className="hk-welcome-title">What can I help with?</h2>
                  <p className="hk-welcome-sub">Ask anything about your documents, or explore freely.</p>
                  <div className="hk-suggestions">
                    {[
                      { icon: '📊', title: 'Analyze Document', desc: 'Summarize and extract key insights.', q: 'Summarize the key points.' },
                      { icon: '⚡', title: 'Explain a Topic', desc: 'Break down any complex concept.', q: 'Explain a complex topic simply.' },
                      { icon: '👁️', title: 'Vision Analysis', desc: 'Upload and analyze images.', q: 'Review the attached image and describe it.' },
                    ].map((s, i) => (
                      <div key={i} className="hk-suggestion-card" onClick={() => handleAsk(s.q)}>
                        <span className="hk-suggestion-icon">{s.icon}</span>
                        <div className="hk-suggestion-title">{s.title}</div>
                        <div className="hk-suggestion-desc">{s.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, index) => (
                <div key={index} className={`hk-msg-row ${msg.role === 'user' ? 'user' : 'ai'}`}>
                  <div className={`hk-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}>
                    {msg.role === 'user' ? (
                      <div className="hk-md">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : renderMessageContent(msg.content, index)}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="hk-input-area">
            <div className="hk-input-inner">
              {attachedImage && (
                <div className="hk-image-preview">
                  <img src={attachedImage} alt="Preview" />
                  <button className="hk-remove-img" onClick={() => setAttachedImage(null)}>×</button>
                </div>
              )}
              <div className="hk-input-box">
                <input type="file" id="image-upload" accept="image/*" style={{ display: "none" }} onChange={handleImageAttach} />
                <button
                  className="hk-attach-btn"
                  onClick={() => document.getElementById("image-upload").click()}
                  title="Attach image"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </button>
                <input
                  ref={inputRef}
                  className="hk-text-input"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleAsk(); }}
                  placeholder={activeSession ? "Ask a question..." : "Select or start a chat to begin..."}
                  disabled={!activeSession}
                />
                <button
                  className={`hk-send-btn ${!canSend ? 'empty' : ''}`}
                  onClick={() => handleAsk()}
                  disabled={!canSend}
                >
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                      Thinking
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      Send
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

export default ChatBox;