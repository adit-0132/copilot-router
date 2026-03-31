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
        const used = this.budget.getUsed();
        const total = this.budget.getTotal();
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
