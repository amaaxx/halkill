import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import './Login.css';

const FEATURES = [
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a89fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    title: 'Document Intelligence',
    desc: 'Ask questions and get grounded answers with precise source citations.',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a89fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
    title: 'Vision Analysis',
    desc: 'Attach images alongside text for rich multimodal understanding.',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a89fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Strict Mode',
    desc: 'Toggle between document-strict and hybrid AI responses to control hallucinations.',
  },
];

const Login = () => {
  const { login } = useContext(AuthContext);
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused]     = useState(null);
  const [visible, setVisible]     = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await login(username, password);
    if (!result.success) setError(result.message || 'Invalid credentials. Please try again.');
    setIsLoading(false);
  };

  return (
    <div className="ln-root">
      {/* Animated background */}
      <div className="ln-bg">
        <div className="ln-blob b1" />
        <div className="ln-blob b2" />
        <div className="ln-blob b3" />
        <div className="ln-grid"   />
      </div>

      <div className={`ln-wrap${visible ? ' visible' : ''}`}>

        {/* ── Left branding panel ── */}
        <div className="ln-left">
          <div className="ln-logo">
            <div className="ln-logo-mark">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className="ln-logo-name">Hal<span>kill</span></div>
          </div>

          <h1 className="ln-h1">
            Ask your<br />
            <em>documents</em><br />
            anything.
          </h1>

          <p className="ln-lead">
            An intelligence engine that reads, understands, and converses
            with your files — with full source attribution and confidence scoring.
          </p>

          <div className="ln-features">
            {FEATURES.map((f, i) => (
              <div key={i} className="ln-feature">
                <div className="ln-f-icon">{f.icon}</div>
                <div>
                  <div className="ln-f-title">{f.title}</div>
                  <div className="ln-f-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="ln-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            RAG-Powered Intelligence · v2.0 · Private Beta
          </div>
        </div>

        {/* ── Right form card ── */}
        <div className="ln-right">
          <div className="ln-card">
            <div className="ln-card-top">
              <div className="ln-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h2 className="ln-card-title">Vault Access</h2>
              <p className="ln-card-sub">Sign in to your private knowledge base</p>
            </div>

            {error && (
              <div className="ln-err">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8"  x2="12"   y2="12"   />
                  <line x1="12" y1="16" x2="12.01" y2="16"  />
                </svg>
                {error}
              </div>
            )}

            <form className="ln-form" onSubmit={handleSubmit}>
              <div className={`ln-field${focused === 'u' ? ' focused' : ''}`}>
                <label htmlFor="hk-username">Username</label>
                <input
                  id="hk-username"
                  type="text"
                  placeholder="your_username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onFocus={() => setFocused('u')}
                  onBlur={() => setFocused(null)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className={`ln-field${focused === 'p' ? ' focused' : ''}`}>
                <label htmlFor="hk-password">Password</label>
                <input
                  id="hk-password"
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('p')}
                  onBlur={() => setFocused(null)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button type="submit" className="ln-btn" disabled={isLoading}>
                <span className="ln-btn-row">
                  {isLoading ? (
                    <><span className="ln-spinner" /> Authenticating...</>
                  ) : (
                    <>
                      Enter Vault
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </form>

            <p className="ln-card-footer">🔒 End-to-end encrypted · Private · Secure</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;