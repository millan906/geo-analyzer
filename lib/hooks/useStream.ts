'use client';

import { useState, useCallback, useRef } from 'react';

export interface StreamTiming {
  durationMs: number | null;
  timeToFirstTokenMs: number | null;
}

export interface UseStreamReturn {
  output: string;
  isStreaming: boolean;
  error: string;
  timing: StreamTiming;
  run: (body: Record<string, string>) => Promise<void>;
  reset: () => void;
}

export function useStream(endpoint: string): UseStreamReturn {
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [timing, setTiming] = useState<StreamTiming>({
    durationMs: null,
    timeToFirstTokenMs: null,
  });
  const startTimeRef = useRef<number | null>(null);
  const firstTokenSeenRef = useRef(false);

  const run = useCallback(
    async (body: Record<string, string>) => {
      if (isStreaming) return;

      setError('');
      setOutput('');
      setIsStreaming(true);
      setTiming({ durationMs: null, timeToFirstTokenMs: null });
      startTimeRef.current = Date.now();
      firstTokenSeenRef.current = false;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Request failed (${response.status})`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          // Record time to first token
          if (!firstTokenSeenRef.current && chunk.length > 0 && startTimeRef.current) {
            firstTokenSeenRef.current = true;
            const ttft = Date.now() - startTimeRef.current;
            setTiming((prev) => ({ ...prev, timeToFirstTokenMs: ttft }));
          }

          setOutput((prev) => {
            const next = prev + chunk;
            if (next.startsWith('ERROR:')) {
              setError(next.replace(/^ERROR:\s*/, ''));
              return '';
            }
            return next;
          });
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Request failed. Check your API key and try again.');
        }
      } finally {
        setIsStreaming(false);
        if (startTimeRef.current) {
          setTiming((prev) => ({ ...prev, durationMs: Date.now() - startTimeRef.current! }));
        }
      }
    },
    [endpoint, isStreaming]
  );

  const reset = useCallback(() => {
    setOutput('');
    setError('');
    setIsStreaming(false);
    setTiming({ durationMs: null, timeToFirstTokenMs: null });
  }, []);

  return { output, isStreaming, error, timing, run, reset };
}
