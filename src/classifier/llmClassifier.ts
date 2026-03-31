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
