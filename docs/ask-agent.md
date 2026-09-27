# Ask Agent

**Ask Agent** is a chat assistant attached to a single finished vessel
screening or DD case. It answers questions about that report, and can search
the web for anything newer than the report.

Open it with **Ask Agent** on a report page. It is disabled while the report is
still running.

## What it knows

Each record has one chat, and it can only see records you own. The system
prompt includes only a small header: the vessel's name, IMO, flag and status,
or the company's name and status. Everything else is fetched through tools, so
answers come from the stored report, not from the model's memory.

### Tools

| Available on | Tool | What it does |
|---|---|---|
| Screenings | `get_overview` | Verdict, summary, prediction, recommendation, data completeness |
| | `get_sanctions` | Sanctions status and matches |
| | `get_ownership` | Registry companies, GLEIF data, inferred ownership |
| | `get_fleet` | Sister vessels and their hits |
| | `get_ais_events` | Detected AIS events |
| | `analyze_sts_satellite` | Reads a cached Sentinel image chip with a vision model (run **Verify with Sentinel-1 satellite** first) |
| DD cases | `get_overview`, `get_sanctions` | As above |
| | `get_corporate_network` | Linked companies and their roles |
| | `get_fleet` | The company's fleet |
| | `get_incidents` | Detentions and data gaps |
| Both | `list_entities`, `get_entity` | Nodes of the entity graph |
| Both | `web_search`, `get_contents`, `find_similar` | Live web search through [Exa](https://exa.ai), with sources cited |

The report tools read the stored report only; they never call the live data
sources. Without `EXA_API_KEY`, the web tools report themselves as unavailable
and the rest of the chat still works.

The prompt tells the agent to consult the report first and to use the web for
recent or external facts. It must cite URLs, never invent data, and write in
British English.

## Models

Chat uses the Vercel AI SDK with the OpenRouter provider
(`@openrouter/ai-sdk-provider`), pointed at `INFERENCE_URL` with
`INFERENCE_API_KEY`. OpenRouter is the tested setup.

| Variable | Purpose |
|---|---|
| `CHAT_MODEL` | Chat model; it must support tool calling. Falls back to `INFERENCE_MODEL` |
| `VISION_MODEL` | Model used by `analyze_sts_satellite` (default `qwen/qwen3-vl-32b-instruct`) |
| `INFERENCE_FALLBACK_URL`, `_API_KEY`, `_MODEL` | Used only if the primary provider fails before any output has streamed |

Replies stream to the browser. The agent can call tools for up to 8 steps per
answer. Messages are saved when a reply finishes.

## Limitations

- **Chat history page:** the `/chats` page is a placeholder; chats are reached
  from their report.
- **No inspection or history tools:** no tool returns a screening's port state
  control inspections or ship history, even though they are in the report.
- **Orphaned chats:** deleting a screening or DD case does not delete its chat.
