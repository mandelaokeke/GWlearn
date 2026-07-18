export interface LectureChatMessage {
  content: string;
  role: "assistant" | "user";
}

export interface LectureChatRequest {
  messages: LectureChatMessage[];
}

export interface LectureChatResponse {
  answer: string;
  modelId: string;
  videoId: string;
}
