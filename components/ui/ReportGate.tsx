'use client';

import { signIn, useSession } from 'next-auth/react';
import { useState } from 'react';

interface ReportGateProps {
  reportText: string;
  geoScore: number;
  url: string;
  onUnlocked: () => void;
}

export function ReportGate({ reportText, geoScore, url, onUnlocked }: ReportGateProps) {
  const { data: session } = useSession();
  const [emailInput, setEmailInput] = useState(session?.user?.email ?? '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleSignIn = async () => {
    await signIn('google', { callbackUrl: window.location.href });
  };

  const handleEmailReport = async (email?: string) => {
    const to = (email || emailInput).trim();
    if (!to || !to.includes('@')) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setSending(true);
    setEmailError('');
    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, reportText, geoScore, url }),
      });
      if (!res.ok) throw new Error('Failed to send');
      setSent(true);
      onUnlocked();
    } catch {
      setEmailError('Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Signed-in users — pre-filled email, one click to send
  if (session) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="email"
            value={emailInput || session.user?.email || ''}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEmailReport()}
            placeholder="your@email.com"
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-56"
          />
          <button
            onClick={() => handleEmailReport()}
            disabled={sending || sent}
            className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {sent ? '✓ Report Sent!' : sending ? 'Sending...' : '✉ Email me this report'}
          </button>
        </div>
        {emailError && <p className="text-xs text-red-500">{emailError}</p>}
        {sent && (
          <p className="text-xs text-green-600 font-medium">
            Check your inbox — the report is on its way.
          </p>
        )}
      </div>
    );
  }

  // Not signed in — gate
  return (
    <div className="mt-4 bg-white border-2 border-indigo-200 rounded-xl p-5 text-center space-y-3">
      <div className="text-2xl">🔒</div>
      <div>
        <p className="font-bold text-gray-900 text-sm">Your report is ready</p>
        <p className="text-xs text-gray-500 mt-1">
          Sign in or enter your email to receive the full report.
        </p>
      </div>

      <button
        onClick={handleSignIn}
        className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-xl text-sm transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Sign in with Google — it's free
      </button>

      <p className="text-[11px] text-gray-400">Or enter your email to receive the report:</p>

      <div className="flex justify-center">
        <div className="flex gap-2 w-72">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEmailReport()}
            placeholder="your@email.com"
            className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={() => handleEmailReport()}
            disabled={sending || sent}
            className="text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {sent ? '✓ Sent!' : sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
      {emailError && <p className="text-xs text-red-500">{emailError}</p>}
      {sent && <p className="text-xs text-green-600 font-medium">Report sent! Check your inbox.</p>}
    </div>
  );
}
