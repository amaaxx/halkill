// Automatically switches between Localhost and your Render Production URL
const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

export async function askQuestionStream(question, history, onChunk, filename, sessionId, isStrict, imageData) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}` 
    },
    body: JSON.stringify({ 
        query: question, history: history, filename: filename || null, 
        session_id: sessionId, strict_mode: isStrict, image_data: imageData || null 
    }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("Unauthorized: Please log in again.");
    throw new Error("Network response was not ok");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break; 
    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk); 
  }
}

export async function uploadDocument(file) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.detail || "Failed to upload document");
  return data;
}

export async function fetchUserLibrary() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/documents`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!response.ok) throw new Error("Failed to load library");
  return await response.json(); 
}

export async function createChatSession(filename = null) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ filename })
  });
  if (!response.ok) throw new Error("Failed to create chat");
  return await response.json();
}

export async function fetchUserChats() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/chats`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!response.ok) throw new Error("Failed to load chats");
  return await response.json();
}

export async function fetchChatHistory(sessionId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/chats/${sessionId}/messages`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!response.ok) throw new Error("Failed to load history");
  return await response.json();
}

export async function renameChatSession(sessionId, newTitle) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/chats/${sessionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ title: newTitle })
  });
  if (!res.ok) throw new Error("Failed to rename chat");
}

export async function deleteChatSession(sessionId) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/chats/${sessionId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to delete chat");
}

export async function deleteDocument(filename) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/documents/${filename}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

export async function fetchDocumentUrl(filename) {
  const token = localStorage.getItem('token');
  const encodedFilename = encodeURIComponent(filename);
  const res = await fetch(`${API_URL}/documents/${encodedFilename}/url`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch document URL");
  const data = await res.json();
  return data.url;
}