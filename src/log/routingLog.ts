import * as vscode from 'vscode';
import { RoutingEntry } from '../shared/types';

const KEY = 'copilotRouter.routingLog';
const MAX = 200;

export class RoutingLog {
    private _onDidChange = new vscode.EventEmitter<RoutingEntry[]>();
    readonly onDidChange = this._onDidChange.event;

    constructor(private ctx: vscode.ExtensionContext) { }

    add(entry: RoutingEntry): void {
        const log = this.getAll();
        log.unshift(entry);
        if (log.length > MAX) log.splice(MAX);
        this.ctx.globalState.update(KEY, log);
        this._onDidChange.fire(log);
    }

    getAll(): RoutingEntry[] {
        return this.ctx.globalState.get<RoutingEntry[]>(KEY, []);
    }

    clear(): void {
        this.ctx.globalState.update(KEY, []);
        this._onDidChange.fire([]);
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
}
