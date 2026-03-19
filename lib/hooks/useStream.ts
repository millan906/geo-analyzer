'use client';

import { useState, useCallback } from 'react';

export interface UseStreamReturn {
  output: string;
  isStreaming: boolean;
  error: string;
  run: (body: Record<string, string>) => Promise<void>;
  reset: () => void;
}

export function useStream(endpoint: string): UseStreamReturn {
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(
    async (body: Record<string, string>) => {
      if (isStreaming) return;

      setError('');
      setOutput('');
      setIsStreaming(true);

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
      }
    },
    [endpoint, isStreaming]
  );

  const reset = useCallback(() => {
    setOutput('');
    setError('');
    setIsStreaming(false);
  }, []);

  return { output, isStreaming, error, run, reset };
}
