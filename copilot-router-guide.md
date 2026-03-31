# CopilotRouter — One-Shot Generation Guide

> **Purpose of this document:** Hand this entire file to an AI model. It contains every specification, architectural decision, code contract, file structure, and implementation detail needed to generate the complete CopilotRouter VSCode extension from scratch in a single pass. Follow every section in order. Do not skip, summarise, or omit any file.

---

## 0. What You Are Building

**CopilotRouter** is a VSCode extension that solves a real problem: GitHub Copilot Pro gives users 300 requests/month, but not all models cost the same. Claude Opus costs 3× per request, GPT-4.1 costs 1×, and GPT-5 mini costs 0× (free). Most users either leave it on Opus and blow through their budget in days, or manually switch — which is friction they shouldn't have to manage.

CopilotRouter reads every query before it is dispatched, classifies its complexity in near-zero time using a **hybrid scoring engine** (heuristic-first, LLM-fallback), and silently switches the model to the cheapest one capable of handling it well. It also tracks the user's monthly budget in the status bar, auto-tightens routing as the limit approaches, and shows a routing log in a React dashboard panel.

**The core promise:** Trivial questions go free. Real work goes to the right tool. The user never thinks about it.

---

## 1. Product Requirements

### 1.1 Core Features (0→1, must ship)

| ID | Feature | Description |
|----|---------|-------------|
| F1 | Hybrid classifier | Heuristic scorer runs first (< 2ms, 0 cost). If confidence < 0.70, fires LLM tiebreaker. |
| F2 | Model routing | Maps `trivial → GPT-5 mini (0×)`, `moderate → GPT-4.1 / Sonnet (1×)`, `complex → Claude Opus (3×)` |
| F3 | Budget tracker | Counts requests used this month, persists via `globalState`, auto-resets on month boundary |
| F4 | Status bar widget | Shows `⚡ 214/300` live in the status bar. Turns amber at 80%, red at 95%. Opens dashboard on click. |
| F5 | Routing tooltip | Every response ends with `— Routed to GPT-5 mini · trivial · saved 1×` |
| F6 | Chat participant | Registered as `@router` so users can optionally invoke it explicitly |
| F7 | Budget auto-tighten | At 80% budget used: complex→moderate. At 95%: everything→trivial |

### 1.2 Polish Features (1→10, ship after core works)

| ID | Feature | Description |
|----|---------|-------------|
| P1 | React dashboard panel | Full WebView panel with budget gauge, routing log table, settings form |
| P2 | Routing log | Last 200 routing decisions with query snippet, tier, model, timestamp, savings |
| P3 | User-configurable model mappings | Settings for which model maps to which tier |
| P4 | Confidence display | Show the heuristic confidence score in the routing tooltip |
| P5 | Monthly savings summary | Dashboard shows "saved X premium requests this month" |
| P6 | Output channel logging | All routing decisions logged to a VSCode Output channel for debugging |
| P7 | Classifier feedback | Thumbs up/down on each routed response to improve heuristic weights |

---

## 2. Tech Stack — Final Decisions

### 2.1 Extension Host (Node.js process)

| Layer | Technology | Version | Reason |
|-------|-----------|---------|--------|
| Language | TypeScript | 5.4+ | Type safety, VSCode API types |
| Runtime | Node.js via VSCode | 18+ | Extension host environment |
| VSCode API | `@types/vscode` | 1.90+ | Minimum for stable `vscode.lm` |
| Bundler | esbuild | latest | Fast, Node.js target, small output |
| Model access | `vscode.lm` API | stable | Direct Copilot model access |
| Chat registration | `vscode.chat` API | stable | Register as `@router` participant |

### 2.2 WebView UI (Chromium sandbox)

| Layer | Technology | Version | Reason |
|-------|-----------|---------|--------|
| Framework | React | 18 | Reactive dashboard, ecosystem |
| Language | TypeScript | 5.4+ | Shared types with extension host |
| Bundler | Vite | 5.x | Fast HMR, browser target |
| Styling | Inline styles + CSS vars | — | No build step needed for styles, uses VSCode theme variables |

### 2.3 Critical Architecture Rule

The extension has **two completely isolated runtime environments**:

1. **Extension Host** — Node.js. Has `vscode.*` APIs. Never has `window`, `document`, or browser globals.
2. **WebView** — Chromium iframe. Has browser APIs. Never has `vscode.*` APIs directly.

They communicate **exclusively** via structured message passing:
- Extension Host → WebView: `panel.webview.postMessage(msg)`
- WebView → Extension Host: `vscode.postMessage(msg)` (using `acquireVsCodeApi()`)

Any code that tries to use `vscode.*` in the WebView, or `document.*` in the extension host, will fail silently or crash. Keep them strictly separated.

---

## 3. Complete Repository Structure

Generate every file listed below. Do not skip any file.

```
copilot-router/
├── package.json
├── tsconfig.json
├── tsconfig.webview.json
├── .eslintrc.json
├── .vscodeignore
├── .gitignore
├── README.md
│
├── src/
│   ├── extension.ts
│   ├── shared/
│   │   └── types.ts
│   ├── classifier/
│   │   ├── heuristicScorer.ts
│   │   ├── llmClassifier.ts
│   │   ├── hybridClassifier.ts
│   │   └── prompts.ts
│   ├── router/
│   │   ├── router.ts
│   │   ├── modelRegistry.ts
│   │   └── budgetAwareness.ts
│   ├── budget/
│   │   └── budgetTracker.ts
│   ├── log/
│   │   └── routingLog.ts
│   ├── statusBar/
│   │   └── statusBarItem.ts
│   ├── webview/
│   │   └── webviewProvider.ts
│   └── config/
│       └── settings.ts
│
├── webview-ui/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── index.tsx
│       ├── App.tsx
│       ├── vscode.ts
│       └── components/
│           ├── BudgetGauge.tsx
│           ├── RoutingLog.tsx
│           └── SettingsPanel.tsx
│
├── media/
│   └── icon.png          ← 128×128 PNG, plain coloured square placeholder is fine
│
└── test/
    ├── suite/
    │   ├── heuristicScorer.test.ts
    │   ├── hybridClassifier.test.ts
    │   ├── budgetAwareness.test.ts
    │   └── budgetTracker.test.ts
    └── runTests.ts
```

---

## 4. Shared Types Contract

This file is imported by both the extension host and the WebView UI. It defines the message protocol and all shared interfaces. Generate this first — every other file depends on it.

**File: `src/shared/types.ts`**

```typescript
// ─── Complexity Tiers ──────────────────────────────────────────────────────
export type ComplexityTier = 'trivial' | 'moderate' | 'complex';

// ─── Classification Result ─────────────────────────────────────────────────
export interface ClassificationResult {
  tier: ComplexityTier;
  confidence: number;          // 0.0 – 1.0
  method: 'heuristic' | 'llm' | 'hybrid';
  signals: HeuristicSignals;   // always populated, even for LLM path
}

export interface HeuristicSignals {
  tokenCount: number;
  hasArchitectureKeywords: boolean;
  hasDebuggingKeywords: boolean;
  hasMultiFileKeywords: boolean;
  hasTrivialKeywords: boolean;
  codeBlockCount: number;
  questionMarkCount: number;
  rawScore: number;            // 0–100 before normalisation
  confidence: number;          // 0.0–1.0
}

// ─── Routing Entry (one per dispatched query) ──────────────────────────────
export interface RoutingEntry {
  id: string;
  timestamp: number;
  querySnippet: string;        // first 80 chars only
  rawTier: ComplexityTier;     // before budget pressure
  finalTier: ComplexityTier;   // after budget pressure
  modelChosen: string;
  classificationMethod: 'heuristic' | 'llm' | 'hybrid';
  confidence: number;
  savedMultiplier: number;     // cost units saved vs always using Opus (3×)
  budgetUsedAtTime: number;
}

// ─── Settings ──────────────────────────────────────────────────────────────
export interface RouterSettings {
  trivialModel: string;
  moderateModel: string;
  complexModel: string;
  budgetLimit: number;
  autoTightenAt: number;       // percentage 0–100
  llmFallbackThreshold: number; // confidence below which LLM is called (default 0.70)
  enabled: boolean;
}

// ─── Host → WebView Messages ───────────────────────────────────────────────
export type HostMessage =
  | { type: 'budgetUpdate'; used: number; total: number; percent: number }
  | { type: 'logUpdate'; entries: RoutingEntry[] }
  | { type: 'settingsUpdate'; settings: RouterSettings }
  | { type: 'classifierStatus'; ready: boolean };

// ─── WebView → Host Messages ───────────────────────────────────────────────
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'resetBudget' }
  | { type: 'updateSettings'; settings: Partial<RouterSettings> }
  | { type: 'clearLog' }
  | { type: 'requestFullState' };

// ─── Model Info ────────────────────────────────────────────────────────────
export interface ModelInfo {
  family: string;
  displayName: string;
  costMultiplier: number;  // 0 = free, 1 = standard, 3 = premium
  tier: ComplexityTier;
}
```

