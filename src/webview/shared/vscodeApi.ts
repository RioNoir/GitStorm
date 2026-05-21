declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
};

let _api: ReturnType<typeof acquireVsCodeApi> | undefined;

export function getVsCodeApi(): ReturnType<typeof acquireVsCodeApi> {
  if (!_api) {
    _api = acquireVsCodeApi();
  }
  return _api;
}
