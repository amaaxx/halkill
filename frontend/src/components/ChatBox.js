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
  
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null); 
  const messagesEndRef = useRef(null);

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
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

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
        const welcomeMsg = filename ? `I am ready to answer questions about **${filename}**.` : "I'm ready for a general chat. What's on your mind?";
        setMessages([{ role: "ai", content: welcomeMsg }]);
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

  async function handleAsk() {
    if (!question.trim() || !activeSession) return;
  
    const userMessage = { role: "user", content: question };
    const chatHistory = messages
        .filter(m => m.role === "user" || m.role === "ai")
        .map(m => ({ role: m.role, content: m.content })); 
    
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);
  
    try {
      setMessages((prev) => [...prev, { role: "ai", content: "" }]);

      await askQuestionStream(
          question, 
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
          isStrict 
      );
    } catch (error) {
      setMessages((prev) => [...prev, { role: "ai", content: "Error: " + error.message }]);
    }
    setLoading(false);
  }

  const renderMessageContent = (content) => {
      let text = content;
      let badge = null;
      let badgeColor = "#4caf50";

      if (text.includes("[CONFIDENCE: HIGH]")) { badge = "HIGH"; text = text.replace("[CONFIDENCE: HIGH]", ""); }
      else if (text.includes("[CONFIDENCE: MEDIUM]")) { badge = "MEDIUM"; badgeColor = "#ffb74d"; text = text.replace("[CONFIDENCE: MEDIUM]", ""); }
      else if (text.includes("[CONFIDENCE: LOW]")) { badge = "LOW"; badgeColor = "#ef5350"; text = text.replace("[CONFIDENCE: LOW]", ""); }
      else if (text.includes("[CONFIDENCE: EXTERNAL]")) { badge = "EXTERNAL KNOWLEDGE"; badgeColor = "#ab47bc"; text = text.replace("[CONFIDENCE: EXTERNAL]", ""); }

      return (
          <>
             {badge && <span style={{display: 'inline-block', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: badgeColor, color: 'black', fontWeight: 'bold', marginBottom: '8px'}}>{badge}</span>}
             <ReactMarkdown
                components={{
                    code({node, inline, className, children, ...props}) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                        <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                            {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                        ) : ( <code style={{backgroundColor: "#444", padding: "2px 4px", borderRadius: "4px"}} {...props}>{children}</code> )
                    }
                }}
            >{text}</ReactMarkdown>
          </>
      );
  };
  
  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#121212", color: "white", fontFamily: "sans-serif" }}>
      <div style={{ width: "260px", backgroundColor: "#1e1e1e", borderRight: "1px solid #333", display: "flex", flexDirection: "column", padding: "20px" }}>
        
        <button onClick={() => handleStartNewChat(null)} style={{ padding: "10px", backgroundColor: "#2d2d2d", color: "white", border: "1px solid #444", borderRadius: "5px", cursor: "pointer", marginBottom: "20px" }}>
             + New General Chat
        </button>

        <h2 style={{ marginTop: 0, marginBottom: "15px", fontSize: "1rem", color: "#aaa", textTransform: "uppercase" }}>Recent Chats</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", overflowY: "auto", flex: 1, marginBottom: "20px" }}>
            {chatSessions.map((session) => (
                <button
                    key={session.id} onClick={() => handleSelectSession(session)}
                    style={{ padding: "10px", textAlign: "left", borderRadius: "6px", cursor: "pointer", border: "none", backgroundColor: activeSession?.id === session.id ? "#2d2d2d" : "transparent", color: activeSession?.id === session.id ? "white" : "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >💬 {session.title}</button>
            ))}
        </div>

        <h2 style={{ marginTop: 0, marginBottom: "15px", fontSize: "1rem", color: "#aaa", textTransform: "uppercase" }}>My Library</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", overflowY: "auto", maxHeight: "30%" }}>
            {libraryFiles.map((file, index) => (
                <button
                    key={index} onClick={() => handleStartNewChat(file)}
                    style={{ padding: "8px", textAlign: "left", backgroundColor: "transparent", color: "#4caf50", border: "1px solid #4caf50", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" }}
                >+ {file}</button>
            ))}
        </div>

        <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #333" }}>
            <input type="file" id="file-upload" accept=".pdf" style={{ display: "none" }} onChange={handleFileUpload} />
            <button onClick={() => document.getElementById("file-upload").click()} disabled={uploading || loading} style={{ width: "100%", padding: "10px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>
                {uploading ? "Uploading..." : "📎 Upload PDF"}
            </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 40px", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ paddingBottom: "20px", borderBottom: "1px solid #333", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
                <h1 style={{ margin: 0 }}>Halkill Engine</h1>
                <p style={{ margin: "5px 0 0 0", color: "#888", fontSize: "0.9rem" }}>
                    Active Document: <strong style={{color: activeSession?.document_filename ? "#4caf50" : "#007bff"}}>{activeSession?.document_filename || "General (None)"}</strong>
                </p>
            </div>
            {activeSession?.document_filename && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#1e1e1e", padding: "5px 10px", borderRadius: "20px" }}>
                    <span style={{ fontSize: "0.8rem", color: isStrict ? "#aaa" : "white" }}>Hybrid</span>
                    <label style={{ position: "relative", display: "inline-block", width: "40px", height: "20px" }}>
                        <input type="checkbox" checked={isStrict} onChange={() => setIsStrict(!isStrict)} style={{ opacity: 0, width: 0, height: 0 }} />
                        <span style={{ position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isStrict ? "#4caf50" : "#555", borderRadius: "34px", transition: "0.4s" }}>
                            <span style={{ position: "absolute", height: "14px", width: "14px", left: isStrict ? "22px" : "3px", bottom: "3px", backgroundColor: "white", borderRadius: "50%", transition: "0.4s" }}></span>
                        </span>
                    </label>
                    <span style={{ fontSize: "0.8rem", color: isStrict ? "white" : "#aaa" }}>Strict RAG</span>
                </div>
            )}
        </div>
  
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "10px", display: "flex", flexDirection: "column", gap: "15px" }}>
            {messages.map((msg, index) => (
            <div key={index} style={{ textAlign: msg.role === "user" ? "right" : "left" }}>
                <div style={{ display: "inline-block", padding: "12px 18px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", backgroundColor: msg.role === "user" ? "#007bff" : "#2d2d2d", color: "white", maxWidth: "85%", boxShadow: "0 2px 5px rgba(0,0,0,0.2)", lineHeight: "1.6", textAlign: "left" }}>
                    {msg.role === "user" ? msg.content : renderMessageContent(msg.content)}
                </div>
            </div>
            ))}
            <div ref={messagesEndRef} />
        </div>
        
        <div style={{ display: "flex", gap: "10px", marginTop: "20px", padding: "10px", backgroundColor: "#1e1e1e", borderRadius: "8px" }}>
            <input
                value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }} 
                placeholder={activeSession ? `Ask a question...` : "Select a chat to begin..."}
                disabled={!activeSession}
                style={{ flexGrow: 1, padding: "12px", borderRadius: "5px", border: "none", backgroundColor: "transparent", color: "white", outline: "none", fontSize: "1rem" }}
            />
            <button
                onClick={handleAsk} disabled={loading || uploading || !activeSession}
                style={{ padding: "10px 20px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", opacity: (!activeSession || loading) ? 0.5 : 1 }}
            >
                {loading ? "..." : "Send"}
            </button>
        </div>
      </div> 
    </div>
  );
}

export default ChatBox;