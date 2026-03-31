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
