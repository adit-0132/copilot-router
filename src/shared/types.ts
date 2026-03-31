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
