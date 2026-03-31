import { RoutingEntry } from '../../../src/shared/types';

interface Props {
    entries: RoutingEntry[];
    onClear: () => void;
}

const TIER_COLOR: Record<string, string> = {
    trivial: 'var(--vscode-terminal-ansiGreen)',
    moderate: 'var(--vscode-terminal-ansiYellow)',
    complex: 'var(--vscode-terminal-ansiRed)',
};

export function RoutingLog({ entries, onClear }: Props) {
    if (entries.length === 0) {
        return (
            <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, padding: '20px 0' }}>
                No routing decisions yet. Use <code>@router</code> in Copilot Chat to get started.
            </div>
        );
    }

    const totalSaved = entries.reduce((acc, e) => acc + e.savedMultiplier, 0);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, letterSpacing: 2, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' }}>
                    Routing Log · {entries.length} decisions · {totalSaved}× saved
                </span>
                <button onClick={onClear} style={{
                    fontSize: 11, padding: '3px 10px',
                    background: 'transparent',
                    border: '1px solid var(--vscode-widget-border)',
                    color: 'var(--vscode-descriptionForeground)',
                    borderRadius: 3, cursor: 'pointer',
                }}>Clear</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {entries.slice(0, 50).map(entry => (
                    <div key={entry.id} style={{
                        display: 'grid',
                        gridTemplateColumns: '70px 1fr 80px 90px 40px',
                        gap: 8,
                        padding: '6px 10px',
                        background: 'var(--vscode-editor-inactiveSelectionBackground)',
                        borderRadius: 3,
                        fontSize: 11,
                        alignItems: 'center',
                    }}>
                        {/* Tier badge */}
                        <span style={{
                            color: TIER_COLOR[entry.finalTier],
                            fontWeight: 600,
                            letterSpacing: 1,
                        }}>
                            {entry.finalTier}
                            {entry.rawTier !== entry.finalTier && (
                                <span style={{ color: 'var(--vscode-descriptionForeground)', fontWeight: 400 }}>
                                    {' '}↓
                                </span>
                            )}
                        </span>

                        {/* Query snippet */}
                        <span style={{
                            color: 'var(--vscode-foreground)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {entry.querySnippet}
                        </span>

                        {/* Model */}
                        <span style={{ color: 'var(--vscode-descriptionForeground)', textAlign: 'right' }}>
                            {entry.modelChosen.split('-')[0]}
                        </span>

                        {/* Method */}
                        <span style={{ color: 'var(--vscode-descriptionForeground)', textAlign: 'right' }}>
                            {entry.classificationMethod}·{Math.round(entry.confidence * 100)}%
                        </span>

                        {/* Savings */}
                        <span style={{
                            color: entry.savedMultiplier > 0 ? 'var(--vscode-terminal-ansiGreen)' : 'var(--vscode-descriptionForeground)',
                            textAlign: 'right',
                            fontWeight: entry.savedMultiplier > 0 ? 600 : 400,
                        }}>
                            {entry.savedMultiplier > 0 ? `+${entry.savedMultiplier}×` : '—'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
