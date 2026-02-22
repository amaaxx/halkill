export async function askQuestion(question) {
  const response = await fetch("http://127.0.0.1:8000/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: question }),
  });

  const data = await response.json();

  // Check HTTP status instead
  if (!response.ok) {
    throw new Error(data.detail || "Something went wrong");
  }

  return data.answer;
}