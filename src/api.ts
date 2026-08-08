import axios from "axios";

export async function sendMessage(message: string) {
  const response = await axios.post("/api/chat", {
    message,
  });

  return response.data;
}