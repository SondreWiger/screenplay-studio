'use client';

import { useState, useEffect } from 'react';

const CONSENT_KEY = 'ss_cookie_consent';

export type CookieConsent = {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
};

function getConsent(): CookieConsent | null {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

function setConsent(consent: CookieConsent) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {}
}

export function CookieConsentBanner() {
  const [show, setShow] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const consent = getConsent();
    if (!consent) {
      setShow(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const consent: CookieConsent = {
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    };
    setConsent(consent);
    setShow(false);
  };

  const handleAcceptNecessary = () => {
    const consent: CookieConsent = {
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    };
    setConsent(consent);
    setShow(false);
  };

  const handleSavePreferences = () => {
    const consent: CookieConsent = {
      necessary: true,
      analytics,
      marketing,
      timestamp: new Date().toISOString(),
    };
    setConsent(consent);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-slide-up">
      <div className="max-w-2xl mx-auto bg-surface-900 border border-surface-700 rounded-xl shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-brand-500/10 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">We respect your privacy</h3>
            <p className="text-xs text-surface-400 leading-relaxed">
              We use cookies to improve your experience. Necessary cookies are always active.
              You can choose which optional cookies to allow.{' '}
              <a href="/privacy" className="text-brand-400 hover:text-brand-300 underline">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>

        {showDetails && (
          <div className="mb-4 space-y-3 bg-surface-800 rounded-lg p-4">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-white">Necessary</span>
                <p className="text-[10px] text-surface-500">Required for the app to function. Cannot be disabled.</p>
              </div>
              <input type="checkbox" checked disabled className="rounded border-surface-600 bg-surface-700 text-brand-500" />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-white">Analytics</span>
                <p className="text-[10px] text-surface-500">Help us understand how you use the app.</p>
              </div>
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)}
                className="rounded border-surface-600 bg-surface-700 text-brand-500 focus:ring-brand-500" />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-white">Marketing</span>
                <p className="text-[10px] text-surface-500">Personalized recommendations and offers.</p>
              </div>
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)}
                className="rounded border-surface-600 bg-surface-700 text-brand-500 focus:ring-brand-500" />
            </label>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {showDetails ? (
            <button onClick={handleSavePreferences}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium transition-colors">
              Save Preferences
            </button>
          ) : (
            <>
              <button onClick={handleAcceptAll}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium transition-colors">
                Accept All
              </button>
              <button onClick={handleAcceptNecessary}
                className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-lg text-xs font-medium transition-colors">
                Necessary Only
              </button>
            </>
          )}
          <button onClick={() => setShowDetails(!showDetails)}
            className="px-4 py-2 text-surface-400 hover:text-white text-xs font-medium transition-colors">
            {showDetails ? 'Hide Details' : 'Customize'}
          </button>
        </div>
      </div>
    </div>
  );
}
