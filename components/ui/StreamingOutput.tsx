'use client';

import { useRef, useEffect } from 'react';
import { CopyButton } from './CopyButton';

interface StreamingOutputProps {
  output: string;
  isStreaming: boolean;
  label: string;
  copyLabel?: string;
}

export function StreamingOutput({
  output,
  isStreaming,
  label,
  copyLabel = '⎘ Copy Report',
}: StreamingOutputProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [output, isStreaming]);

  if (!output && !isStreaming) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{label}</h2>
        {output && !isStreaming && <CopyButton text={output} label={copyLabel} />}
      </div>
      <div
        ref={ref}
        className="bg-slate-900 text-slate-100 rounded-xl p-6 font-mono text-sm leading-relaxed overflow-auto max-h-[640px] whitespace-pre-wrap"
      >
        {output}
        {isStreaming && <span className="animate-pulse text-indigo-400">▋</span>}
      </div>
    </div>
  );
}
