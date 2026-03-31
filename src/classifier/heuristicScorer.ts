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
    const hasTrivialKeywords = TRIVIAL_KEYWORDS.some(k => q.includes(k));
    const hasModerateKeywords = MODERATE_KEYWORDS.some(k => q.includes(k));
    const hasComplexKeywords = COMPLEX_KEYWORDS.some(k => q.includes(k));
    const hasDebuggingKeywords = DEBUGGING_KEYWORDS.some(k => q.includes(k));
    const hasMultiFileKeywords = MULTI_FILE_KEYWORDS.some(k => q.includes(k));
    const hasArchKeywords = ARCHITECTURE_KEYWORDS.some(k => q.includes(k));
    const codeBlockCount = (query.match(/```/g) || []).length / 2;
    const questionMarkCount = (query.match(/\?/g) || []).length;

    // ── Raw score: 0 = trivial, 100 = complex ──
    let score = 40; // neutral start

    // Token count signal
    if (tokenCount <= 4) score -= 30;
    if (tokenCount <= 6) score -= 20;
    if (tokenCount <= 12) score -= 10;
    if (tokenCount >= 30) score += 10;
    if (tokenCount >= 60) score += 20;

    // Keyword signals
    if (hasTrivialKeywords) score -= 25;
    if (hasModerateKeywords) score += 10;
    if (hasComplexKeywords) score += 35;
    if (hasDebuggingKeywords) score += 15;
    if (hasMultiFileKeywords) score += 25;
    if (hasArchKeywords) score += 20;

    // Code block signals (pasting a large snippet → moderate/complex)
    if (codeBlockCount >= 1) score += 10;
    if (codeBlockCount >= 2) score += 15;

    // Single question mark with short query → likely trivial lookup
    if (questionMarkCount === 1 && tokenCount <= 10) score -= 10;

    // Clamp
    score = Math.max(0, Math.min(100, score));

    // ── Tier mapping ──
    let tier: ComplexityTier;
    if (score <= 35) tier = 'trivial';
    else if (score <= 65) tier = 'moderate';
    else tier = 'complex';

    // ── Confidence: how far from the decision boundaries? ──
    // Boundaries are at 35 and 65. Max distance from nearest boundary = 35 points.
    let distanceFromBoundary: number;
    if (score <= 35) distanceFromBoundary = 35 - score;
    else if (score >= 65) distanceFromBoundary = score - 65;
    else distanceFromBoundary = Math.min(score - 35, 65 - score);

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