---

## 5. The Hybrid Classifier — Full Specification

This is the most important component. Read this section completely before writing any classifier code.

### 5.1 Architecture Decision

The hybrid approach runs two stages:

```
Every query
    │
    ▼
[Stage 1] Heuristic Scorer
    • Pure TypeScript, runs in < 2ms
    • No network call, no API cost
    • Returns: { tier, confidence: 0.0–1.0, signals }
    │
    ├─ confidence >= 0.70 ──► Use heuristic result directly
    │
    └─ confidence < 0.70 ──► [Stage 2] LLM Tiebreaker
                                  • GPT-5 mini call (0× cost multiplier)
                                  • Tight prompt, expects one-word response
                                  • 300ms timeout, fallback to heuristic on failure
                                  │
                                  └──► Final tier
```

This means ~80–85% of queries never touch the network for classification. Only genuinely ambiguous queries (short phrasing on potentially complex topics) trigger the LLM call.

### 5.2 Heuristic Scorer

**File: `src/classifier/heuristicScorer.ts`**

The heuristic scorer assigns a raw score from 0–100 based on weighted signals, then maps to a tier. It also computes a confidence score that represents how unambiguous the classification is.

```typescript
import { ComplexityTier, HeuristicSignals, ClassificationResult } from '../shared/types';

// ─── Keyword Banks ─────────────────────────────────────────────────────────

const TRIVIAL_KEYWORDS = [
  'what does', 'what is', 'what are', 'how do i', 'syntax', 'meaning',
  'define', 'definition', 'example of', 'typo', 'spelling', 'rename',
  'format', 'indent', 'comment out', 'uncomment', '?? operator',
  'shorthand', 'quick fix', 'simple fix', 'one liner', 'one-liner',
];

const MODERATE_KEYWORDS = [
  'implement', 'write a function', 'create a class', 'add a method',
  'write tests', 'unit test', 'explain this', 'how does this work',
  'refactor this function', 'optimize this', 'fix this bug', 'debug',
  'parse', 'validate', 'convert', 'transform', 'handle error',
];

const COMPLEX_KEYWORDS = [
  'architecture', 'system design', 'redesign', 'restructure', 'migrate',
  'distributed', 'microservice', 'scalab', 'performance bottleneck',
  'race condition', 'concurren', 'multi-thread', 'async pattern',
  'design pattern', 'dependency injection', 'how should i structure',
  'best approach for', 'tradeoffs', 'trade-offs', 'across files',
  'across the codebase', 'entire project', 'monorepo',
];

const DEBUGGING_KEYWORDS = [
  'why is', 'why does', 'not working', "doesn't work", 'broken',
  'error', 'exception', 'crash', 'undefined', 'null pointer',
  'stack trace', 'unexpected behaviour', 'wrong output',
];

const MULTI_FILE_KEYWORDS = [
  'across files', 'multiple files', 'entire codebase', 'all files',
  'project-wide', 'global', 'dependency', 'import chain',
];

const ARCHITECTURE_KEYWORDS = [
  'architect', 'design', 'structure', 'pattern', 'scalab', 'system',
  'service', 'module', 'layer', 'abstraction', 'coupling', 'cohesion',
];

// ─── Scorer ────────────────────────────────────────────────────────────────

export function heuristicScore(query: string): ClassificationResult {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);
  const tokenCount = words.length;

  // ── Signal detection ──
  const hasTrivialKeywords    = TRIVIAL_KEYWORDS.some(k => q.includes(k));
  const hasModerateKeywords   = MODERATE_KEYWORDS.some(k => q.includes(k));
  const hasComplexKeywords    = COMPLEX_KEYWORDS.some(k => q.includes(k));
  const hasDebuggingKeywords  = DEBUGGING_KEYWORDS.some(k => q.includes(k));
  const hasMultiFileKeywords  = MULTI_FILE_KEYWORDS.some(k => q.includes(k));
  const hasArchKeywords       = ARCHITECTURE_KEYWORDS.some(k => q.includes(k));
  const codeBlockCount        = (query.match(/```/g) || []).length / 2;
  const questionMarkCount     = (query.match(/\?/g) || []).length;

  // ── Raw score: 0 = trivial, 100 = complex ──
  let score = 40; // neutral start

  // Token count signal
  if (tokenCount <= 6)  score -= 20;
  if (tokenCount <= 12) score -= 10;
  if (tokenCount >= 30) score += 10;
  if (tokenCount >= 60) score += 20;

  // Keyword signals
  if (hasTrivialKeywords)   score -= 25;
  if (hasModerateKeywords)  score += 10;
  if (hasComplexKeywords)   score += 35;
  if (hasDebuggingKeywords) score += 15;
  if (hasMultiFileKeywords) score += 25;
  if (hasArchKeywords)      score += 20;

  // Code block signals (pasting a large snippet → moderate/complex)
  if (codeBlockCount >= 1)  score += 10;
  if (codeBlockCount >= 2)  score += 15;

  // Single question mark with short query → likely trivial lookup
  if (questionMarkCount === 1 && tokenCount <= 10) score -= 10;

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // ── Tier mapping ──
  let tier: ComplexityTier;
  if (score <= 35)       tier = 'trivial';
  else if (score <= 65)  tier = 'moderate';
  else                   tier = 'complex';

  // ── Confidence: how far from the decision boundaries? ──
  // Boundaries are at 35 and 65. Max distance from nearest boundary = 35 points.
  let distanceFromBoundary: number;
  if (score <= 35)      distanceFromBoundary = 35 - score;
  else if (score >= 65) distanceFromBoundary = score - 65;
  else                  distanceFromBoundary = Math.min(score - 35, 65 - score);

  const confidence = Math.min(1.0, 0.5 + (distanceFromBoundary / 35) * 0.5);

  const signals: HeuristicSignals = {
    tokenCount,
    hasArchitectureKeywords: hasArchKeywords,
    hasDebuggingKeywords,
    hasMultiFileKeywords,
    hasTrivialKeywords,
    codeBlockCount,
    questionMarkCount,
    rawScore: score,
    confidence,
  };

  return {
    tier,
    confidence,
    method: 'heuristic',
    signals,
  };
}
```

### 5.3 LLM Classifier (Tiebreaker)

**File: `src/classifier/prompts.ts`**

```typescript
export const CLASSIFIER_SYSTEM_PROMPT = `
You are a one-word query complexity classifier for a coding assistant.
Classify the coding query into exactly one of three tiers.

TRIVIAL: Single lookups, syntax questions, "what does X mean", typo fixes, 
rename a variable, explain one short concept, autocomplete-style completions.

MODERATE: Implementing a function or class, writing unit tests, explaining how
a module works, fixing a single-file bug, refactoring one function, 
adding error handling, writing a parser.

COMPLEX: Multi-file refactoring, system architecture decisions, distributed 
system debugging, design pattern decisions, performance bottleneck analysis,
restructuring an entire service, race condition debugging.

RESPOND WITH EXACTLY ONE WORD. No punctuation. No explanation. No newline after.
One of: trivial  moderate  complex

EXAMPLES:
what does the nullish coalescing operator do → trivial
fix the typo in this variable name → trivial
implement binary search → moderate  
write tests for this auth service → moderate
how should I redesign my microservice to avoid the N+1 problem → complex
debug why my distributed cache has race conditions under load → complex
`.trim();
```

**File: `src/classifier/llmClassifier.ts`**

```typescript
import * as vscode from 'vscode';
import { ComplexityTier, ClassificationResult, HeuristicSignals } from '../shared/types';
import { CLASSIFIER_SYSTEM_PROMPT } from './prompts';

