// We now pass a callback function 'onChunk' that will trigger every time a new word arrives
export async function askQuestionStream(question, history, onChunk) {
  const response = await fetch("http://127.0.0.1:8000/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: question, history: history }),
  });

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  // THE UPGRADE: Connect to the network stream directly
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break; // The AI has finished talking
    
    // Decode the raw bytes into a string and send it to React
    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk); 
  }
}

// Function to handle file uploads using FormData
export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://127.0.0.1:8000/upload", {
    method: "POST",
    // Note: We DO NOT set "Content-Type" here. 
    // The browser automatically sets it to "multipart/form-data" when it sees FormData.
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || "Failed to upload document");
  }

  return data;
}