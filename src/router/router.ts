import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { HybridClassifier } from '../classifier/hybridClassifier';
import { BudgetTracker } from '../budget/budgetTracker';
import { RoutingLog } from '../log/routingLog';
import { applyBudgetPressure } from './budgetAwareness';
import { getModelForTier, getCostMultiplier } from './modelRegistry';
import { getSettings } from '../config/settings';
import { RoutingEntry } from '../shared/types';

export class Router {
    private classifier = new HybridClassifier();
    private outputChannel: vscode.OutputChannel;

    constructor(
        private ctx: vscode.ExtensionContext,
        private budget: BudgetTracker,
        private log: RoutingLog
    ) {
        this.outputChannel = vscode.window.createOutputChannel('CopilotRouter');
        ctx.subscriptions.push(this.outputChannel);
    }

    async activate(): Promise<void> {
        // Pre-warm classifier in background
        this.classifier.initialize().catch(() => { });
        this.registerChatParticipant();
    }

    private registerChatParticipant(): void {
        const participant = vscode.chat.createChatParticipant(
            'copilot-router.router',
            async (request, _context, response, token) => {
                await this.handleRequest(request.prompt, response, token);
            }
        );

        participant.iconPath = vscode.Uri.joinPath(
            this.ctx.extensionUri, 'media', 'icon.png'
        );

        this.ctx.subscriptions.push(participant);
        this.log_('CopilotRouter activated. Chat participant @router registered.');
    }

    private async handleRequest(
        query: string,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        if (!getSettings().enabled) {
            response.markdown('CopilotRouter is disabled. Enable it in settings.');
            return;
        }

        const settings = getSettings();

        // ── 1. Classify ──────────────────────────────────────────────────────
        const classification = await this.classifier.classify(query);
        const rawTier = classification.tier;

        // ── 2. Apply budget pressure ─────────────────────────────────────────
        const budgetPercent = this.budget.getUsedPercent();
        const { tier: finalTier, demoted } = applyBudgetPressure(
            rawTier,
            budgetPercent,
            settings.autoTightenAt
        );

        // ── 3. Select model ───────────────────────────────────────────────────
        const targetFamily = getModelForTier(
            finalTier,
            settings.trivialModel,
            settings.moderateModel,
            settings.complexModel
        );

        const models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: targetFamily,
        });

        if (models.length === 0) {
            response.markdown(
                `⚠️ **CopilotRouter**: Model family \`${targetFamily}\` is unavailable. ` +
                `Check that GitHub Copilot is active and the model is enabled.`
            );
            return;
        }

        const model = models[0];

        // ── 4. Forward request and stream response ────────────────────────────
        const messages = [vscode.LanguageModelChatMessage.User(query)];

        try {
            const modelResponse = await model.sendRequest(messages, {}, token);
            for await (const chunk of modelResponse.text) {
                if (token.isCancellationRequested) break;
                response.markdown(chunk);
            }
        } catch (err) {
            if (!token.isCancellationRequested) {
                response.markdown(`\n\n⚠️ **CopilotRouter**: Model error — ${String(err)}`);
            }
            return;
        }

        // ── 5. Compute savings ────────────────────────────────────────────────
        const opusCost = 3;
        const chosenCost = getCostMultiplier(targetFamily);
        const savedMultiplier = opusCost - chosenCost;

        // ── 6. Update budget and log ──────────────────────────────────────────
        this.budget.increment();

        const entry: RoutingEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            querySnippet: query.slice(0, 80),
            rawTier,
            finalTier,
            modelChosen: model.name,
            classificationMethod: classification.method,
            confidence: classification.confidence,
            savedMultiplier,
            budgetUsedAtTime: this.budget.getUsed(),
        };

        this.log.add(entry);

        // ── 7. Routing tooltip ────────────────────────────────────────────────
        const demotedNote = demoted ? ` *(budget pressure: ${rawTier}→${finalTier})*` : '';
        const methodNote = classification.method === 'hybrid'
            ? `hybrid·${Math.round(classification.confidence * 100)}%`
            : classification.method;

        response.markdown(
            `\n\n---\n*🔀 **${model.name}** · ${finalTier} · ${methodNote}${demotedNote} · saved **${savedMultiplier}×***`
        );

        // ── 8. Output channel log ─────────────────────────────────────────────
        this.log_(
            `[ROUTE] "${query.slice(0, 60)}" → ${finalTier} → ${model.name} ` +
            `(conf: ${classification.confidence.toFixed(2)}, method: ${classification.method}, ` +
            `budget: ${this.budget.getUsed()}/${this.budget.getTotal()})`
        );
    }

    private log_(msg: string): void {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ${msg}`);
    }
}
