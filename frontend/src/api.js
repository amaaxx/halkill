// We now pass a callback function 'onChunk' that will trigger every time a new word arrives
export async function askQuestionStream(question, onChunk) {
  const response = await fetch("http://127.0.0.1:8000/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: question }),
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