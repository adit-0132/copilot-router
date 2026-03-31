interface Props {
    used: number;
    total: number;
    percent: number;
    onReset: () => void;
}

export function BudgetGauge({ used, total, percent, onReset }: Props) {
    const color = percent >= 95 ? 'var(--vscode-errorForeground)'
        : percent >= 80 ? 'var(--vscode-editorWarning-foreground)'
            : 'var(--vscode-terminal-ansiGreen)';

    return (
        <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 11, letterSpacing: 2, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' }}>
                    Monthly Budget
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color }}>
                    {used} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--vscode-descriptionForeground)' }}>/ {total}</span>
                </span>
            </div>

            {/* Track */}
            <div style={{
                height: 6,
                background: 'var(--vscode-widget-border)',
                borderRadius: 3,
                overflow: 'hidden',
                marginBottom: 8,
            }}>
                <div style={{
                    height: '100%',
                    width: `${Math.min(percent, 100)}%`,
                    background: color,
                    borderRadius: 3,
                    transition: 'width 0.4s ease',
                }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
                    {100 - percent}% remaining
                </span>
                <button
                    onClick={onReset}
                    style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        background: 'transparent',
                        border: '1px solid var(--vscode-widget-border)',
                        color: 'var(--vscode-foreground)',
                        borderRadius: 3,
                        cursor: 'pointer',
                    }}
                >
                    Reset
                </button>
            </div>

            {percent >= 80 && (
                <div style={{
                    marginTop: 10,
                    padding: '7px 12px',
                    background: percent >= 95
                        ? 'var(--vscode-inputValidation-errorBackground)'
                        : 'var(--vscode-inputValidation-warningBackground)',
                    border: `1px solid ${percent >= 95
                        ? 'var(--vscode-inputValidation-errorBorder)'
                        : 'var(--vscode-inputValidation-warningBorder)'}`,
                    borderRadius: 4,
                    fontSize: 12,
                    color: 'var(--vscode-foreground)',
                }}>
                    {percent >= 95
                        ? '🚨 Critical: All queries routed to free tier.'
                        : `⚠️  Routing tightened — complex queries demoted one tier.`}
                </div>
            )}
        </div>
    );
}
