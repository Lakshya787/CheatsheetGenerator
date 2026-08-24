// lib/stream.ts
// SSE client utility — connects to the backend /api/generate endpoint
// and dispatches events to caller-provided callbacks.

export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "token"; token: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface StreamCallbacks {
  onStatus: (message: string) => void;
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function startGeneration(
  url: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  // POST to trigger pipeline; response is SSE
  const response = await fetch(`${BACKEND_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  });

  if (!response.ok || !response.body) {
    callbacks.onError(`Server returned ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE lines: "data: <json>\n\n"
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const event: StreamEvent = JSON.parse(raw);
          switch (event.type) {
            case "status":
              callbacks.onStatus(event.message);
              break;
            case "token":
              callbacks.onToken(event.token);
              break;
            case "done":
              callbacks.onDone();
              break;
            case "error":
              callbacks.onError(event.message);
              break;
          }
        } catch {
          // ignore malformed lines
        }
      }
    }
  }
}

export function downloadMarkdown(): void {
  window.open(`${BACKEND_URL}/api/download/markdown`, "_blank");
}