const TIMEOUT_MS = 350;
const FALLBACK_TIER: ComplexityTier = 'moderate';

export class LLMClassifier {
  private model: vscode.LanguageModelChat | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    try {
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o-mini',
      });
      if (models.length > 0) {
        this.model = models[0];
      }
    } catch {
      // Non-fatal — hybrid will fall back to heuristic result
      this.model = null;
    }
  }

  async classify(
    query: string,
    heuristicSignals: HeuristicSignals
  ): Promise<ClassificationResult> {
    if (!this.model) {
      await this.initialize();
    }

    if (!this.model) {
      return {
        tier: FALLBACK_TIER,
        confidence: 0.5,
        method: 'heuristic',
        signals: heuristicSignals,
      };
    }

    const prompt = `${CLASSIFIER_SYSTEM_PROMPT}\n\nQuery: "${query.slice(0, 600)}"`;
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    const cts = new vscode.CancellationTokenSource();

    // Hard timeout — never hold up the user
    const timeoutId = setTimeout(() => cts.cancel(), TIMEOUT_MS);

    try {
      const response = await this.model.sendRequest(
        messages,
        { justification: 'Classifying query complexity for model routing' },
        cts.token
      );

      let result = '';
      for await (const chunk of response.text) {
        result += chunk;
        if (result.length > 20) break; // we only need one word
      }

      clearTimeout(timeoutId);

      const word = result.trim().toLowerCase().split(/\s+/)[0];
      const validTiers: ComplexityTier[] = ['trivial', 'moderate', 'complex'];

      if (validTiers.includes(word as ComplexityTier)) {
        return {
          tier: word as ComplexityTier,
          confidence: 0.92, // LLM result — high confidence
          method: 'llm',
          signals: heuristicSignals,
        };
      }

      // Unexpected output — fall back
      return {
        tier: FALLBACK_TIER,
        confidence: 0.5,
        method: 'heuristic',
        signals: heuristicSignals,
      };

    } catch {
      clearTimeout(timeoutId);
      return {
        tier: FALLBACK_TIER,
        confidence: 0.5,
        method: 'heuristic',
        signals: heuristicSignals,
      };
    }
  }
}
```

### 5.4 Hybrid Classifier (Orchestrator)

**File: `src/classifier/hybridClassifier.ts`**

```typescript
import { ClassificationResult } from '../shared/types';
import { heuristicScore } from './heuristicScorer';
import { LLMClassifier } from './llmClassifier';
import { getSettings } from '../config/settings';

export class HybridClassifier {
  private llm = new LLMClassifier();

  async initialize(): Promise<void> {
    // Pre-warm the LLM model handle so first call is faster
    await this.llm.initialize();
  }

  async classify(query: string): Promise<ClassificationResult> {
    const settings = getSettings();

    // Stage 1: Heuristic (always runs, always fast)
    const heuristicResult = heuristicScore(query);

    // Stage 2: LLM tiebreaker (only if confidence is below threshold)
    if (heuristicResult.confidence < settings.llmFallbackThreshold) {
      const llmResult = await this.llm.classify(query, heuristicResult.signals);
      return {
        ...llmResult,
        method: 'hybrid',
        signals: heuristicResult.signals, // keep heuristic signals for logging
      };
    }

    return heuristicResult;
  }
}
```

---

## 6. Model Registry & Budget Awareness

**File: `src/router/modelRegistry.ts`**

```typescript
import { ModelInfo, ComplexityTier } from '../shared/types';

export const MODEL_REGISTRY: ModelInfo[] = [
  { family: 'gpt-4o-mini',   displayName: 'GPT-5 mini',   costMultiplier: 0, tier: 'trivial'  },
  { family: 'gpt-4o',        displayName: 'GPT-4.1',      costMultiplier: 1, tier: 'moderate' },
  { family: 'claude-sonnet', displayName: 'Sonnet 4.5',   costMultiplier: 1, tier: 'moderate' },
  { family: 'claude-opus',   displayName: 'Claude Opus',  costMultiplier: 3, tier: 'complex'  },
];

export function getModelForTier(
  tier: ComplexityTier,
  trivialFamily: string,
  moderateFamily: string,
  complexFamily: string
): string {
  switch (tier) {
    case 'trivial':  return trivialFamily;
    case 'moderate': return moderateFamily;
    case 'complex':  return complexFamily;
  }
}

export function getCostMultiplier(family: string): number {
  return MODEL_REGISTRY.find(m => m.family === family)?.costMultiplier ?? 1;
}
```

**File: `src/router/budgetAwareness.ts`**

```typescript
import { ComplexityTier } from '../shared/types';

/**
 * Demotes the routing tier when budget pressure is high.
 * Returns the adjusted tier and a flag indicating if demotion occurred.
 */
export function applyBudgetPressure(
  tier: ComplexityTier,
  budgetUsedPercent: number,
  tightenAt: number
): { tier: ComplexityTier; demoted: boolean } {
  if (budgetUsedPercent < tightenAt) {
    return { tier, demoted: false };
  }

  // Emergency mode: 95%+ → everything goes to free tier
  if (budgetUsedPercent >= 95) {
    return { tier: 'trivial', demoted: tier !== 'trivial' };
  }

  // Tighten mode: demote one level
  if (tier === 'complex')  return { tier: 'moderate', demoted: true };
  if (tier === 'moderate') return { tier: 'trivial',  demoted: true };
  return { tier: 'trivial', demoted: false };
}
```

---

## 7. Budget Tracker

**File: `src/budget/budgetTracker.ts`**

```typescript
import * as vscode from 'vscode';
import { getSettings } from '../config/settings';

const KEY_USED  = 'copilotRouter.budgetUsed';
const KEY_MONTH = 'copilotRouter.budgetMonth';

