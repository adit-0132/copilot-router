import * as vscode from 'vscode';
import { BudgetTracker } from '../budget/budgetTracker';
import { RoutingLog } from '../log/routingLog';
import { getSettings } from '../config/settings';
import { HostMessage, WebviewMessage } from '../shared/types';

export class WebviewProvider {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private ctx: vscode.ExtensionContext,
        private budget: BudgetTracker,
        private log: RoutingLog
    ) {
        // Push state whenever budget or log changes
        budget.onDidChange(() => this.pushBudget(), null, ctx.subscriptions);
        log.onDidChange(() => this.pushLog(), null, ctx.subscriptions);
    }

    show(): void {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'copilotRouterDashboard',
            'CopilotRouter',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.ctx.extensionUri, 'out', 'webview'),
                ],
                retainContextWhenHidden: true,
            }
        );

        this.panel.webview.html = this.buildHtml();

        this.panel.webview.onDidReceiveMessage(
            (msg: WebviewMessage) => this.handleMessage(msg),
            null,
            this.ctx.subscriptions
        );

        this.panel.onDidDispose(() => { this.panel = undefined; });

        // Push initial full state after a tick (WebView needs to load first)
        setTimeout(() => this.pushFullState(), 300);
    }

    private handleMessage(msg: WebviewMessage): void {
        switch (msg.type) {
            case 'ready':
            case 'requestFullState':
                this.pushFullState();
                break;
            case 'resetBudget':
                this.budget.reset();
                break;
            case 'clearLog':
                this.log.clear();
                break;
            case 'updateSettings':
                // Write each changed setting back to workspace config
                const cfg = vscode.workspace.getConfiguration('copilotRouter');
                for (const [key, val] of Object.entries(msg.settings)) {
                    cfg.update(key, val, vscode.ConfigurationTarget.Global);
                }
                this.pushSettings();
                break;
        }
    }

    private post(msg: HostMessage): void {
        this.panel?.webview.postMessage(msg);
    }

    private pushBudget(): void {
        this.post({
            type: 'budgetUpdate',
            used: this.budget.getUsed(),
            total: this.budget.getTotal(),
            percent: this.budget.getUsedPercent(),
        });
    }

    private pushLog(): void {
        this.post({ type: 'logUpdate', entries: this.log.getAll() });
    }

    private pushSettings(): void {
        this.post({ type: 'settingsUpdate', settings: getSettings() });
    }

    private pushFullState(): void {
        this.pushBudget();
        this.pushLog();
        this.pushSettings();
    }

    private buildHtml(): string {
        const wv = this.panel!.webview;
        const scriptUri = wv.asWebviewUri(
            vscode.Uri.joinPath(this.ctx.extensionUri, 'out', 'webview', 'index.js')
        );
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src ${wv.cspSource}; style-src 'unsafe-inline';" />
  <title>CopilotRouter</title>
</head>
<body style="margin:0;padding:0;background:var(--vscode-editor-background)">
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}
