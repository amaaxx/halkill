import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState, useRef, useEffect } from "react";
import { 
    askQuestionStream, 
    uploadDocument, 
    fetchUserLibrary, 
    fetchUserChats, 
    createChatSession, 
    fetchChatHistory 
} from "../api";

function ChatBox() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Library & Session States
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null); 
  const [loadingData, setLoadingData] = useState(true);

  const messagesEndRef = useRef(null);

  // 1. Initial Load: Fetch Books and Chat Folders
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [libData, chatsData] = await Promise.all([
            fetchUserLibrary(),
            fetchUserChats()
        ]);
        setLibraryFiles(libData.files);
        setChatSessions(chatsData);
        
        // If they have a previous chat, open it automatically
        if (chatsData.length > 0) {
            handleSelectSession(chatsData[0]);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoadingData(false);
      }
    }
    loadInitialData();
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  // 2. Select a Chat Session and load its history
  async function handleSelectSession(session) {
      setActiveSession(session);
      setMessages([]); // Clear screen while loading
      try {
          const history = await fetchChatHistory(session.id);
          setMessages(history);
      } catch (error) {
          console.error("Failed to load history", error);
      }
  }

  // 3. Start a brand new chat from a Library file
  async function handleStartNewChat(filename) {
      try {
          const newSession = await createChatSession(filename);
          setChatSessions(prev => [newSession, ...prev]);
          setActiveSession(newSession);
          setMessages([{ role: "ai", content: `I am ready to answer questions about **${filename}**. What would you like to know?` }]);
      } catch (error) {
          console.error("Failed to start new chat", error);
      }
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadDocument(file);
      if (!libraryFiles.includes(file.name)) {
        setLibraryFiles((prev) => [...prev, file.name]);
      }
      // Automatically start a new chat with this newly uploaded file
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
    .map(m => ({ role: m.role, content: m.content })); // <-- We map it to ONLY send text!
    
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
              updatedMessages[lastIndex] = {
                ...updatedMessages[lastIndex],
                content: updatedMessages[lastIndex].content + newText,
              };
              return updatedMessages;
            });
          }, 
          activeSession.document_filename, 
          activeSession.id // Pass the Session ID!
      );
      
    } catch (error) {
      setMessages((prev) => [...prev, { role: "ai", content: "Error: " + error.message }]);
    }
    setLoading(false);
  }
  
  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#121212", color: "white", fontFamily: "sans-serif" }}>
      
      {/* LEFT SIDEBAR */}
      <div style={{ width: "260px", backgroundColor: "#1e1e1e", borderRight: "1px solid #333", display: "flex", flexDirection: "column", padding: "20px" }}>
        
        {/* Chat History Section */}
        <h2 style={{ marginTop: 0, marginBottom: "15px", fontSize: "1rem", color: "#aaa", textTransform: "uppercase" }}>Recent Chats</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", overflowY: "auto", flex: 1, marginBottom: "20px" }}>
            {chatSessions.map((session) => (
                <button
                    key={session.id}
                    onClick={() => handleSelectSession(session)}
                    style={{
                        padding: "10px", textAlign: "left", borderRadius: "6px", cursor: "pointer", border: "none",
                        backgroundColor: activeSession?.id === session.id ? "#2d2d2d" : "transparent",
                        color: activeSession?.id === session.id ? "white" : "#ccc",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}
                >
                    💬 {session.title}
                </button>
            ))}
        </div>

        {/* Library Section */}
        <h2 style={{ marginTop: 0, marginBottom: "15px", fontSize: "1rem", color: "#aaa", textTransform: "uppercase" }}>My Library</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", overflowY: "auto", maxHeight: "30%" }}>
            {libraryFiles.map((file, index) => (
                <button
                    key={index}
                    onClick={() => handleStartNewChat(file)}
                    style={{
                        padding: "8px", textAlign: "left", backgroundColor: "transparent", color: "#4caf50",
                        border: "1px solid #4caf50", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem"
                    }}
                >
                    + New Chat: {file}
                </button>
            ))}
        </div>

        <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #333" }}>
            <input type="file" id="file-upload" accept=".pdf" style={{ display: "none" }} onChange={handleFileUpload} />
            <button
                onClick={() => document.getElementById("file-upload").click()}
                disabled={uploading || loading}
                style={{ width: "100%", padding: "10px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
            >
                {uploading ? "Uploading..." : "📎 Upload PDF"}
            </button>
        </div>
      </div>

      {/* RIGHT PANEL: Chat Engine */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 40px", maxWidth: "900px", margin: "0 auto" }}>
        
        <div style={{ paddingBottom: "20px", borderBottom: "1px solid #333", marginBottom: "20px" }}>
            <h1 style={{ margin: 0 }}>Halkill Engine</h1>
            {activeSession && <p style={{ margin: "5px 0 0 0", color: "#888", fontSize: "0.9rem" }}>Active Document: <strong style={{color: "#4caf50"}}>{activeSession.document_filename}</strong></p>}
        </div>
  
        {/* Messages Area */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "10px", display: "flex", flexDirection: "column", gap: "15px" }}>
            {messages.map((msg, index) => (
            <div key={index} style={{ textAlign: msg.role === "user" ? "right" : "left" }}>
                <div style={{
                    display: "inline-block", padding: "12px 18px",
                    borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    backgroundColor: msg.role === "user" ? "#007bff" : "#2d2d2d",
                    color: "white", maxWidth: "85%", boxShadow: "0 2px 5px rgba(0,0,0,0.2)", lineHeight: "1.6", textAlign: "left"
                }}>
                {/* ADVANCED MARKDOWN RENDERING */}
                <ReactMarkdown
                    components={{
                        code({node, inline, className, children, ...props}) {
                            const match = /language-(\w+)/.exec(className || '')
                            return !inline && match ? (
                            <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                {...props}
                            >
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                            ) : (
                            <code className={className} style={{backgroundColor: "#444", padding: "2px 4px", borderRadius: "4px"}} {...props}>
                                {children}
                            </code>
                            )
                        }
                    }}
                >
                    {msg.content}
                </ReactMarkdown>
                </div>
            </div>
            ))}
            <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div style={{ display: "flex", gap: "10px", marginTop: "20px", padding: "10px", backgroundColor: "#1e1e1e", borderRadius: "8px" }}>
            <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={activeSession ? `Ask about ${activeSession.document_filename}...` : "Select a document to start a chat..."}
                disabled={!activeSession}
                style={{ flexGrow: 1, padding: "12px", borderRadius: "5px", border: "none", backgroundColor: "transparent", color: "white", outline: "none", fontSize: "1rem" }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }} 
            />
            <button
                onClick={handleAsk}
                disabled={loading || uploading || !activeSession}
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