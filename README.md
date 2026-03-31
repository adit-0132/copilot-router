# ⚡ CopilotRouter

**Intelligent model routing for GitHub Copilot** — stop burning premium requests on simple questions.

CopilotRouter reads every query before it is dispatched, classifies its complexity in near-zero time using a **hybrid scoring engine** (heuristic-first, LLM-fallback), and silently switches the model to the cheapest one capable of handling it well.

## Features

- **Hybrid Classifier**: Heuristic scorer runs first (< 2ms, 0 cost). If confidence < 0.70, fires LLM tiebreaker.
- **Smart Model Routing**: `trivial → GPT-5 mini (0×)`, `moderate → GPT-4.1 (1×)`, `complex → Claude Opus (3×)`
- **Budget Tracker**: Counts requests used this month, persists across sessions, auto-resets on month boundary.
- **Status Bar Widget**: Shows `⚡ 214/300` live. Turns amber at 80%, red at 95%.
- **Budget Auto-Tighten**: At 80% budget used: complex→moderate. At 95%: everything→trivial.
- **React Dashboard**: Full WebView panel with budget gauge, routing log table, and settings.
- **Chat Participant**: Registered as `@router` — invoke it explicitly in Copilot Chat.

## Usage

1. Install the extension
2. Open Copilot Chat and type `@router <your question>`
3. CopilotRouter classifies complexity and routes to the optimal model
4. Check the status bar for budget usage or open the dashboard with `CopilotRouter: Open Dashboard`

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `copilotRouter.enabled` | `true` | Enable or disable routing |
| `copilotRouter.trivialModel` | `gpt-4o-mini` | Model for trivial queries (0× cost) |
| `copilotRouter.moderateModel` | `gpt-4o` | Model for moderate queries (1× cost) |
| `copilotRouter.complexModel` | `claude-opus` | Model for complex queries (3× cost) |
| `copilotRouter.budgetLimit` | `300` | Monthly request budget |
| `copilotRouter.autoTightenAt` | `80` | Tighten routing at this % of budget |
| `copilotRouter.llmFallbackThreshold` | `0.70` | Confidence below which LLM tiebreaker fires |

## Development

```bash
npm install
cd webview-ui && npm install && cd ..
npm run build
# Press F5 in VSCode to launch Extension Development Host
```

## License

MIT
