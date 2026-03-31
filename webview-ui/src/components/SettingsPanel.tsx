// SettingsPanel — placeholder for P3 polish feature (user-configurable model mappings)
// This component will be implemented in the 1→10 polish phase.

import type { RouterSettings } from '../../../src/shared/types';

interface Props {
    settings: RouterSettings | null;
    onUpdate: (settings: Partial<RouterSettings>) => void;
}

export function SettingsPanel({ settings, onUpdate }: Props) {
    if (!settings) {
        return (
            <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, padding: '20px 0' }}>
                Loading settings...
            </div>
        );
    }

    return (
        <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase', marginBottom: 12 }}>
                Settings
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SettingRow label="Trivial Model" value={settings.trivialModel}
                    onChange={(v) => onUpdate({ trivialModel: v })} />
                <SettingRow label="Moderate Model" value={settings.moderateModel}
                    onChange={(v) => onUpdate({ moderateModel: v })} />
                <SettingRow label="Complex Model" value={settings.complexModel}
                    onChange={(v) => onUpdate({ complexModel: v })} />
                <SettingRow label="Budget Limit" value={String(settings.budgetLimit)}
                    onChange={(v) => onUpdate({ budgetLimit: parseInt(v, 10) || 300 })} />
                <SettingRow label="Auto-Tighten At (%)" value={String(settings.autoTightenAt)}
                    onChange={(v) => onUpdate({ autoTightenAt: parseInt(v, 10) || 80 })} />
                <SettingRow label="LLM Fallback Threshold" value={String(settings.llmFallbackThreshold)}
                    onChange={(v) => onUpdate({ llmFallbackThreshold: parseFloat(v) || 0.70 })} />
            </div>
        </div>
    );
}

function SettingRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--vscode-foreground)', minWidth: 140 }}>{label}</label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    flex: 1,
                    maxWidth: 200,
                    padding: '4px 8px',
                    fontSize: 12,
                    background: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: 3,
                    outline: 'none',
                }}
            />
        </div>
    );
}
