'use client';

import { useRef, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { CopyButton } from './CopyButton';
import { ReportGate } from './ReportGate';

interface StreamingOutputProps {
  output: string;
  isStreaming: boolean;
  label: string;
  copyLabel?: string;
  url?: string;
  geoScore?: number | null;
}

const LOCK_DELAY_MS = 4000; // 4 seconds before locking

export function StreamingOutput({
  output,
  isStreaming,
  label,
  copyLabel = '⎘ Copy Report',
  url = '',
  geoScore = null,
}: StreamingOutputProps) {
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: session } = useSession();
  const [locked, setLocked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (isStreaming && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [output, isStreaming]);

  // Reset when a new analysis starts streaming
  useEffect(() => {
    if (isStreaming) {
      setLocked(false);
      setUnlocked(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [isStreaming]);

  // Start lock timer when streaming finishes
  useEffect(() => {
    if (!isStreaming && output && !session && !unlocked) {
      timerRef.current = setTimeout(() => setLocked(true), LOCK_DELAY_MS);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [isStreaming, output]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!output && !isStreaming) return null;

  const isLocked = locked && !unlocked && !session;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{label}</h2>
        {output && !isStreaming && !isLocked && <CopyButton text={output} label={copyLabel} />}
        {isLocked && (
          <span className="text-xs text-red-400 font-medium flex items-center gap-1">
            🔒 Locked
          </span>
        )}
      </div>

      <div className="relative">
        <div
          ref={ref}
          className={`bg-slate-900 text-slate-100 rounded-xl p-6 font-mono text-sm leading-relaxed overflow-auto max-h-[640px] whitespace-pre-wrap transition-all duration-500 ${
            isLocked ? 'blur-md select-none pointer-events-none' : ''
          }`}
          onCopy={isLocked ? (e) => e.preventDefault() : undefined}
        >
          {output}
          {isStreaming && <span className="animate-pulse text-indigo-400">▋</span>}
        </div>

        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl p-6 mx-4 w-full max-w-sm text-center space-y-3">
              <div className="text-2xl">🔒</div>
              <p className="font-bold text-gray-900 text-sm">Report locked</p>
              <p className="text-xs text-gray-500">
                Sign in free to unlock, export as PDF, or email this report.
              </p>
              <button
                onClick={() => {
                  window.location.href = '/login';
                }}
                className="w-full text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl transition-colors"
              >
                Sign in with Google — free
              </button>
              <button
                onClick={() => setUnlocked(true)}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Enter email to receive report instead
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Export / Email options for signed-in users or after email unlock */}
      {output && !isStreaming && (
        <ReportGate
          reportText={output}
          geoScore={geoScore ?? 0}
          url={url}
          onUnlocked={() => setUnlocked(true)}
        />
      )}
    </div>
  );
}
