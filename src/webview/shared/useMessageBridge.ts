import { useEffect, useCallback, useRef } from 'react';
import { getVsCodeApi } from './vscodeApi';

type AnyMsg = { type: string; requestId?: string; [key: string]: unknown };

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useMessageBridge<
  InMsg extends AnyMsg,
  OutMsg extends AnyMsg
>() {
  const pendingRef = useRef<Map<string, (msg: InMsg) => void>>(new Map());

  const send = useCallback((msg: OutMsg): void => {
    getVsCodeApi().postMessage(msg);
  }, []);

  const request = useCallback(<T extends InMsg>(outMsg: OutMsg, timeoutMs = 15000): Promise<T> => {
    return new Promise((resolve, reject) => {
      const requestId = generateId();
      const msgWithId = { ...outMsg, requestId } as OutMsg & { requestId: string };
      const timer = setTimeout(() => {
        pendingRef.current.delete(requestId);
        reject(new Error(`Request ${msgWithId.type} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      pendingRef.current.set(requestId, (response: InMsg) => {
        clearTimeout(timer);
        resolve(response as T);
      });

      getVsCodeApi().postMessage(msgWithId);
    });
  }, []);

  const handleIncoming = useCallback((event: MessageEvent<InMsg>): void => {
    const msg = event.data;
    if (!msg || !msg.type) return;
    if (msg.requestId && pendingRef.current.has(msg.requestId)) {
      const resolve = pendingRef.current.get(msg.requestId)!;
      pendingRef.current.delete(msg.requestId);
      resolve(msg);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleIncoming);
    return () => window.removeEventListener('message', handleIncoming);
  }, [handleIncoming]);

  const useSubscribe = (type: string, handler: (msg: InMsg) => void): void => {
    useEffect(() => {
      const listener = (event: MessageEvent<InMsg>) => {
        if (event.data?.type === type) handler(event.data);
      };
      window.addEventListener('message', listener);
      return () => window.removeEventListener('message', listener);
    }, [type, handler]);
  };

  return { send, request, useSubscribe };
}