export class BudgetTracker {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private ctx: vscode.ExtensionContext) {
    this.checkMonthlyReset();
  }

  private checkMonthlyReset(): void {
    const currentMonth = this.getCurrentMonth();
    const storedMonth  = this.ctx.globalState.get<string>(KEY_MONTH);
    if (storedMonth !== currentMonth) {
      this.ctx.globalState.update(KEY_USED, 0);
      this.ctx.globalState.update(KEY_MONTH, currentMonth);
    }
  }

  private getCurrentMonth(): string {
    return new Date().toISOString().slice(0, 7); // "2025-03"
  }

  getUsed(): number {
    this.checkMonthlyReset();
    return this.ctx.globalState.get<number>(KEY_USED, 0);
  }

  getTotal(): number {
    return getSettings().budgetLimit;
  }

  getUsedPercent(): number {
    const total = this.getTotal();
    if (total === 0) return 0;
    return Math.round((this.getUsed() / total) * 100);
  }

  increment(): void {
    const next = this.getUsed() + 1;
    this.ctx.globalState.update(KEY_USED, next);
    this._onDidChange.fire();
  }

  reset(): void {
    this.ctx.globalState.update(KEY_USED, 0);
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
```

---

## 8. Routing Log

**File: `src/log/routingLog.ts`**

```typescript
import * as vscode from 'vscode';
import { RoutingEntry } from '../shared/types';

const KEY = 'copilotRouter.routingLog';
const MAX = 200;

export class RoutingLog {
  private _onDidChange = new vscode.EventEmitter<RoutingEntry[]>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private ctx: vscode.ExtensionContext) {}

  add(entry: RoutingEntry): void {
    const log = this.getAll();
    log.unshift(entry);
    if (log.length > MAX) log.splice(MAX);
    this.ctx.globalState.update(KEY, log);
    this._onDidChange.fire(log);
  }

  getAll(): RoutingEntry[] {
    return this.ctx.globalState.get<RoutingEntry[]>(KEY, []);
  }

  clear(): void {
    this.ctx.globalState.update(KEY, []);
    this._onDidChange.fire([]);
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
```

---

## 9. Settings Reader

**File: `src/config/settings.ts`**

```typescript
import * as vscode from 'vscode';
import { RouterSettings } from '../shared/types';

export function getSettings(): RouterSettings {
  const cfg = vscode.workspace.getConfiguration('copilotRouter');
  return {
    trivialModel:           cfg.get<string>('trivialModel',           'gpt-4o-mini'),
    moderateModel:          cfg.get<string>('moderateModel',          'gpt-4o'),
    complexModel:           cfg.get<string>('complexModel',           'claude-opus'),
    budgetLimit:            cfg.get<number>('budgetLimit',            300),
    autoTightenAt:          cfg.get<number>('autoTightenAt',          80),
    llmFallbackThreshold:   cfg.get<number>('llmFallbackThreshold',   0.70),
    enabled:                cfg.get<boolean>('enabled',               true),
  };
}
```

---

## 10. Router Core

**File: `src/router/router.ts`**

```typescript
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { HybridClassifier } from '../classifier/hybridClassifier';
import { BudgetTracker } from '../budget/budgetTracker';
import { RoutingLog } from '../log/routingLog';
import { applyBudgetPressure } from './budgetAwareness';
import { getModelForTier, getCostMultiplier } from './modelRegistry';
import { getSettings } from '../config/settings';
import { RoutingEntry } from '../shared/types';

export class Router {
  private classifier = new HybridClassifier();
  private outputChannel: vscode.OutputChannel;

  constructor(
    private ctx: vscode.ExtensionContext,
    private budget: BudgetTracker,
    private log: RoutingLog
  ) {
    this.outputChannel = vscode.window.createOutputChannel('CopilotRouter');
    ctx.subscriptions.push(this.outputChannel);
  }

  async activate(): Promise<void> {
    // Pre-warm classifier in background
    this.classifier.initialize().catch(() => {});
    this.registerChatParticipant();
  }

  private registerChatParticipant(): void {
    const participant = vscode.chat.createChatParticipant(
      'copilot-router.router',
      async (request, _context, response, token) => {
        await this.handleRequest(request.prompt, response, token);
      }
    );

    participant.iconPath = vscode.Uri.joinPath(
      this.ctx.extensionUri, 'media', 'icon.png'
    );

    this.ctx.subscriptions.push(participant);
    this.log_('CopilotRouter activated. Chat participant @router registered.');
  }

  private async handleRequest(
    query: string,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    if (!getSettings().enabled) {
      response.markdown('CopilotRouter is disabled. Enable it in settings.');
      return;
    }

    const settings = getSettings();

    // ── 1. Classify ──────────────────────────────────────────────────────
    const classification = await this.classifier.classify(query);
    const rawTier = classification.tier;

    // ── 2. Apply budget pressure ─────────────────────────────────────────
    const budgetPercent = this.budget.getUsedPercent();
    const { tier: finalTier, demoted } = applyBudgetPressure(
      rawTier,
      budgetPercent,
      settings.autoTightenAt
    );

    // ── 3. Select model ───────────────────────────────────────────────────
    const targetFamily = getModelForTier(
      finalTier,
      settings.trivialModel,
      settings.moderateModel,
      settings.complexModel
    );

    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: targetFamily,
    });

    if (models.length === 0) {
      response.markdown(
        `⚠️ **CopilotRouter**: Model family \`${targetFamily}\` is unavailable. ` +
        `Check that GitHub Copilot is active and the model is enabled.`
      );
      return;
    }

    const model = models[0];

    // ── 4. Forward request and stream response ────────────────────────────
    const messages = [vscode.LanguageModelChatMessage.User(query)];

    try {
      const modelResponse = await model.sendRequest(messages, {}, token);
      for await (const chunk of modelResponse.text) {
        if (token.isCancellationRequested) break;
        response.markdown(chunk);
      }
    } catch (err) {
      if (!token.isCancellationRequested) {
        response.markdown(`\n\n⚠️ **CopilotRouter**: Model error — ${String(err)}`);
      }
      return;
    }

    // ── 5. Compute savings ────────────────────────────────────────────────
    const opusCost = 3;
    const chosenCost = getCostMultiplier(targetFamily);
    const savedMultiplier = opusCost - chosenCost;

    // ── 6. Update budget and log ──────────────────────────────────────────
    this.budget.increment();

    const entry: RoutingEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      querySnippet: query.slice(0, 80),
      rawTier,
      finalTier,
      modelChosen: model.name,
      classificationMethod: classification.method,
      confidence: classification.confidence,
      savedMultiplier,
      budgetUsedAtTime: this.budget.getUsed(),
    };

    this.log.add(entry);

    // ── 7. Routing tooltip ────────────────────────────────────────────────
    const demotedNote = demoted ? ` *(budget pressure: ${rawTier}→${finalTier})*` : '';
    const methodNote = classification.method === 'hybrid'
      ? `hybrid·${Math.round(classification.confidence * 100)}%`
      : classification.method;

    response.markdown(
      `\n\n---\n*🔀 **${model.name}** · ${finalTier} · ${methodNote}${demotedNote} · saved **${savedMultiplier}×***`
    );

    // ── 8. Output channel log ─────────────────────────────────────────────
    this.log_(
      `[ROUTE] "${query.slice(0, 60)}" → ${finalTier} → ${model.name} ` +
      `(conf: ${classification.confidence.toFixed(2)}, method: ${classification.method}, ` +
      `budget: ${this.budget.getUsed()}/${this.budget.getTotal()})`
    );
  }

  private log_(msg: string): void {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] ${msg}`);
  }
}
```

---

## 11. Status Bar

**File: `src/statusBar/statusBarItem.ts`**

```typescript
import * as vscode from 'vscode';
import { BudgetTracker } from '../budget/budgetTracker';

export class StatusBarManager {
  private item: vscode.StatusBarItem;

  constructor(
    private ctx: vscode.ExtensionContext,
    private budget: BudgetTracker
  ) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = 'copilotRouter.openDashboard';
    ctx.subscriptions.push(this.item);
  }

  activate(): void {
    this.refresh();
    this.budget.onDidChange(() => this.refresh(), null, this.ctx.subscriptions);
    this.item.show();
  }

  refresh(): void {
    const used    = this.budget.getUsed();
    const total   = this.budget.getTotal();
    const percent = this.budget.getUsedPercent();

    this.item.text = `⚡ ${used}/${total}`;

    if (percent >= 95) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.item.tooltip = `CopilotRouter: CRITICAL — ${percent}% budget used. All queries → free tier.`;
    } else if (percent >= 80) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.item.tooltip = `CopilotRouter: ${percent}% budget used. Routing tightened.`;
    } else {
      this.item.backgroundColor = undefined;
      this.item.tooltip = `CopilotRouter: ${used}/${total} requests this month. Click to open dashboard.`;
    }
  }
}
```

---

## 12. WebView Provider

**File: `src/webview/webviewProvider.ts`**

