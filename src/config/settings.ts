import * as vscode from 'vscode';
import { RouterSettings } from '../shared/types';

export function getSettings(): RouterSettings {
    const cfg = vscode.workspace.getConfiguration('copilotRouter');
    return {
        trivialModel: cfg.get<string>('trivialModel', 'gpt-4o-mini'),
        moderateModel: cfg.get<string>('moderateModel', 'gpt-4o'),
        complexModel: cfg.get<string>('complexModel', 'claude-opus'),
        budgetLimit: cfg.get<number>('budgetLimit', 300),
        autoTightenAt: cfg.get<number>('autoTightenAt', 80),
        llmFallbackThreshold: cfg.get<number>('llmFallbackThreshold', 0.70),
        enabled: cfg.get<boolean>('enabled', true),
    };
}
