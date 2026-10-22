# How we used AI

Two separate things: AI inside the product, and AI helping us write the code.

## 1. AI inside the product

AI is the core of Rumor Hunters. Three agents read, check and reply. All model calls go through one file, `backend/app/llm.py`, and every instruction we give a model is in one place, `backend/app/prompts.py`.

| Agent | What the AI does | Model tier |
|---|---|---|
| **Watcher** | Reads each public post in English, Nigerian Pidgin or Hausa. Says whether it is about the organization, writes the claim in one plain sentence, and notes the language, the sentiment and whether it urges people to act (for example, to withdraw money). Then groups posts that tell the same story, even when the words differ. | Fast (Haiku) |
| **Fact-checker** | Compares one story with the organization's verified facts and returns true, false, misleading or unverified, with the facts it used. | Smart (Sonnet) |
| **Responder** | Drafts a website statement, a social reply and a customer SMS from the verified facts only. | Smart (Sonnet) |

### What the AI does not decide

We kept the important decisions in plain code we can read and test:

- **Risk score.** Reach, speed, growth, urgency and the verdict are added up with simple arithmetic (`score_risk` in `agents/responder.py`). No model call.
- **Spread measurement.** Posts per hour, growth and spike detection are plain maths (`metrics.py`).
- **The Fact-checker cannot guess.** If it cites no real fact, the code turns the verdict into "unverified". If an organization has no verified facts on file, the model is not called at all.
- **The reply never invents facts.** The prompt says to use only the verified facts given. If the verdict is unverified, the reply must not say the claim is false.
- **A person stays in control.** Replies wait for a team member to approve them. A team can turn on auto-reply for low-risk stories only. Critical stories always wait for a person.

## 2. AI helping us write the code

- **Tool used:** Claude Code (Anthropic), in the terminal.
- **What it did:** debugging, code review, and some targeted changes, for example splitting the live-check loop so polling no longer waits for analysis, and small edits to the dashboard pages. It also helped with the logo and the pitch deck text.
