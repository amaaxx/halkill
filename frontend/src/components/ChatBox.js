import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState, useRef, useEffect } from "react";
import { askQuestionStream, uploadDocument, fetchUserLibrary, fetchUserChats, createChatSession, fetchChatHistory } from "../api";

function ChatBox() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isStrict, setIsStrict] = useState(true); 
  const [attachedImage, setAttachedImage] = useState(null); // NEW: Image State
  
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null); 
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [libData, chatsData] = await Promise.all([fetchUserLibrary(), fetchUserChats()]);
        setLibraryFiles(libData.files);
        setChatSessions(chatsData);
        if (chatsData.length > 0) handleSelectSession(chatsData[0]);
      } catch (err) {
        console.error(err);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      } catch (err) {
        console.error(err);
      }
  }

  async function handleStartNewChat(filename = null) {
      try {
        const newSession = await createChatSession(filename);
        setChatSessions(prev => [newSession, ...prev]);
        setActiveSession(newSession);
        setMessages([]); 
      } catch (err) {
        console.error(err);
      }
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument(file);
      if (!libraryFiles.includes(file.name)) setLibraryFiles((prev) => [...prev, file.name]);
      await handleStartNewChat(file.name);
    } catch (error) {
      alert("Upload failed: " + error.message);
    } finally {
      setUploading(false);
      event.target.value = null; 
    }
  }

  // Handle Local Image Selection
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
    const currentImage = attachedImage; // Capture before clearing
    
    if (!textToAsk.trim() && !currentImage) return;
    if (!activeSession) return;
  
    // Embed the image natively into the chat history for seamless DB saves
    const userDisplayContent = currentImage ? `![Attached Image](${currentImage})\n\n${textToAsk}` : textToAsk;
    const userMessage = { role: "user", content: userDisplayContent };
    
    const chatHistory = messages
        .filter(m => m.role === "user" || m.role === "ai")
        .map(m => ({ role: m.role, content: m.content })); 
    
    setMessages((prev) => [...prev, userMessage]);
    
    if (!overrideText) setQuestion("");
    setAttachedImage(null); // Clear thumbnail
    setLoading(true);
  
    try {
      setMessages((prev) => [...prev, { role: "ai", content: "" }]);

      await askQuestionStream(
          textToAsk, 
          chatHistory, 
          (newText) => {
            setMessages((prev) => {
              const updatedMessages = [...prev];
              const lastIndex = updatedMessages.length - 1;
              updatedMessages[lastIndex] = { ...updatedMessages[lastIndex], content: updatedMessages[lastIndex].content + newText };
              return updatedMessages;
            });
          }, 
          activeSession.document_filename, 
          activeSession.id,
          isStrict,
          currentImage 
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
                            ) : ( 
                            <code style={{backgroundColor: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "6px", color: "#64b5f6", fontSize: "0.85em"}} {...props}>
                                {children}
                            </code> 
                            )
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
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #444; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #666; }
        .sidebar-btn { transition: all 0.2s ease; }
        .sidebar-btn:hover { background-color: #333 !important; }
        .markdown-body p { margin-top: 0; margin-bottom: 12px; }
        .markdown-body ul, .markdown-body ol { margin-top: 0; margin-bottom: 12px; padding-left: 20px; }
        .markdown-body li { margin-bottom: 6px; }
        .markdown-body img { max-width: 100%; max-height: 300px; border-radius: 8px; margin-bottom: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .suggestion-card { background-color: #171717; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; cursor: pointer; transition: 0.2s; flex: 1; }
        .suggestion-card:hover { border-color: #64b5f6; background-color: #1e1e1e; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", backgroundColor: "#0f0f0f", color: "white", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
        
        {/* SIDEBAR */}
        <div style={{ width: "280px", backgroundColor: "#171717", borderRight: "1px solid #2a2a2a", display: "flex", flexDirection: "column", padding: "24px", boxSizing: "border-box" }}>
          
          <button className="sidebar-btn" onClick={() => handleStartNewChat(null)} style={{ padding: "12px", backgroundColor: "#2a2a2a", color: "white", border: "1px solid #3a3a3a", borderRadius: "8px", cursor: "pointer", marginBottom: "24px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between" }}>
               <span>+ New Chat</span> <span style={{color: "#888", fontSize: "0.75rem"}}>Ctrl+K</span>
          </button>

          <h2 style={{ margin: "0 0 12px 0", fontSize: "0.75rem", color: "#888", textTransform: "uppercase", letterSpacing: "1px" }}>Recent Chats</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", flex: 1, marginBottom: "24px", paddingRight: "4px" }}>
              {chatSessions.map((session) => (
                  <button
                      key={session.id} 
                      className="sidebar-btn"
                      onClick={() => handleSelectSession(session)}
                      style={{ padding: "10px 12px", textAlign: "left", borderRadius: "8px", cursor: "pointer", border: "none", backgroundColor: activeSession?.id === session.id ? "#2a2a2a" : "transparent", color: activeSession?.id === session.id ? "#fff" : "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.9rem" }}
                  >💬 {session.title}</button>
              ))}
          </div>

          <h2 style={{ margin: "0 0 12px 0", fontSize: "0.75rem", color: "#888", textTransform: "uppercase", letterSpacing: "1px" }}>My Library</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", maxHeight: "30%", paddingRight: "4px" }}>
              {libraryFiles.map((file, index) => (
                  <button
                      key={index} 
                      className="sidebar-btn"
                      onClick={() => handleStartNewChat(file)}
                      style={{ padding: "8px 12px", textAlign: "left", backgroundColor: "transparent", color: "#64b5f6", border: "1px solid rgba(100, 181, 246, 0.3)", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}
                  >{getFileIcon(file)} {file}</button>
              ))}
          </div>

          <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #2a2a2a" }}>
              {/* Added support for csv, txt, md, xlsx */}
              <input type="file" id="file-upload" accept=".pdf,.csv,.xlsx,.xls,.txt,.md" style={{ display: "none" }} onChange={handleFileUpload} />
              <button className="sidebar-btn" onClick={() => document.getElementById("file-upload").click()} disabled={uploading || loading} style={{ width: "100%", padding: "12px", backgroundColor: "#ffffff", color: "#000000", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem" }}>
                  {uploading ? "Uploading..." : "📎 Upload File"}
              </button>
          </div>
        </div>

        {/* MAIN CHAT AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0", maxWidth: "100%" }}>
          
          <div style={{ padding: "24px 40px", borderBottom: "1px solid #2a2a2a", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0f0f0f" }}>
              <div>
                  <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "700", letterSpacing: "-0.5px" }}>Halkill Engine</h1>
                  <p style={{ margin: "6px 0 0 0", color: "#888", fontSize: "0.85rem" }}>
                      Active Document: <strong style={{color: activeSession?.document_filename ? "#64b5f6" : "#aaa", fontWeight: "600"}}>{activeSession?.document_filename || "General (None)"}</strong>
                  </p>
              </div>
              
              {activeSession?.document_filename && (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#171717", padding: "8px 16px", borderRadius: "100px", border: "1px solid #2a2a2a" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: "600", color: isStrict ? "#666" : "#fff" }}>Hybrid</span>
                      <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px" }}>
                          <input type="checkbox" checked={isStrict} onChange={() => setIsStrict(!isStrict)} style={{ opacity: 0, width: 0, height: 0 }} />
                          <span style={{ position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isStrict ? "#64b5f6" : "#444", borderRadius: "34px", transition: "0.3s" }}>
                              <span style={{ position: "absolute", height: "18px", width: "18px", left: isStrict ? "23px" : "3px", bottom: "3px", backgroundColor: "white", borderRadius: "50%", transition: "0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}></span>
                          </span>
                      </label>
                      <span style={{ fontSize: "0.8rem", fontWeight: "600", color: isStrict ? "#fff" : "#666" }}>Strict RAG</span>
                  </div>
              )}
          </div>
    
          <div style={{ flex: 1, overflowY: "auto", padding: "40px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px", width: "100%", margin: "0 auto" }}>
              
              {messages.length === 0 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", marginTop: "10vh" }}>
                      <h2 style={{ fontSize: "2rem", marginBottom: "30px", fontWeight: "500" }}>What can I help with?</h2>
                      <div style={{ display: "flex", gap: "20px", width: "100%", maxWidth: "700px" }}>
                          <div className="suggestion-card" onClick={() => handleAsk("Summarize the key points of this document.")}>
                              <h3 style={{ margin: "0 0 10px 0", fontSize: "1rem", color: "#e0e0e0" }}>📊 Analyze document</h3>
                              <p style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}>Summarize the active file.</p>
                          </div>
                          <div className="suggestion-card" onClick={() => handleAsk("Explain a complex topic simply.")}>
                              <h3 style={{ margin: "0 0 10px 0", fontSize: "1rem", color: "#e0e0e0" }}>⚛️ Explain a topic</h3>
                              <p style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}>Break down a difficult concept.</p>
                          </div>
                          <div className="suggestion-card" onClick={() => handleAsk("Review the attached image and describe it.")}>
                              <h3 style={{ margin: "0 0 10px 0", fontSize: "1rem", color: "#e0e0e0" }}>👁️ Vision Analysis</h3>
                              <p style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}>Upload images for visual review.</p>
                          </div>
                      </div>
                  </div>
              )}

              {messages.map((msg, index) => (
              <div key={index} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ 
                      padding: "16px 20px", 
                      borderRadius: msg.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px", 
                      backgroundColor: msg.role === "user" ? "#292929" : "transparent", 
                      border: msg.role === "user" ? "none" : "1px solid #2a2a2a",
                      color: "white", 
                      maxWidth: "85%", 
                      lineHeight: "1.6", 
                      textAlign: "left",
                      minWidth: "400px"
                  }}>
                      {msg.role === "user" ? (
                          <div className="markdown-body" style={{ color: "white" }}>
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                      ) : renderMessageContent(msg.content)}
                  </div>
              </div>
              ))}
              <div ref={messagesEndRef} />
          </div>
          
          <div style={{ padding: "0 40px 40px 40px", maxWidth: "900px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
              
              {/* IMAGE ATTACHMENT THUMBNAIL */}
              {attachedImage && (
                  <div style={{ marginBottom: "10px", display: "inline-block", position: "relative" }}>
                      <img src={attachedImage} alt="Attachment Preview" style={{ height: "60px", borderRadius: "8px", border: "2px solid #64b5f6" }} />
                      <button onClick={() => setAttachedImage(null)} style={{ position: "absolute", top: "-8px", right: "-8px", background: "#ff4d4d", color: "white", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold" }}>×</button>
                  </div>
              )}

              <div style={{ display: "flex", gap: "10px", padding: "8px", backgroundColor: "#171717", borderRadius: "16px", border: "1px solid #2a2a2a", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                  
                  {/* IMAGE UPLOAD BUTTON */}
                  <input type="file" id="image-upload" accept="image/*" style={{ display: "none" }} onChange={handleImageAttach} />
                  <button onClick={() => document.getElementById("image-upload").click()} style={{ background: "transparent", border: "none", color: "#aaa", fontSize: "1.2rem", cursor: "pointer", padding: "0 10px", transition: "0.2s" }} title="Attach Image">
                      🖼️
                  </button>

                  <input
                      ref={inputRef}
                      value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }} 
                      placeholder={activeSession ? `Ask a question...` : "Select a chat to begin..."}
                      disabled={!activeSession}
                      style={{ flexGrow: 1, padding: "12px 10px", borderRadius: "12px", border: "none", backgroundColor: "transparent", color: "white", outline: "none", fontSize: "1rem" }}
                  />
                  
                  <button
                      onClick={() => handleAsk()} disabled={loading || uploading || !activeSession}
                      style={{ padding: "12px 24px", backgroundColor: (question.trim() || attachedImage) ? "#ffffff" : "#333", color: (question.trim() || attachedImage) ? "#000000" : "#888", border: "none", borderRadius: "10px", cursor: (question.trim() || attachedImage) ? "pointer" : "default", fontWeight: "bold", transition: "0.2s" }}
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