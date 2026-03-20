'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

const CONSENT_KEY = 'geo-training-consent';

export function ConsentModal() {
  const { data: session, status } = useSession();
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState(true);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      const existing = localStorage.getItem(CONSENT_KEY);
      if (existing === null) {
        // First time signed in — show modal
        setVisible(true);
      }
    }
  }, [status, session]);

  const handleSave = () => {
    localStorage.setItem(CONSENT_KEY, consent ? 'true' : 'false');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-xl">🧠</span>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-base">Help train a smarter GEO model</h2>
            <p className="text-xs text-gray-500">
              One-time preference — you can change this anytime
            </p>
          </div>
        </div>

        {/* Body */}
        <p className="text-sm text-gray-600 leading-relaxed">
          We're building a specialized AI model trained on real GEO analysis data. Your anonymized
          reports (page content, scores, signals) could help it learn what makes content more likely
          to be cited by AI engines.
        </p>

        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs text-gray-500">
          <div className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Data is fully anonymized — never linked to your name or email</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Only used to improve GEO scoring accuracy</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>You can opt out anytime from your account settings</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Never sold to third parties</span>
          </div>
        </div>

        {/* Consent toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setConsent(!consent)}
            className={`relative w-10 h-6 rounded-full transition-colors ${consent ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${consent ? 'translate-x-5' : 'translate-x-1'}`}
            />
          </div>
          <span className="text-sm text-gray-700 font-medium">
            {consent ? 'Yes, I want to help improve the tool' : 'No thanks, keep my data private'}
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            Save preference
          </button>
        </div>

        <p className="text-[11px] text-gray-400 text-center">
          By continuing you agree to our data practices described above.
        </p>
      </div>
    </div>
  );
}

// Helper to read consent from localStorage (used in AnalyzeTab)
export function getTrainingConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}
