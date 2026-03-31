import * as vscode from 'vscode';
import { Router } from './router/router';
import { BudgetTracker } from './budget/budgetTracker';
import { RoutingLog } from './log/routingLog';
import { StatusBarManager } from './statusBar/statusBarItem';
import { WebviewProvider } from './webview/webviewProvider';

export function activate(context: vscode.ExtensionContext): void {
    const budget = new BudgetTracker(context);
    const log = new RoutingLog(context);
    const router = new Router(context, budget, log);
    const status = new StatusBarManager(context, budget);
    const webview = new WebviewProvider(context, budget, log);


    context.subscriptions.push(
    vscode.commands.registerCommand('copilotRouter.listModels', async () => {
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
        models.forEach(m => {
        console.log(`name: ${m.name} | id: ${m.id} | family: ${m.family} | vendor: ${m.vendor}`);
        });
    })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('copilotRouter.openDashboard', () => {
            webview.show();
        }),
        vscode.commands.registerCommand('copilotRouter.resetBudget', () => {
            budget.reset();
            vscode.window.showInformationMessage('CopilotRouter: Budget counter reset.');
        }),
        vscode.commands.registerCommand('copilotRouter.toggleEnabled', () => {
            const cfg = vscode.workspace.getConfiguration('copilotRouter');
            const current = cfg.get<boolean>('enabled', true);
            cfg.update('enabled', !current, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(
                `CopilotRouter: ${!current ? 'Enabled' : 'Disabled'}.`
            );
        })
    );

    router.activate();
    status.activate();
}

export function deactivate(): void { }
