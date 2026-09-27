export class InferenceError extends Error {}
export class InferenceHttpError extends InferenceError {
  constructor(readonly status: number, readonly detail: string) {
    super(`Inference HTTP ${status}: ${detail}`)
    this.name = "InferenceHttpError"
  }
}
