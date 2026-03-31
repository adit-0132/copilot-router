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
