import { ModelInfo, ComplexityTier } from '../shared/types';

export const MODEL_REGISTRY: ModelInfo[] = [
    { family: 'gpt-4o-mini', displayName: 'GPT-5 mini', costMultiplier: 0, tier: 'trivial' },
    { family: 'gpt-4o', displayName: 'GPT-4.1', costMultiplier: 1, tier: 'moderate' },
    { family: 'claude-sonnet', displayName: 'Sonnet 4.5', costMultiplier: 1, tier: 'moderate' },
    { family: 'claude-opus', displayName: 'Claude Opus', costMultiplier: 3, tier: 'complex' },
];

export function getModelForTier(
    tier: ComplexityTier,
    trivialFamily: string,
    moderateFamily: string,
    complexFamily: string
): string {
    switch (tier) {
        case 'trivial': return trivialFamily;
        case 'moderate': return moderateFamily;
        case 'complex': return complexFamily;
    }
}

export function getCostMultiplier(family: string): number {
    return MODEL_REGISTRY.find(m => m.family === family)?.costMultiplier ?? 1;
}
