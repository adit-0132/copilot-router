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
