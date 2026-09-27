import { env } from "../env"

export interface InferenceMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/** OpenAI-compatible chat completion. Defined for the future enrichment pipeline; not exercised yet. */
export async function complete(messages: InferenceMessage[]): Promise<string> {
  const res = await fetch(`${env.INFERENCE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.INFERENCE_API_KEY}`,
    },
    body: JSON.stringify({ model: env.INFERENCE_MODEL, messages }),
  })
  if (!res.ok) throw new Error(`inference failed: ${res.status}`)
  const data = (await res.json()) as { choices: { message: { content: string } }[] }
  return data.choices[0]?.message?.content ?? ""
}
