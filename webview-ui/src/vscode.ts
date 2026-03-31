// This file bridges the WebView sandbox to the VSCode postMessage API.
// acquireVsCodeApi() can only be called once per WebView lifetime.

import type { WebviewMessage } from '../../src/shared/types';

interface VsCodeApi {
    postMessage(msg: WebviewMessage): void;
    getState(): unknown;
    setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let _api: VsCodeApi | undefined;

export function getVsCode(): VsCodeApi {
    if (!_api) {
        _api = acquireVsCodeApi();
    }
    return _api;
}

export function postMessage(msg: WebviewMessage): void {
    getVsCode().postMessage(msg);
}