```typescript
import * as vscode from 'vscode';
import { BudgetTracker } from '../budget/budgetTracker';
import { RoutingLog } from '../log/routingLog';
import { getSettings } from '../config/settings';
import { HostMessage, WebviewMessage } from '../shared/types';

export class WebviewProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private ctx: vscode.ExtensionContext,
    private budget: BudgetTracker,
    private log: RoutingLog
  ) {
    // Push state whenever budget or log changes
    budget.onDidChange(() => this.pushBudget(), null, ctx.subscriptions);
    log.onDidChange(() => this.pushLog(), null, ctx.subscriptions);
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'copilotRouterDashboard',
      'CopilotRouter',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.ctx.extensionUri, 'out', 'webview'),
        ],
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = this.buildHtml();

    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => this.handleMessage(msg),
      null,
      this.ctx.subscriptions
    );

    this.panel.onDidDispose(() => { this.panel = undefined; });

    // Push initial full state after a tick (WebView needs to load first)
    setTimeout(() => this.pushFullState(), 300);
  }

  private handleMessage(msg: WebviewMessage): void {
    switch (msg.type) {
      case 'ready':
      case 'requestFullState':
        this.pushFullState();
        break;
      case 'resetBudget':
        this.budget.reset();
        break;
      case 'clearLog':
        this.log.clear();
        break;
      case 'updateSettings':
        // Write each changed setting back to workspace config
        const cfg = vscode.workspace.getConfiguration('copilotRouter');
        for (const [key, val] of Object.entries(msg.settings)) {
          cfg.update(key, val, vscode.ConfigurationTarget.Global);
        }
        this.pushSettings();
        break;
    }
  }

  private post(msg: HostMessage): void {
    this.panel?.webview.postMessage(msg);
  }

  private pushBudget(): void {
    this.post({
      type: 'budgetUpdate',
      used: this.budget.getUsed(),
      total: this.budget.getTotal(),
      percent: this.budget.getUsedPercent(),
    });
  }

  private pushLog(): void {
    this.post({ type: 'logUpdate', entries: this.log.getAll() });
  }

  private pushSettings(): void {
    this.post({ type: 'settingsUpdate', settings: getSettings() });
  }

  private pushFullState(): void {
    this.pushBudget();
    this.pushLog();
    this.pushSettings();
  }

  private buildHtml(): string {
    const wv = this.panel!.webview;
    const scriptUri = wv.asWebviewUri(
      vscode.Uri.joinPath(this.ctx.extensionUri, 'out', 'webview', 'index.js')
    );
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src ${wv.cspSource}; style-src 'unsafe-inline';" />
  <title>CopilotRouter</title>
</head>
<body style="margin:0;padding:0;background:var(--vscode-editor-background)">
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
```

---

## 13. Extension Entry Point

**File: `src/extension.ts`**

```typescript
import * as vscode from 'vscode';
import { Router } from './router/router';
import { BudgetTracker } from './budget/budgetTracker';
import { RoutingLog } from './log/routingLog';
import { StatusBarManager } from './statusBar/statusBarItem';
import { WebviewProvider } from './webview/webviewProvider';

export function activate(context: vscode.ExtensionContext): void {
  const budget  = new BudgetTracker(context);
  const log     = new RoutingLog(context);
  const router  = new Router(context, budget, log);
  const status  = new StatusBarManager(context, budget);
  const webview = new WebviewProvider(context, budget, log);

  context.subscriptions.push(
    vscode.commands.registerCommand('copilotRouter.openDashboard', () => {
      webview.show();
    }),
    vscode.commands.registerCommand('copilotRouter.resetBudget', () => {
      budget.reset();
      vscode.window.showInformationMessage('CopilotRouter: Budget counter reset.');
    }),
    vscode.commands.registerCommand('copilotRouter.toggleEnabled', () => {
      const cfg = vscode.workspace.getConfiguration('copilotRouter');
      const current = cfg.get<boolean>('enabled', true);
      cfg.update('enabled', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `CopilotRouter: ${!current ? 'Enabled' : 'Disabled'}.`
      );
    })
  );

  router.activate();
  status.activate();
}

export function deactivate(): void {}
```

---

## 14. React WebView UI

### 14.1 VSCode API Bridge

**File: `webview-ui/src/vscode.ts`**

```typescript
// This file bridges the WebView sandbox to the VSCode postMessage API.
// acquireVsCodeApi() can only be called once per WebView lifetime.

import type { WebviewMessage } from '../../src/shared/types';

interface VsCodeApi {
  postMessage(msg: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let _api: VsCodeApi | undefined;

export function getVsCode(): VsCodeApi {
  if (!_api) {
    _api = acquireVsCodeApi();
  }
  return _api;
}

export function postMessage(msg: WebviewMessage): void {
  getVsCode().postMessage(msg);
}
```

### 14.2 Budget Gauge Component

**File: `webview-ui/src/components/BudgetGauge.tsx`**

```tsx
interface Props {
  used: number;
  total: number;
  percent: number;
  onReset: () => void;
}

export function BudgetGauge({ used, total, percent, onReset }: Props) {
  const color = percent >= 95 ? 'var(--vscode-errorForeground)'
              : percent >= 80 ? 'var(--vscode-editorWarning-foreground)'
              : 'var(--vscode-terminal-ansiGreen)';

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 11, letterSpacing: 2, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' }}>
          Monthly Budget
        </span>
        <span style={{ fontSize: 22, fontWeight: 700, color }}>
          {used} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--vscode-descriptionForeground)' }}>/ {total}</span>
        </span>
      </div>

      {/* Track */}
      <div style={{
        height: 6,
        background: 'var(--vscode-widget-border)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(percent, 100)}%`,
          background: color,
          borderRadius: 3,
          transition: 'width 0.4s ease',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
          {100 - percent}% remaining
        </span>
        <button
          onClick={onReset}
          style={{
            fontSize: 11,
            padding: '3px 10px',
            background: 'transparent',
            border: '1px solid var(--vscode-widget-border)',
            color: 'var(--vscode-foreground)',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>

      {percent >= 80 && (
        <div style={{
          marginTop: 10,
          padding: '7px 12px',
          background: percent >= 95
            ? 'var(--vscode-inputValidation-errorBackground)'
            : 'var(--vscode-inputValidation-warningBackground)',
          border: `1px solid ${percent >= 95
            ? 'var(--vscode-inputValidation-errorBorder)'
            : 'var(--vscode-inputValidation-warningBorder)'}`,
          borderRadius: 4,
          fontSize: 12,
          color: 'var(--vscode-foreground)',
        }}>
          {percent >= 95
            ? '🚨 Critical: All queries routed to free tier.'
            : `⚠️  Routing tightened — complex queries demoted one tier.`}
        </div>
      )}
    </div>
  );
}
```

### 14.3 Routing Log Table

**File: `webview-ui/src/components/RoutingLog.tsx`**

```tsx
import { RoutingEntry } from '../../../src/shared/types';

interface Props {
  entries: RoutingEntry[];
  onClear: () => void;
}

const TIER_COLOR: Record<string, string> = {
  trivial:  'var(--vscode-terminal-ansiGreen)',
  moderate: 'var(--vscode-terminal-ansiYellow)',
  complex:  'var(--vscode-terminal-ansiRed)',
};

