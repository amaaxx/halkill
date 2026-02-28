import ReactMarkdown from "react-markdown";
import { useState } from "react";
import { askQuestionStream, uploadDocument } from "../api";

function ChatBox() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false); // <-- Add loading state for the file

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    // Add a temporary message to the UI
    setMessages((prev) => [...prev, { role: "ai", content: `Uploading ${file.name}...` }]);

    try {
      await uploadDocument(file);
      
      // Update the UI to show success
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
      // Reset the input so you can upload the same file again if needed
      event.target.value = null; 
    }
  }

  async function handleAsk() {
    if (!question.trim()) return;
  
    const userMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);
  
    try {
      // 1. Immediately create an empty AI message placeholder on the screen
      setMessages((prev) => [...prev, { role: "ai", content: "" }]);

      // 2. Call the stream, passing a function that runs every time a word arrives
      await askQuestionStream(question, (newText) => {
        setMessages((prev) => {
          // Clone the message array
          const updatedMessages = [...prev];
          const lastIndex = updatedMessages.length - 1;
          
          // Grab the last message (the AI placeholder) and append the new word to it
          updatedMessages[lastIndex] = {
            ...updatedMessages[lastIndex],
            content: updatedMessages[lastIndex].content + newText,
          };
          
          return updatedMessages; // React repaints the screen with the new word
        });
      });
      
    } catch (error) {
      const errorMessage = {
        role: "ai",
        content: "Error: " + error.message,
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  
    setLoading(false);
  }
  
  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "auto" }}>
      <h2>Academic Engine</h2>
  
      <div style={{ marginBottom: "20px" }}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              textAlign: msg.role === "user" ? "right" : "left",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "10px 15px",
                borderRadius: "15px",
                backgroundColor:
                  msg.role === "user" ? "#007bff" : "#2d2d2d",
                color: "white",
                maxWidth: "70%",
              }}
            >
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          
          {/* FIX 2: You need this hidden input to actually select the file! */}
          <input
            type="file"
            id="file-upload"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
          
          {/* Upload Button */}
          <button
            onClick={() => document.getElementById("file-upload").click()}
            disabled={uploading || loading}
            style={{ padding: "8px 15px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
          >
            {uploading ? "..." : "📎 Upload PDF"}
          </button>

          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask from your textbook..."
            style={{ flexGrow: 1, padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }} 
          />
          
          <button
            onClick={handleAsk}
            disabled={loading || uploading}
            style={{ padding: "8px 15px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
          >
            {loading ? "Processing..." : "Ask"}
          </button>
        </div>
      </div> 
      </div>
    );
}

export default ChatBox;
