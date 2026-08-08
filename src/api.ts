import axios from "axios";

export async function sendMessage(message: string) {
  const response = await axios.post("http://localhost:5000/chat", {
    message,
  });

  return response.data;
}