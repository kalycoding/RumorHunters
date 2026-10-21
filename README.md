# Rumor Hunters

AI agents that live on the internet, spot misinformation about your organization the moment it starts, protect your reputation, and draft the reply.

Zecathon 6.0, Track 6 (Managing Misinformation and Reputational Risk). Team: Muhammad Abdullahi, Ibrahim Musa Abbah.

## Flow

Internet (public posts) -> Watcher -> Fact-checker -> Responder -> Comms team approves -> reply goes out.

| Agent | File | Job |
|---|---|---|
| Watcher | `src/lib/agents/watcher.ts` | Read posts in English, Pidgin, Hausa. Extract claims. Group into narratives. Measure spread. |
| Fact-checker | `src/lib/agents/factchecker.ts` | Compare each narrative with verified facts only. True, false, misleading or unverified. |
| Responder | `src/lib/agents/responder.ts` | Score risk. Draft statement, social reply and SMS. Always pending human approval. |

`src/lib/pipeline.ts` runs them in order. `POST /api/analyze` runs the pipeline on the simulated replay data in `src/data/`.

## Rules

- Public data only. No private messages.
- The agents never post. A human approves every reply.
- The fact-checker uses verified facts only. No match means "unverified".
- Demo data is simulated and labelled as such.

## Run

```
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev
```
