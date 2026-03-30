import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState, useRef, useEffect } from "react";
import { 
  askQuestionStream, uploadDocument, fetchUserLibrary, fetchUserChats, 
  createChatSession, fetchChatHistory, renameChatSession, deleteChatSession, deleteDocument 
} from "../api";

function ChatBox() {
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

  const handleCopy = (text) => {
    const cleanText = text.replace(/\[CONFIDENCE: (HIGH|MEDIUM|LOW|EXTERNAL)\]/g, "").trim();
    navigator.clipboard.writeText(cleanText);
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
    if (window.confirm("Are you sure you want to delete this chat?")) {
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
    if (window.confirm(`Delete ${filename} from your library? (Note: This will not delete past chats about this file)`)) {
      try {
        await deleteDocument(filename);
        setLibraryFiles(prev => prev.filter(f => f !== filename));
      } catch (err) { alert("Failed to delete document"); }
    }
  };

  const renderMessageContent = (content) => {
      let text = content;
      let badge = null;
      let badgeColor = "#4caf50";

      if (text.includes("[CONFIDENCE: HIGH]")) { badge = "HIGH"; text = text.replace("[CONFIDENCE: HIGH]", ""); }
      else if (text.includes("[CONFIDENCE: MEDIUM]")) { badge = "MEDIUM"; badgeColor = "#ffb74d"; text = text.replace("[CONFIDENCE: MEDIUM]", ""); }
      else if (text.includes("[CONFIDENCE: LOW]")) { badge = "LOW"; badgeColor = "#ef5350"; text = text.replace("[CONFIDENCE: LOW]", ""); }
      else if (text.includes("[CONFIDENCE: EXTERNAL]")) { badge = "EXTERNAL KNOWLEDGE"; badgeColor = "#ab47bc"; text = text.replace("[CONFIDENCE: EXTERNAL]", ""); }

      text = text.replace(/\[Source: .*?, Page: (\d+)\]/g, "`[Pg. $1]`");

      return (
          <div style={{ position: "relative" }}>
             {badge && <div style={{ marginBottom: '10px' }}><span style={{display: 'inline-block', fontSize: '0.65rem', letterSpacing: '0.5px', padding: '4px 10px', borderRadius: '4px', backgroundColor: badgeColor, color: '#121212', fontWeight: '800'}}>{badge}</span></div>}
             <div className="markdown-body" style={{ color: "#e0e0e0", fontSize: "0.95rem" }}>
                <ReactMarkdown
                    components={{
                        code({node, inline, className, children, ...props}) {
                            const match = /language-(\w+)/.exec(className || '')
                            return !inline && match ? (
                            <div style={{ borderRadius: '8px', overflow: 'hidden', margin: '10px 0' }}>
                                <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                                    {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                            </div>
                            ) : ( <code style={{backgroundColor: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "6px", color: "#64b5f6", fontSize: "0.85em"}} {...props}>{children}</code> )
                        }
                    }}
                >{text}</ReactMarkdown>
             </div>
             <button onClick={() => handleCopy(content)} style={{ position: "absolute", top: badge ? "-5px" : "0", right: "0", background: "transparent", border: "1px solid #444", color: "#aaa", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "0.75rem" }}>
                📋 Copy
             </button>
          </div>
      );
  };
  
  return (
    <>
      <style>{`
        /* Minimalist Scrollbars */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }
        
        /* Layout resets */
        * { box-sizing: border-box; }
        
        /* Sidebar Styles */
        .sidebar { width: 260px; background-color: #1e1f20; border-right: 1px solid #333; display: flex; flex-direction: column; height: 100vh; padding: 16px; }
        
        .new-chat-btn { width: 100%; padding: 12px 16px; background-color: #2a2b2f; color: #e3e5e8; border: 1px solid #3a3b40; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 500; transition: 0.2s; margin-bottom: 24px; font-size: 0.9rem; }
        .new-chat-btn:hover { background-color: #383a40; border-color: #4a4b50; }

        .section-title { font-size: 0.75rem; color: #949ba4; font-weight: 600; margin: 0 0 8px 4px; text-transform: uppercase; letter-spacing: 0.5px; }

        /* The fix for the horizontal scroll: flex-direction: column */
        .sidebar-list { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; padding-right: 4px; }
        .chats-container { flex: 1; min-height: 0; margin-bottom: 20px; display: flex; flex-direction: column; }
        .library-container { max-height: 35%; min-height: 0; display: flex; flex-direction: column; }

        .list-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; cursor: pointer; color: #a1a5ab; text-decoration: none; transition: background 0.2s; position: relative; border: none; font-size: 0.9rem; }
        .list-item:hover { background-color: #2b2d31; color: #dbdee1; }
        .list-item.active { background-color: #35373c; color: #fff; font-weight: 500; }
        
        .item-text { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
        
        /* 3-Dots Menu */
        .dots-btn { opacity: 0; background: transparent; border: none; color: #949ba4; cursor: pointer; padding: 2px 6px; border-radius: 4px; font-weight: bold; transition: 0.2s; }
        .list-item:hover .dots-btn { opacity: 1; }
        .dots-btn:hover { background: #404249; color: #fff; }

        .dropdown-menu { position: absolute; right: 10px; top: 35px; background: #2b2d31; border: 1px solid #1e1f22; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); z-index: 100; overflow: hidden; display: flex; flex-direction: column; width: 130px; }
        .dropdown-item { padding: 10px 16px; background: transparent; border: none; color: #dbdee1; text-align: left; cursor: pointer; font-size: 0.85rem; transition: 0.1s; }
        .dropdown-item:hover { background: #35373c; color: #fff; }
        .dropdown-item.danger:hover { background: #da373c; color: #fff; }

        /* Markdown Styles */
        .markdown-body p { margin-top: 0; margin-bottom: 12px; }
        .markdown-body ul, .markdown-body ol { margin-top: 0; margin-bottom: 12px; padding-left: 20px; }
        .markdown-body li { margin-bottom: 6px; }
        .markdown-body img { max-width: 100%; max-height: 300px; border-radius: 8px; margin-bottom: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        
        .suggestion-card { background-color: #1e1f20; border: 1px solid #333; border-radius: 12px; padding: 20px; cursor: pointer; transition: 0.2s; flex: 1; }
        .suggestion-card:hover { border-color: #64b5f6; background-color: #2a2b2f; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", backgroundColor: "#131314", color: "white", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
        
        {/* SIDEBAR */}
        <div className="sidebar">
          
          <button className="new-chat-btn" onClick={() => handleStartNewChat(null)}>
               <span>+ New Chat</span> <span style={{color: "#888", fontSize: "0.75rem"}}>Ctrl+K</span>
          </button>

          {/* RECENT CHATS */}
          <div className="chats-container">
            <h2 className="section-title">Recent Chats</h2>
            <div className="sidebar-list">
                {chatSessions.map((session) => (
                    <div 
                        key={`chat-${session.id}`} 
                        className={`list-item ${activeSession?.id === session.id ? 'active' : ''}`} 
                        onClick={() => handleSelectSession(session)}
                    >
                        <span className="item-text">💬 {session.title}</span>
                        <button className="dots-btn" onClick={(e) => { e.stopPropagation(); setActiveMenu(`chat-${session.id}`); }}>⋮</button>
                        
                        {activeMenu === `chat-${session.id}` && (
                          <div className="dropdown-menu">
                            <button className="dropdown-item" onClick={(e) => handleRenameChat(session.id, session.title, e)}>✏️ Rename</button>
                            <button className="dropdown-item danger" onClick={(e) => handleDeleteChat(session.id, e)}>🗑️ Delete</button>
                          </div>
                        )}
                    </div>
                ))}
            </div>
          </div>

          {/* MY LIBRARY */}
          <div className="library-container">
            <h2 className="section-title">My Library</h2>
            <div className="sidebar-list">
                {libraryFiles.map((file, index) => (
                    <div 
                        key={`file-${index}`} 
                        className="list-item" 
                        onClick={() => handleStartNewChat(file)}
                    >
                        <span className="item-text">{getFileIcon(file)} {file}</span>
                        <button className="dots-btn" onClick={(e) => { e.stopPropagation(); setActiveMenu(`file-${index}`); }}>⋮</button>

                        {activeMenu === `file-${index}` && (
                          <div className="dropdown-menu">
                            <button className="dropdown-item danger" onClick={(e) => handleDeleteDocument(file, e)}>🗑️ Delete</button>
                          </div>
                        )}
                    </div>
                ))}
            </div>
          </div>

          <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #333" }}>
              <input type="file" id="file-upload" accept=".pdf,.csv,.xlsx,.xls,.txt,.md" style={{ display: "none" }} onChange={handleFileUpload} />
              <button 
                  onClick={() => document.getElementById("file-upload").click()} 
                  disabled={uploading || loading} 
                  style={{ width: "100%", padding: "12px", backgroundColor: "#e3e5e8", color: "#111214", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "0.9rem", transition: "0.2s" }}
              >
                  {uploading ? "Uploading..." : "📎 Upload File"}
              </button>
          </div>
        </div>

        {/* MAIN CHAT AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0", maxWidth: "100%" }}>
          
          <div style={{ padding: "20px 40px", borderBottom: "1px solid #2a2a2a", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#131314" }}>
              <div>
                  <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "600", letterSpacing: "-0.5px" }}>Halkill Engine</h1>
                  <p style={{ margin: "4px 0 0 0", color: "#888", fontSize: "0.85rem" }}>
                      Active Document: <strong style={{color: activeSession?.document_filename ? "#64b5f6" : "#aaa", fontWeight: "500"}}>{activeSession?.document_filename || "General (None)"}</strong>
                  </p>
              </div>
              
              {activeSession?.document_filename && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#1e1f20", padding: "6px 14px", borderRadius: "100px", border: "1px solid #333" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: "500", color: isStrict ? "#777" : "#fff" }}>Hybrid</span>
                      <label style={{ position: "relative", display: "inline-block", width: "40px", height: "22px" }}>
                          <input type="checkbox" checked={isStrict} onChange={() => setIsStrict(!isStrict)} style={{ opacity: 0, width: 0, height: 0 }} />
                          <span style={{ position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isStrict ? "#64b5f6" : "#444", borderRadius: "34px", transition: "0.3s" }}>
                              <span style={{ position: "absolute", height: "16px", width: "16px", left: isStrict ? "21px" : "3px", bottom: "3px", backgroundColor: "white", borderRadius: "50%", transition: "0.3s" }}></span>
                          </span>
                      </label>
                      <span style={{ fontSize: "0.8rem", fontWeight: "500", color: isStrict ? "#fff" : "#777" }}>Strict RAG</span>
                  </div>
              )}
          </div>
    
          <div style={{ flex: 1, overflowY: "auto", padding: "40px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px", width: "100%", margin: "0 auto" }}>
              
              {messages.length === 0 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", marginTop: "10vh" }}>
                      <h2 style={{ fontSize: "1.8rem", marginBottom: "30px", fontWeight: "500", color: "#e3e5e8" }}>What can I help with?</h2>
                      <div style={{ display: "flex", gap: "16px", width: "100%", maxWidth: "700px" }}>
                          <div className="suggestion-card" onClick={() => handleAsk("Summarize the key points.")}>
                              <h3 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "#e3e5e8", fontWeight: "600" }}>📊 Analyze document</h3>
                              <p style={{ margin: 0, color: "#949ba4", fontSize: "0.85rem", lineHeight: "1.4" }}>Summarize the active file.</p>
                          </div>
                          <div className="suggestion-card" onClick={() => handleAsk("Explain a complex topic simply.")}>
                              <h3 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "#e3e5e8", fontWeight: "600" }}>⚛️ Explain a topic</h3>
                              <p style={{ margin: 0, color: "#949ba4", fontSize: "0.85rem", lineHeight: "1.4" }}>Break down a difficult concept.</p>
                          </div>
                          <div className="suggestion-card" onClick={() => handleAsk("Review the attached image and describe it.")}>
                              <h3 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "#e3e5e8", fontWeight: "600" }}>👁️ Vision Analysis</h3>
                              <p style={{ margin: 0, color: "#949ba4", fontSize: "0.85rem", lineHeight: "1.4" }}>Upload images for visual review.</p>
                          </div>
                      </div>
                  </div>
              )}

              {messages.map((msg, index) => (
              <div key={index} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ 
                      padding: "16px 20px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", 
                      backgroundColor: msg.role === "user" ? "#2b2d31" : "transparent", border: msg.role === "user" ? "none" : "1px solid #2a2a2a",
                      color: "#dbdee1", maxWidth: "85%", lineHeight: "1.6", textAlign: "left", minWidth: msg.role === "ai" ? "400px" : "auto"
                  }}>
                      {msg.role === "user" ? (
                          <div className="markdown-body">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                      ) : renderMessageContent(msg.content)}
                  </div>
              </div>
              ))}
              <div ref={messagesEndRef} />
          </div>
          
          <div style={{ padding: "0 40px 40px 40px", maxWidth: "900px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
              
              {attachedImage && (
                  <div style={{ marginBottom: "10px", display: "inline-block", position: "relative" }}>
                      <img src={attachedImage} alt="Preview" style={{ height: "60px", borderRadius: "8px", border: "2px solid #64b5f6" }} />
                      <button onClick={() => setAttachedImage(null)} style={{ position: "absolute", top: "-8px", right: "-8px", background: "#f23f42", color: "white", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold" }}>×</button>
                  </div>
              )}

              <div style={{ display: "flex", gap: "10px", padding: "8px", backgroundColor: "#1e1f20", borderRadius: "16px", border: "1px solid #333", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
                  
                  <input type="file" id="image-upload" accept="image/*" style={{ display: "none" }} onChange={handleImageAttach} />
                  <button onClick={() => document.getElementById("image-upload").click()} style={{ background: "transparent", border: "none", color: "#949ba4", fontSize: "1.2rem", cursor: "pointer", padding: "0 10px", transition: "0.2s" }} title="Attach Image">
                      🖼️
                  </button>

                  <input
                      ref={inputRef} value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }} 
                      placeholder={activeSession ? `Ask a question...` : "Select a chat to begin..."}
                      disabled={!activeSession}
                      style={{ flexGrow: 1, padding: "12px 10px", borderRadius: "12px", border: "none", backgroundColor: "transparent", color: "#dbdee1", outline: "none", fontSize: "1rem" }}
                  />
                  
                  <button
                      onClick={() => handleAsk()} disabled={loading || uploading || !activeSession}
                      style={{ padding: "10px 24px", backgroundColor: (question.trim() || attachedImage) ? "#e3e5e8" : "#2b2d31", color: (question.trim() || attachedImage) ? "#111214" : "#555", border: "none", borderRadius: "10px", cursor: (question.trim() || attachedImage) ? "pointer" : "default", fontWeight: "600", transition: "0.2s" }}
                  >
                      {loading ? "..." : "Send"}
                  </button>
              </div>
          </div>

        </div> 
      </div>
    </>
  );
}

export default ChatBox;