export function RoutingLog({ entries, onClear }: Props) {
  if (entries.length === 0) {
    return (
      <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, padding: '20px 0' }}>
        No routing decisions yet. Use <code>@router</code> in Copilot Chat to get started.
      </div>
    );
  }

  const totalSaved = entries.reduce((acc, e) => acc + e.savedMultiplier, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, letterSpacing: 2, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' }}>
          Routing Log · {entries.length} decisions · {totalSaved}× saved
        </span>
        <button onClick={onClear} style={{
          fontSize: 11, padding: '3px 10px',
          background: 'transparent',
          border: '1px solid var(--vscode-widget-border)',
          color: 'var(--vscode-descriptionForeground)',
          borderRadius: 3, cursor: 'pointer',
        }}>Clear</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {entries.slice(0, 50).map(entry => (
          <div key={entry.id} style={{
            display: 'grid',
            gridTemplateColumns: '70px 1fr 80px 90px 40px',
            gap: 8,
            padding: '6px 10px',
            background: 'var(--vscode-editor-inactiveSelectionBackground)',
            borderRadius: 3,
            fontSize: 11,
            alignItems: 'center',
          }}>
            {/* Tier badge */}
            <span style={{
              color: TIER_COLOR[entry.finalTier],
              fontWeight: 600,
              letterSpacing: 1,
            }}>
              {entry.finalTier}
              {entry.rawTier !== entry.finalTier && (
                <span style={{ color: 'var(--vscode-descriptionForeground)', fontWeight: 400 }}>
                  {' '}↓
                </span>
              )}
            </span>

            {/* Query snippet */}
            <span style={{
              color: 'var(--vscode-foreground)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {entry.querySnippet}
            </span>

            {/* Model */}
            <span style={{ color: 'var(--vscode-descriptionForeground)', textAlign: 'right' }}>
              {entry.modelChosen.split('-')[0]}
            </span>

            {/* Method */}
            <span style={{ color: 'var(--vscode-descriptionForeground)', textAlign: 'right' }}>
              {entry.classificationMethod}·{Math.round(entry.confidence * 100)}%
            </span>

            {/* Savings */}
            <span style={{
              color: entry.savedMultiplier > 0 ? 'var(--vscode-terminal-ansiGreen)' : 'var(--vscode-descriptionForeground)',
              textAlign: 'right',
              fontWeight: entry.savedMultiplier > 0 ? 600 : 400,
            }}>
              {entry.savedMultiplier > 0 ? `+${entry.savedMultiplier}×` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 14.4 Root App Component

**File: `webview-ui/src/App.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { BudgetGauge } from './components/BudgetGauge';
import { RoutingLog } from './components/RoutingLog';
import { postMessage } from './vscode';
import type { HostMessage, RouterSettings, RoutingEntry } from '../../src/shared/types';

export default function App() {
  const [budget, setBudget] = useState({ used: 0, total: 300, percent: 0 });
  const [entries, setEntries] = useState<RoutingEntry[]>([]);
  const [settings, setSettings] = useState<RouterSettings | null>(null);

  useEffect(() => {
    postMessage({ type: 'ready' });

    const handler = (event: MessageEvent<HostMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'budgetUpdate':
          setBudget({ used: msg.used, total: msg.total, percent: msg.percent });
          break;
        case 'logUpdate':
          setEntries(msg.entries);
          break;
        case 'settingsUpdate':
          setSettings(msg.settings);
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const containerStyle: React.CSSProperties = {
    padding: '20px 24px',
    fontFamily: 'var(--vscode-font-family)',
    fontSize: 'var(--vscode-font-size)',
    color: 'var(--vscode-foreground)',
    maxWidth: 700,
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: 32,
    paddingBottom: 32,
    borderBottom: '1px solid var(--vscode-widget-border)',
  };

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: -0.3 }}>
          ⚡ CopilotRouter
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>
          Intelligent model routing · Hybrid classifier
        </p>
      </div>

      <div style={sectionStyle}>
        <BudgetGauge
          used={budget.used}
          total={budget.total}
          percent={budget.percent}
          onReset={() => postMessage({ type: 'resetBudget' })}
        />
      </div>

      <div>
        <RoutingLog
          entries={entries}
          onClear={() => postMessage({ type: 'clearLog' })}
        />
      </div>
    </div>
  );
}
```

### 14.5 WebView Entry Point

**File: `webview-ui/src/index.tsx`**

```tsx
import { createRoot } from 'react-dom/client';
import App from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

---

## 15. Configuration Files

### 15.1 Root `package.json`

```json
{
  "name": "copilot-router",
  "displayName": "CopilotRouter",
  "description": "Intelligent model routing for GitHub Copilot — stop burning premium requests on simple questions.",
  "version": "0.1.0",
  "publisher": "YOUR_PUBLISHER_ID",
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/YOUR_USERNAME/copilot-router" },
  "engines": { "vscode": "^1.90.0" },
  "categories": ["AI", "Other"],
  "keywords": ["copilot", "github copilot", "routing", "budget", "ai"],
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "copilotRouter.openDashboard",
        "title": "CopilotRouter: Open Dashboard",
        "icon": "$(dashboard)"
      },
      {
        "command": "copilotRouter.resetBudget",
        "title": "CopilotRouter: Reset Budget Counter"
      },
      {
        "command": "copilotRouter.toggleEnabled",
        "title": "CopilotRouter: Toggle On/Off"
      }
    ],
    "chatParticipants": [
      {
        "id": "copilot-router.router",
        "name": "router",
        "description": "Routes your query to the best model automatically",
        "isSticky": false
      }
    ],
    "configuration": {
      "title": "CopilotRouter",
      "properties": {
        "copilotRouter.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable or disable CopilotRouter"
        },
        "copilotRouter.trivialModel": {
          "type": "string",
          "default": "gpt-4o-mini",
          "description": "Model family for trivial queries (0× cost)"
        },
        "copilotRouter.moderateModel": {
          "type": "string",
          "default": "gpt-4o",
          "description": "Model family for moderate queries (1× cost)"
        },
        "copilotRouter.complexModel": {
          "type": "string",
          "default": "claude-opus",
          "description": "Model family for complex queries (3× cost)"
        },
        "copilotRouter.budgetLimit": {
          "type": "number",
          "default": 300,
          "minimum": 1,
          "description": "Monthly request budget (Copilot Pro = 300, Business = varies)"
        },
        "copilotRouter.autoTightenAt": {
          "type": "number",
          "default": 80,
          "minimum": 1,
          "maximum": 100,
          "description": "Tighten routing when this percentage of budget is used"
        },
        "copilotRouter.llmFallbackThreshold": {
          "type": "number",
          "default": 0.70,
          "minimum": 0,
          "maximum": 1,
          "description": "Heuristic confidence below which LLM tiebreaker is used (0 = always heuristic, 1 = always LLM)"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run build",
    "build": "npm run build:ext && npm run build:webview",
    "build:ext": "esbuild src/extension.ts --bundle --outfile=out/extension.js --external:vscode --platform=node --target=node18 --sourcemap",
    "build:webview": "cd webview-ui && npm run build",
    "watch:ext": "npm run build:ext -- --watch",
    "watch:webview": "cd webview-ui && npm run dev",
    "compile": "tsc --noEmit",
    "lint": "eslint src --ext ts",
    "test": "node ./out/test/runTests.js",
    "pretest": "npm run build:ext && tsc -p tsconfig.test.json",
    "package": "vsce package",
    "publish": "vsce publish"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "@types/vscode": "^1.90.0",
    "@vscode/test-electron": "^2.3.9",
    "@vscode/vsce": "^2.24.0",
    "esbuild": "^0.20.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "typescript": "^5.4.0"
  }
}
```

### 15.2 `tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "Node16",
    "moduleResolution": "Node16",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "webview-ui", "test"]
}
```

### 15.3 `webview-ui/package.json`

```json
{
  "name": "copilot-router-webview",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.3.0"
  }
}
```

### 15.4 `webview-ui/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../out/webview',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.tsx'),
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
        format: 'iife',  // IIFE required — WebView has no module loader
        name: 'CopilotRouterWebview',
      },
    },
  },
});
```

### 15.5 `.vscodeignore`

```
.vscode/**
node_modules/**
webview-ui/node_modules/**
webview-ui/src/**
src/**
tsconfig*.json
.eslintrc.json
.gitignore
test/**
out/test/**
*.map
```

### 15.6 `.gitignore`

```
out/
node_modules/
webview-ui/node_modules/
*.vsix
.DS_Store
```

---

## 16. Tests

Generate all test files exactly as specified. Tests use VSCode's `@vscode/test-electron` runner.

### 16.1 `test/suite/heuristicScorer.test.ts`

```typescript
import * as assert from 'assert';
import { heuristicScore } from '../../src/classifier/heuristicScorer';

suite('HeuristicScorer', () => {
  // ── Trivial cases ──────────────────────────────────────────────────────
  test('short syntax question → trivial', () => {
    const r = heuristicScore('what does the ?? operator do in JavaScript');
    assert.strictEqual(r.tier, 'trivial');
    assert.ok(r.confidence >= 0.7, `confidence was ${r.confidence}`);
  });

  test('very short query → trivial', () => {
    const r = heuristicScore('what is null');
    assert.strictEqual(r.tier, 'trivial');
  });

  test('typo fix → trivial', () => {
    const r = heuristicScore('fix the typo in this variable name');
    assert.strictEqual(r.tier, 'trivial');
  });

  // ── Moderate cases ─────────────────────────────────────────────────────
  test('implement function → moderate', () => {
    const r = heuristicScore('implement a binary search function in TypeScript');
    assert.strictEqual(r.tier, 'moderate');
  });

  test('write tests → moderate', () => {
    const r = heuristicScore('write unit tests for the authentication service');
    assert.strictEqual(r.tier, 'moderate');
  });

  test('debug single error → moderate', () => {
    const r = heuristicScore('debug why this function returns undefined when called with null');
    assert.strictEqual(r.tier, 'moderate');
  });

  // ── Complex cases ──────────────────────────────────────────────────────
  test('architecture question → complex', () => {
    const r = heuristicScore(
      'how should I redesign my microservice architecture to avoid the N+1 problem at scale'
    );
    assert.strictEqual(r.tier, 'complex');
    assert.ok(r.confidence >= 0.65);
  });

  test('distributed system → complex', () => {
    const r = heuristicScore(
      'debug why my distributed cache has race conditions under concurrent load across multiple nodes'
    );
    assert.strictEqual(r.tier, 'complex');
  });

  test('multi-file refactor → complex', () => {
    const r = heuristicScore(
      'restructure the entire codebase to use dependency injection across all services'
    );
    assert.strictEqual(r.tier, 'complex');
  });

  // ── Confidence tests ───────────────────────────────────────────────────
  test('very clear trivial → high confidence', () => {
    const r = heuristicScore('what is a variable');
    assert.ok(r.confidence >= 0.75, `Expected >= 0.75, got ${r.confidence}`);
  });

  test('ambiguous short query → lower confidence', () => {
    const r = heuristicScore('fix this');
    // "fix this" is ambiguous — could be trivial or complex
    assert.ok(r.confidence < 0.80, `Expected < 0.80, got ${r.confidence}`);
  });

  // ── Signals ────────────────────────────────────────────────────────────
  test('architecture keywords detected', () => {
    const r = heuristicScore('redesign the architecture for better scalability');
    assert.ok(r.signals.hasArchitectureKeywords);
  });

  test('token count is accurate', () => {
    const r = heuristicScore('what does X mean');
    assert.strictEqual(r.signals.tokenCount, 4);
  });
});
```

### 16.2 `test/suite/budgetAwareness.test.ts`

```typescript
import * as assert from 'assert';
import { applyBudgetPressure } from '../../src/router/budgetAwareness';

suite('BudgetAwareness', () => {
  test('under threshold → no demotion', () => {
    const r = applyBudgetPressure('complex', 50, 80);
    assert.strictEqual(r.tier, 'complex');
    assert.strictEqual(r.demoted, false);
  });

  test('at threshold → complex demoted to moderate', () => {
    const r = applyBudgetPressure('complex', 80, 80);
    assert.strictEqual(r.tier, 'moderate');
    assert.strictEqual(r.demoted, true);
  });

  test('at threshold → moderate demoted to trivial', () => {
    const r = applyBudgetPressure('moderate', 85, 80);
    assert.strictEqual(r.tier, 'trivial');
    assert.strictEqual(r.demoted, true);
  });

  test('at threshold → trivial stays trivial', () => {
    const r = applyBudgetPressure('trivial', 85, 80);
    assert.strictEqual(r.tier, 'trivial');
    assert.strictEqual(r.demoted, false);
  });

  test('at 95% → everything → trivial (emergency mode)', () => {
    assert.strictEqual(applyBudgetPressure('complex', 95, 80).tier, 'trivial');
    assert.strictEqual(applyBudgetPressure('moderate', 97, 80).tier, 'trivial');
    assert.strictEqual(applyBudgetPressure('trivial', 99, 80).tier, 'trivial');
  });

  test('exactly at 94% → tighten but not emergency', () => {
    const r = applyBudgetPressure('complex', 94, 80);
    assert.strictEqual(r.tier, 'moderate'); // demoted one level, not to trivial
  });

  test('custom threshold respected', () => {
    const r50 = applyBudgetPressure('complex', 49, 50);
    assert.strictEqual(r50.tier, 'complex'); // just under 50% → no demotion

    const r50at = applyBudgetPressure('complex', 50, 50);
    assert.strictEqual(r50at.tier, 'moderate'); // at 50% → demote
  });
});
```

### 16.3 `test/runTests.ts`

```typescript
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
```

---

## 17. Build & Run Instructions (0 → 1)

Follow these steps in exact order on a machine with Node.js 18+ and VSCode installed.

### Step 1 — Clone and install

```bash
# Create the project directory
mkdir copilot-router && cd copilot-router
git init

# Install root dependencies
npm install

# Install WebView dependencies
cd webview-ui && npm install && cd ..
```

### Step 2 — Build both targets

```bash
# Build extension host (Node.js bundle)
npm run build:ext

# Build WebView React app (browser bundle → out/webview/index.js)
npm run build:webview
```

Verify the following files exist after build:
- `out/extension.js` — extension host bundle
- `out/webview/index.js` — React WebView bundle

### Step 3 — Run in Extension Development Host

```bash
# Open the project in VSCode
code .

# Press F5 — this launches a new VSCode window with the extension loaded
# Alternatively from the terminal:
code --extensionDevelopmentPath=$(pwd)
```

### Step 4 — Verify it works

In the Extension Development Host window:

1. Open the Command Palette (`Cmd/Ctrl+Shift+P`) → type `CopilotRouter: Open Dashboard` → should open a panel
2. Check the status bar (bottom right) — should show `⚡ 0/300`
3. Open Copilot Chat (`Cmd/Ctrl+Shift+I`) → type `@router what does the ?? operator do`
4. The response should end with a routing tooltip like `— Routed to GPT-5 mini · trivial · saved 3×`
5. The status bar should update to `⚡ 1/300`
6. Open the dashboard — the routing log should show the entry

### Step 5 — Watch mode for development

Open two terminals:

```bash
# Terminal 1: watch extension host
npm run watch:ext

# Terminal 2: watch WebView (optional — for UI changes)
npm run watch:webview
```

After any code change, press `Ctrl+Shift+F5` in VSCode to reload the Extension Development Host.

---

## 18. Testing Instructions (Run All Tests)

### Unit tests (no VSCode needed)

```bash
# Compile test files
npx tsc -p tsconfig.json --outDir out

# Run heuristic scorer tests
node -e "
const Mocha = require('mocha');
const mocha = new Mocha();
mocha.addFile('./out/test/suite/heuristicScorer.test.js');
mocha.addFile('./out/test/suite/budgetAwareness.test.js');
mocha.run(failures => process.exit(failures ? 1 : 0));
"
```

### Integration tests (requires VSCode)

```bash
npm test
# This runs runTests.ts which launches a headless VSCode instance
```

### Manual test checklist — run through this before every release

```
CLASSIFIER TESTS
[ ] @router what does ?? mean                  → tier: trivial,  model: gpt-4o-mini
[ ] @router implement binary search            → tier: moderate, model: gpt-4o
[ ] @router redesign auth service architecture → tier: complex,  model: claude-opus
[ ] @router fix this                           → tier: moderate (ambiguous → LLM called)

BUDGET PRESSURE TESTS
[ ] Set budgetLimit to 10 in settings
[ ] Send 8 queries (each increments counter)
[ ] 9th query: status bar turns amber, complex queries demoted
[ ] Send 10th query: status bar turns red, everything → trivial
[ ] Run command: CopilotRouter: Reset Budget Counter
[ ] Status bar returns to 0/10

DASHBOARD TESTS
[ ] Open dashboard → shows current budget
[ ] Send a query → log updates in real time
[ ] Click Reset in dashboard → budget resets
[ ] Click Clear in routing log → log empties

PERSISTENCE TESTS
[ ] Send 5 queries, note the count
[ ] Fully close and reopen VSCode
[ ] Open dashboard → count should still be 5 (persisted via globalState)

SETTINGS TESTS
[ ] Open VSCode Settings → search CopilotRouter
[ ] Change trivialModel to a different value
[ ] Send a trivial query → routing tooltip should show the new model name

OFFLINE / ERROR TESTS
[ ] Set llmFallbackThreshold to 1.0 (force all queries to LLM)
[ ] Disable network (or set a nonsense model family)
[ ] Send any query → should still get a response (fallback to moderate)
[ ] Extension should NOT crash or block the query
```

---

## 19. Polish & Production Hardening (1 → 10)

After the core loop (0→1) is working, implement these in order. Each is a standalone improvement.

### P1 — Classifier Feedback Loop

Add thumbs up/down buttons to each routing log entry in the WebView. When the user marks a routing decision as wrong, store the correction in `globalState` and use it to adjust heuristic keyword weights at runtime.

```typescript
// In routingLog.ts — add a feedback method
addFeedback(entryId: string, correct: boolean): void {
  const log = this.getAll();
  const entry = log.find(e => e.id === entryId);
  if (entry) {
    // Store misclassifications for heuristic tuning
    if (!correct) {
      const corrections = this.ctx.globalState.get<Record<string, string>>('copilotRouter.corrections', {});
      corrections[entry.querySnippet] = entry.finalTier; // user's intended tier
      this.ctx.globalState.update('copilotRouter.corrections', corrections);
    }
  }
}
```

### P2 — Monthly Savings Report

In the dashboard, add a summary section showing:
- Total requests this month: N
- Requests that would have cost 3× if unrouted: X
- Requests saved from premium tier: Y
- Estimated multiplier-units saved: Z

Compute from the routing log using `savedMultiplier` per entry.

### P3 — Model Availability Check on Activation

On activation, call `vscode.lm.selectChatModels()` for each configured model family and warn the user (via `vscode.window.showWarningMessage`) if any are unavailable. This prevents silent misrouting if a model family name has changed.

```typescript
// In extension.ts activate()
async function checkModelAvailability(settings: RouterSettings): Promise<void> {
  const families = [settings.trivialModel, settings.moderateModel, settings.complexModel];
  for (const family of families) {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family });
    if (models.length === 0) {
      vscode.window.showWarningMessage(
        `CopilotRouter: Model family "${family}" is not available. ` +
        `Check your settings or ensure it's enabled in Copilot.`
      );
    }
  }
}
```

### P4 — Context-Aware Classification

Pass additional context to the classifier: the current file's language identifier, the selected code length, and the number of files open in the workspace. Add these as bonus signals in the heuristic scorer.

```typescript
export interface ClassificationContext {
  languageId?: string;       // 'typescript', 'rust', 'python', etc.
  selectedCodeLength?: number; // chars of selected text
  workspaceFileCount?: number;
}

// In heuristicScorer.ts — add context parameter
export function heuristicScore(
  query: string,
  context?: ClassificationContext
): ClassificationResult {
  // ... existing logic ...

  // Context signals
  if (context?.selectedCodeLength && context.selectedCodeLength > 500) score += 15;
  if (context?.languageId === 'rust' || context?.languageId === 'cpp') score += 5;
  if (context?.workspaceFileCount && context.workspaceFileCount > 50) score += 5;

  // ... rest of scoring ...
}
```

### P5 — Keyboard Shortcut

Register a keybinding to quickly open the dashboard without the command palette:

```json
// In package.json contributes:
"keybindings": [
  {
    "command": "copilotRouter.openDashboard",
    "key": "ctrl+shift+r",
    "mac": "cmd+shift+r",
    "when": "!terminalFocus"
  }
]
```

### P6 — Marketplace Listing Polish

- Write a thorough `README.md` with screenshots, a GIF demo, and an explanation of the hybrid classifier
- Add a `CHANGELOG.md` — required for marketplace credibility
- Set `icon` in `package.json` to `media/icon.png` (128×128 PNG)
- Add a `galleryBanner` with `color` and `theme` in `package.json`:

```json
"galleryBanner": {
  "color": "#0d0d14",
  "theme": "dark"
}
```

### P7 — Telemetry (Opt-In Only)

Add an opt-in telemetry flag. If enabled, log aggregate routing stats (no query content, no user data) to help tune heuristic weights for future versions. Always default to `false` and make it explicit in the privacy section of `README.md`.

---

## 20. Publishing Checklist

Run through every item before running `vsce publish`.

```
PRE-PUBLISH
[ ] npm run build — both ext and webview build cleanly with zero errors
[ ] npm run compile — TypeScript reports zero type errors
[ ] npm run lint — zero lint errors
[ ] Manual test checklist from Section 18 — all items pass
[ ] Version bumped in package.json (follow semver: 0.1.0 for initial)
[ ] CHANGELOG.md updated
[ ] README.md has screenshots or a GIF demo

MARKETPLACE SETUP (one-time)
[ ] Create publisher at https://marketplace.visualstudio.com/manage
[ ] Create Personal Access Token at https://dev.azure.com
  - Organisation: All accessible organisations
  - Scope: Marketplace → Manage
[ ] vsce login YOUR_PUBLISHER_ID

PUBLISH
[ ] vsce package  ← generates copilot-router-0.1.0.vsix
[ ] Test install: code --install-extension copilot-router-0.1.0.vsix
[ ] Smoke test in clean VSCode instance — all manual tests pass
[ ] vsce publish
[ ] Verify listing live at https://marketplace.visualstudio.com/items?itemName=YOUR_PUBLISHER_ID.copilot-router
```

---

## 21. Architecture Invariants — Never Violate These

These are the rules that, if broken, will cause silent failures and hours of debugging.

1. **Never import `vscode` in `webview-ui/`** — it doesn't exist in the browser context.
2. **Never use `document` or `window` in `src/`** — it doesn't exist in the Node.js extension host.
3. **All host↔webview communication must use the typed message union** (`HostMessage` / `WebviewMessage`) — no untyped `any` postMessage calls.
4. **`acquireVsCodeApi()` is called exactly once** — the `webview-ui/src/vscode.ts` bridge ensures this. Never call it directly in components.
5. **Classifier errors must never block the user** — every catch block in `hybridClassifier.ts` and `llmClassifier.ts` must return a valid `ClassificationResult` with `tier: 'moderate'` as the safe default.
6. **Budget tracker must call `checkMonthlyReset()` on every read** — not just on activation — because VSCode can run for weeks without restarting.
7. **WebView `Content-Security-Policy` must include `script-src ${webview.cspSource}`** — without this, the React bundle will be blocked by CSP and the WebView will be a blank page with no error shown.
8. **Vite build output format must be `iife`** — WebViews have no module loader. ES modules will silently fail.
9. **`retainContextWhenHidden: true` on the WebView panel** — without this, every time the user switches away from the dashboard tab, React state is destroyed and rebuilt.
10. **The `.vscodeignore` must exclude `src/` and `webview-ui/src/`** — shipping source files bloats the `.vsix` and can expose sensitive logic. Only compiled output in `out/` should be included.

---

*End of specification. Generate every file listed. Do not summarise, stub, or skip any section.*
