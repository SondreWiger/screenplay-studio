'use client';

import { useState } from 'react';

export default function KillswitchPage() {
  const [step, setStep] = useState<'warning' | 'confirm' | 'key' | 'executing' | 'done' | 'error'>('warning');
  const [key, setKey] = useState('');
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [agreed, setAgreed] = useState(false);

  async function execute() {
    setStep('executing');
    try {
      const res = await fetch('/api/killswitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), confirmation: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || `Server error (${res.status})`);
        setStep('error');
        return;
      }
      setResult({ sent: data.sent, failed: data.failed, total: data.total });
      setStep('done');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error');
      setStep('error');
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #05050a;
          color: #e5e5ea;
          font-family: 'Inter', -apple-system, sans-serif;
          min-height: 100vh;
        }

        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(239,68,68,0.06) 0%, transparent 70%),
                      radial-gradient(ellipse 60% 40% at 80% 100%, rgba(99,102,241,0.04) 0%, transparent 60%),
                      #05050a;
        }

        .card {
          width: 100%;
          max-width: 560px;
          background: rgba(20, 20, 28, 0.95);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset;
          backdrop-filter: blur(20px);
          animation: fadeUp 0.4s ease both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 32px;
        }
        .logo-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 10px rgba(239,68,68,0.7);
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
        }
        .logo-name {
          font-size: 14px;
          font-weight: 500;
          color: #71717a;
          letter-spacing: 0.02em;
        }

        h1 {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          line-height: 1.3;
          margin-bottom: 12px;
          letter-spacing: -0.3px;
        }

        .subtitle {
          font-size: 13px;
          color: #71717a;
          line-height: 1.7;
          margin-bottom: 28px;
        }

        .warning-box {
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          padding: 18px;
          margin-bottom: 24px;
        }
        .warning-box p {
          font-size: 13px;
          line-height: 1.75;
          color: #fca5a5;
        }
        .warning-box strong {
          color: #fff;
        }

        .info-box {
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.18);
          border-radius: 10px;
          padding: 18px;
          margin-bottom: 24px;
        }
        .info-box p {
          font-size: 13px;
          line-height: 1.75;
          color: #a5b4fc;
        }
        .info-box ul {
          margin-top: 10px;
          padding-left: 18px;
        }
        .info-box li {
          font-size: 13px;
          line-height: 1.8;
          color: #818cf8;
        }

        .checkbox-row {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 24px;
          cursor: pointer;
        }
        .checkbox-row input[type="checkbox"] {
          appearance: none;
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          min-width: 18px;
          border: 1.5px solid rgba(255,255,255,0.2);
          border-radius: 4px;
          background: rgba(255,255,255,0.04);
          cursor: pointer;
          margin-top: 2px;
          position: relative;
          transition: border-color 0.15s, background 0.15s;
        }
        .checkbox-row input[type="checkbox"]:checked {
          background: #ef4444;
          border-color: #ef4444;
        }
        .checkbox-row input[type="checkbox"]:checked::after {
          content: '';
          position: absolute;
          left: 4px;
          top: 1px;
          width: 6px;
          height: 10px;
          border: 2px solid #fff;
          border-top: none;
          border-left: none;
          transform: rotate(45deg);
        }
        .checkbox-label {
          font-size: 13px;
          color: #a1a1aa;
          line-height: 1.6;
        }
        .checkbox-label strong {
          color: #e5e5ea;
        }

        .btn {
          width: 100%;
          padding: 14px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
          letter-spacing: 0.01em;
        }
        .btn-primary {
          background: #ef4444;
          color: #fff;
          box-shadow: 0 4px 16px rgba(239,68,68,0.3);
        }
        .btn-primary:hover:not(:disabled) {
          background: #dc2626;
          box-shadow: 0 6px 20px rgba(239,68,68,0.45);
          transform: translateY(-1px);
        }
        .btn-primary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .btn-secondary {
          background: rgba(255,255,255,0.05);
          color: #a1a1aa;
          border: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 12px;
        }
        .btn-secondary:hover {
          background: rgba(255,255,255,0.08);
          color: #e5e5ea;
        }

        .input-group {
          margin-bottom: 20px;
        }
        .input-label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
        }
        .input-field {
          width: 100%;
          padding: 12px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          font-family: 'Courier New', monospace;
          letter-spacing: 0.05em;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
        }
        .input-field::placeholder {
          color: #3f3f46;
        }
        .input-field:focus {
          border-color: rgba(239,68,68,0.5);
          box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
        }

        .divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 28px 0;
        }

        .step-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          color: #ef4444;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 20px;
          padding: 3px 10px;
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.08);
          border-top-color: #ef4444;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .success-icon {
          font-size: 40px;
          text-align: center;
          margin-bottom: 16px;
        }

        .stat-row {
          display: flex;
          gap: 12px;
          margin: 20px 0;
        }
        .stat {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 16px;
          text-align: center;
        }
        .stat-num {
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          line-height: 1;
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 11px;
          color: #52525b;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .stat-num.green { color: #4ade80; }
        .stat-num.red   { color: #f87171; }

        .footer-note {
          margin-top: 24px;
          font-size: 11px;
          color: #3f3f46;
          text-align: center;
          line-height: 1.6;
        }
      `}</style>

      <div className="page">
        <div className="card">
          <div className="logo">
            <div className="logo-dot" />
            <span className="logo-name">Screenplay Studio · Open-Source Kill Switch</span>
          </div>

          {/* ── STEP 1: Warning ── */}
          {step === 'warning' && (
            <>
              <div className="step-badge">Step 1 of 3 · Read carefully</div>
              <h1>Open-Source Kill Switch</h1>
              <p className="subtitle">
                This page exists so that Screenplay Studio can be gracefully handed over to its users
                if the creator is ever incapacitated or permanently unable to continue.
              </p>

              <div className="warning-box">
                <p>
                  <strong>This action is irreversible.</strong> Once executed, every registered user
                  will receive an email with instructions to download the repository, export their data,
                  and continue locally or self-host the app. The hosted service will be considered sunset.
                  <br /><br />
                  <strong>Only proceed if:</strong> Sondre is genuinely incapacitated, deceased, or
                  permanently unable to make decisions about this service, and you have been given the
                  activation key to carry out this final responsibility.
                </p>
              </div>

              <div className="info-box">
                <p>When executed, every user will be emailed:</p>
                <ul>
                  <li>An explanation of what happened</li>
                  <li>How to download and export their data</li>
                  <li>How to clone and run the app locally</li>
                  <li>How to self-host with Docker or Vercel</li>
                  <li>The GitHub repository link</li>
                </ul>
              </div>

              <button className="btn btn-primary" onClick={() => setStep('confirm')}>
                I understand — continue
              </button>
            </>
          )}

          {/* ── STEP 2: Confirmation ── */}
          {step === 'confirm' && (
            <>
              <div className="step-badge">Step 2 of 3 · Confirm intent</div>
              <h1>Confirm your intent</h1>
              <p className="subtitle">
                Before entering the activation key, please confirm that the following conditions are met.
              </p>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  id="agree-incapacitated"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span className="checkbox-label">
                  I confirm that <strong>Sondre Wiger</strong>, the creator of Screenplay Studio, is genuinely
                  incapacitated, deceased, or permanently unable to maintain or make decisions about this service —
                  and that I have been entrusted with this responsibility on his behalf.
                </span>
              </label>

              <div className="divider" />

              <button
                className="btn btn-primary"
                disabled={!agreed}
                onClick={() => setStep('key')}
              >
                Confirmed — enter activation key
              </button>
              <br /><br />
              <button className="btn btn-secondary" onClick={() => setStep('warning')}>
                ← Go back
              </button>
            </>
          )}

          {/* ── STEP 3: Key entry ── */}
          {step === 'key' && (
            <>
              <div className="step-badge">Step 3 of 3 · Enter key</div>
              <h1>Enter the activation key</h1>
              <p className="subtitle">
                Enter the UUID activation key you received from Sondre. This key is required to
                execute the kill switch and cannot be bypassed.
              </p>

              <div className="input-group">
                <label className="input-label" htmlFor="kill-key">Activation key</label>
                <input
                  id="kill-key"
                  className="input-field"
                  type="text"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="warning-box">
                <p>
                  <strong>Last chance.</strong> Clicking &quot;Execute kill switch&quot; will
                  immediately begin sending emails to all registered users. There is no undo.
                </p>
              </div>

              <button
                className="btn btn-primary"
                disabled={key.trim().length < 10}
                onClick={execute}
              >
                Execute kill switch
              </button>
              <br /><br />
              <button className="btn btn-secondary" onClick={() => { setStep('confirm'); setKey(''); }}>
                ← Go back
              </button>
            </>
          )}

          {/* ── Executing ── */}
          {step === 'executing' && (
            <>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div className="spinner" />
                <h1 style={{ textAlign: 'center', marginBottom: 12 }}>Sending emails…</h1>
                <p className="subtitle" style={{ textAlign: 'center' }}>
                  This may take a minute. Please keep this page open.
                </p>
              </div>
            </>
          )}

          {/* ── Done ── */}
          {step === 'done' && result && (
            <>
              <div className="success-icon">✅</div>
              <h1 style={{ textAlign: 'center', marginBottom: 8 }}>Kill switch executed</h1>
              <p className="subtitle" style={{ textAlign: 'center' }}>
                Every registered user has been notified with instructions to continue locally.
              </p>

              <div className="stat-row">
                <div className="stat">
                  <div className="stat-num">{result.total}</div>
                  <div className="stat-label">Total users</div>
                </div>
                <div className="stat">
                  <div className="stat-num green">{result.sent}</div>
                  <div className="stat-label">Emails sent</div>
                </div>
                <div className="stat">
                  <div className="stat-num red">{result.failed}</div>
                  <div className="stat-label">Failed</div>
                </div>
              </div>

              <div className="info-box" style={{ marginBottom: 0 }}>
                <p>
                  Users have been told how to clone the repository, export their data,
                  and self-host. Screenplay Studio lives on, in their hands. Thank you, Sondre.
                </p>
              </div>

              <p className="footer-note">
                github.com/anomalyco/screenplay-studio · MIT License
              </p>
            </>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <>
              <h1>Something went wrong</h1>
              <div className="warning-box" style={{ marginTop: 16 }}>
                <p><strong>Error:</strong> {errorMsg}</p>
              </div>
              <p className="subtitle" style={{ marginTop: 12 }}>
                Double-check the activation key and try again. If the problem persists,
                the server may not have the kill switch configured.
              </p>
              <button className="btn btn-secondary" onClick={() => { setStep('key'); setErrorMsg(''); }}>
                ← Try again
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
