// `cloudflare:workers` is a virtual module provided by the Workers runtime
// (production / preview). It has no Node-side implementation, so we declare a
// minimal ambient type for the `env` bindings we read at runtime.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
