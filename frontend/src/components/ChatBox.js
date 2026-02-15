import ReactMarkdown from "react-markdown";
import { useState } from "react";
import { askQuestion } from "../api";

function ChatBox() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);



  async function handleAsk() {
    if (!question.trim()) return;
  
    const userMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);
  
    try {
      const response = await askQuestion(question);
      const aiMessage = { role: "ai", content: response };
  
      setMessages((prev) => [...prev, aiMessage]);
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
      </div>
  
      {loading && <p>Thinking...</p>}
  
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask from your textbook..."
        style={{ width: "70%", padding: "8px" }}
      />
  
      <button
        onClick={handleAsk}
        disabled={loading}
        style={{ padding: "8px 15px", marginLeft: "10px" }}
      >
        {loading ? "Processing..." : "Ask"}
      </button>
    </div>
  );
  
}

export default ChatBox;
