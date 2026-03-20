// We now pass a callback function 'onChunk' that will trigger every time a new word arrives
export async function askQuestionStream(question, history, onChunk, filename) {
  // 1. Grab the token from the browser's storage
  const token = localStorage.getItem('token');

  const response = await fetch("http://127.0.0.1:8000/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // 2. Show the VIP pass to the backend
      "Authorization": `Bearer ${token}` 
    },
    body: JSON.stringify({ query: question, history: history, filename: filename }),
  });

  if (!response.ok) {
    if (response.status === 401) {
       throw new Error("Unauthorized: Please log in again.");
    }
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
  // 1. Grab the token from the browser's storage
  const token = localStorage.getItem('token');
  
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://127.0.0.1:8000/upload", {
    method: "POST",
    headers: {
      // 2. Show the VIP pass to the backend! 
      // (Notice we still DO NOT set Content-Type here, only Authorization)
      "Authorization": `Bearer ${token}`
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || "Failed to upload document");
  }

  return data;
}

// NEW: Fetch the user's previously uploaded files
export async function fetchUserLibrary() {
  const token = localStorage.getItem('token');
  
  const response = await fetch("http://127.0.0.1:8000/documents", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}` 
    }
  });

  if (!response.ok) {
    throw new Error("Failed to load library");
  }

  return await response.json(); 
}