import { RepoPilotError } from "./errors.js";

export interface OllamaGenerateResponse {
  response?: string;
}

export interface OllamaClient {
  generate(prompt: string, model: string, format?: unknown): Promise<string>;
}

export class LocalOllamaClient implements OllamaClient {
  public constructor(private readonly baseUrl = "http://127.0.0.1:11434") {}

  public async generate(
    prompt: string,
    model: string,
    format?: unknown,
  ): Promise<string> {
    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/, "")}/api/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model, prompt, stream: false, ...(format ? { format } : {}) }),
        },
      );
      if (!response.ok) {
        throw new RepoPilotError(
          `Ollama returned HTTP ${response.status}. Is model "${model}" installed?`,
        );
      }
      const payload = (await response.json()) as OllamaGenerateResponse;
      if (
        typeof payload.response !== "string" ||
        payload.response.trim() === ""
      ) {
        throw new RepoPilotError("Ollama returned no usable response.");
      }
      return payload.response;
    } catch (error) {
      if (error instanceof RepoPilotError) {
        throw error;
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new RepoPilotError(
        `Cannot reach local Ollama at ${this.baseUrl}. Start Ollama and ensure "${model}" is available.\n${detail}`,
      );
    }
  }
}
