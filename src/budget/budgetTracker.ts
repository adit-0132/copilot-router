import * as vscode from 'vscode';
import { getSettings } from '../config/settings';

const KEY_USED = 'copilotRouter.budgetUsed';
const KEY_MONTH = 'copilotRouter.budgetMonth';

export class BudgetTracker {
    private _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    constructor(private ctx: vscode.ExtensionContext) {
        this.checkMonthlyReset();
    }

    private checkMonthlyReset(): void {
        const currentMonth = this.getCurrentMonth();
        const storedMonth = this.ctx.globalState.get<string>(KEY_MONTH);
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
