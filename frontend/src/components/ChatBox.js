import ReactMarkdown from "react-markdown";
import { useState, useRef, useEffect } from "react";
import { askQuestionStream, uploadDocument, fetchUserLibrary } from "../api";

function ChatBox() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // New States for the Library
  const [activeFile, setActiveFile] = useState(""); 
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);

  const messagesEndRef = useRef(null);

  // 1. Fetch the user's library as soon as they log in
  useEffect(() => {
    async function loadLibrary() {
      try {
        const data = await fetchUserLibrary();
        setLibraryFiles(data.files);
        // Automatically select the first file if they have any
        if (data.files.length > 0) {
          setActiveFile(data.files[0]);
        }
      } catch (error) {
        console.error("Failed to fetch library:", error);
      } finally {
        setLoadingLibrary(false);
      }
    }
    loadLibrary();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setMessages((prev) => [...prev, { role: "ai", content: `Uploading ${file.name}...` }]);

    try {
      await uploadDocument(file);
      
      setActiveFile(file.name); 
      
      // Add the new file to the sidebar immediately if it's not already there
      if (!libraryFiles.includes(file.name)) {
        setLibraryFiles((prev) => [...prev, file.name]);
      }
      
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { 
            role: "ai", 
            content: `✅ Successfully uploaded **${file.name}**. You can now ask questions about it!` 
        };
        return updated;
      });
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "ai", content: `❌ Upload Error: ${error.message}` };
        return updated;
      });
    } finally {
      setUploading(false);
      event.target.value = null; 
    }
  }

  async function handleAsk() {
    if (!question.trim()) return;
    
    if (!activeFile) {
        alert("Please upload or select a document from your library first!");
        return;
    }
  
    const userMessage = { role: "user", content: question };
    const chatHistory = messages.filter(m => !m.content.includes("❌") && !m.content.includes("Uploading"));
    
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);
  
    try {
      setMessages((prev) => [...prev, { role: "ai", content: "" }]);

      await askQuestionStream(question, chatHistory, (newText) => {
        setMessages((prev) => {
          const updatedMessages = [...prev];
          const lastIndex = updatedMessages.length - 1;
          
          updatedMessages[lastIndex] = {
            ...updatedMessages[lastIndex],
            content: updatedMessages[lastIndex].content + newText,
          };
          
          return updatedMessages;
        });
      }, activeFile);
      
    } catch (error) {
      setMessages((prev) => [...prev, { role: "ai", content: "Error: " + error.message }]);
    }
  
    setLoading(false);
  }
  
  return (
    // The Main Flexbox Container
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#121212", color: "white", fontFamily: "sans-serif" }}>
      
      {/* ========================================== */}
      {/* LEFT SIDEBAR: The Library                  */}
      {/* ========================================== */}
      <div style={{ width: "260px", backgroundColor: "#1e1e1e", borderRight: "1px solid #333", display: "flex", flexDirection: "column", padding: "20px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "1.2rem", color: "#e0e0e0" }}>📚 My Library</h2>
        
        {loadingLibrary ? (
            <p style={{ color: "#888", fontSize: "0.9rem" }}>Loading documents...</p>
        ) : libraryFiles.length === 0 ? (
            <p style={{ color: "#888", fontSize: "0.9rem" }}>No documents yet.</p>
        ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" }}>
                {libraryFiles.map((file, index) => (
                    <button
                        key={index}
                        onClick={() => setActiveFile(file)}
                        style={{
                            padding: "10px",
                            textAlign: "left",
                            backgroundColor: activeFile === file ? "#2d2d2d" : "transparent",
                            color: activeFile === file ? "#4caf50" : "#ccc",
                            border: activeFile === file ? "1px solid #4caf50" : "1px solid transparent",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                        }}
                    >
                        📄 {file}
                    </button>
                ))}
            </div>
        )}

        <div style={{ marginTop: "auto", paddingTop: "20px" }}>
            <input type="file" id="file-upload" accept=".pdf" style={{ display: "none" }} onChange={handleFileUpload} />
            <button
                onClick={() => document.getElementById("file-upload").click()}
                disabled={uploading || loading}
                style={{ width: "100%", padding: "10px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
            >
                {uploading ? "Uploading..." : "+ Upload New PDF"}
            </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* RIGHT PANEL: The Chat Engine               */}
      {/* ========================================== */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 40px", maxWidth: "900px", margin: "0 auto" }}>
        
        <div style={{ paddingBottom: "20px", borderBottom: "1px solid #333", marginBottom: "20px" }}>
            <h1 style={{ margin: 0 }}>Halkill Engine</h1>
            {activeFile && <p style={{ margin: "5px 0 0 0", color: "#4caf50", fontSize: "0.9rem" }}>Currently querying: <strong>{activeFile}</strong></p>}
        </div>
  
        {/* Chat Messages Area */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "10px", display: "flex", flexDirection: "column", gap: "15px" }}>
            {messages.map((msg, index) => (
            <div key={index} style={{ textAlign: msg.role === "user" ? "right" : "left" }}>
                <div style={{
                    display: "inline-block",
                    padding: "12px 18px",
                    borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    backgroundColor: msg.role === "user" ? "#007bff" : "#2d2d2d",
                    color: "white",
                    maxWidth: "80%",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                    lineHeight: "1.5"
                }}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
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
                placeholder={activeFile ? `Ask about ${activeFile}...` : "Select a document to start..."}
                disabled={!activeFile}
                style={{ flexGrow: 1, padding: "12px", borderRadius: "5px", border: "none", backgroundColor: "transparent", color: "white", outline: "none", fontSize: "1rem" }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }} 
            />
            <button
                onClick={handleAsk}
                disabled={loading || uploading || !activeFile}
                style={{ padding: "10px 20px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", opacity: (!activeFile || loading) ? 0.5 : 1 }}
            >
                {loading ? "..." : "Send"}
            </button>
        </div>

      </div> 
    </div>
  );
}

export default ChatBox;