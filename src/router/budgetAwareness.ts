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
    if (tier === 'complex') return { tier: 'moderate', demoted: true };
    if (tier === 'moderate') return { tier: 'trivial', demoted: true };
    return { tier: 'trivial', demoted: false };
}
