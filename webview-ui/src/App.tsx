import { useState, useEffect } from 'react';
import { BudgetGauge } from './components/BudgetGauge';
import { RoutingLog } from './components/RoutingLog';
import { postMessage } from './vscode';
import type { HostMessage, RouterSettings, RoutingEntry } from '../../src/shared/types';

export default function App() {
    const [budget, setBudget] = useState({ used: 0, total: 300, percent: 0 });
    const [entries, setEntries] = useState<RoutingEntry[]>([]);
    const [settings, setSettings] = useState<RouterSettings | null>(null);

    useEffect(() => {
        postMessage({ type: 'ready' });

        const handler = (event: MessageEvent<HostMessage>) => {
            const msg = event.data;
            switch (msg.type) {
                case 'budgetUpdate':
                    setBudget({ used: msg.used, total: msg.total, percent: msg.percent });
                    break;
                case 'logUpdate':
                    setEntries(msg.entries);
                    break;
                case 'settingsUpdate':
                    setSettings(msg.settings);
                    break;
            }
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const containerStyle: React.CSSProperties = {
        padding: '20px 24px',
        fontFamily: 'var(--vscode-font-family)',
        fontSize: 'var(--vscode-font-size)',
        color: 'var(--vscode-foreground)',
        maxWidth: 700,
    };

    const sectionStyle: React.CSSProperties = {
        marginBottom: 32,
        paddingBottom: 32,
        borderBottom: '1px solid var(--vscode-widget-border)',
    };

    return (
        <div style={containerStyle}>
            <div style={{ marginBottom: 28 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: -0.3 }}>
                    ⚡ CopilotRouter
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>
                    Intelligent model routing · Hybrid classifier
                </p>
            </div>

            <div style={sectionStyle}>
                <BudgetGauge
                    used={budget.used}
                    total={budget.total}
                    percent={budget.percent}
                    onReset={() => postMessage({ type: 'resetBudget' })}
                />
            </div>

            <div>
                <RoutingLog
                    entries={entries}
                    onClear={() => postMessage({ type: 'clearLog' })}
                />
            </div>
        </div>
    );
}
