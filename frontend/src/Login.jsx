import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from './AuthContext';

const Login = () => {
    const { login } = useContext(AuthContext);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [focusedField, setFocusedField] = useState(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 50);
        return () => clearTimeout(t);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        const result = await login(username, password);
        if (!result.success) {
            setError(result.message || 'Invalid credentials. Please try again.');
        }
        setIsLoading(false);
    };

    return (
        <>
            <style>{`
                @keyframes float-1 {
                    0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.4; }
                    50% { transform: translateY(-20px) rotate(10deg); opacity: 0.7; }
                }
                @keyframes float-2 {
                    0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
                    50% { transform: translateY(18px) rotate(-8deg); opacity: 0.6; }
                }
                @keyframes float-3 {
                    0%, 100% { transform: translateY(0px) scale(1); opacity: 0.2; }
                    50% { transform: translateY(-12px) scale(1.05); opacity: 0.5; }
                }
                @keyframes login-slide-up {
                    from { opacity: 0; transform: translateY(24px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse-ring {
                    0% { transform: scale(1); opacity: 0.4; }
                    50% { transform: scale(1.08); opacity: 0.15; }
                    100% { transform: scale(1); opacity: 0.4; }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-6px); }
                    40% { transform: translateX(6px); }
                    60% { transform: translateX(-4px); }
                    80% { transform: translateX(4px); }
                }

                .login-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    width: 100%;
                    background: #0a0a0f;
                    position: relative;
                    overflow: hidden;
                }

                .login-bg-gradient {
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(ellipse 60% 50% at 20% 20%, rgba(124,108,252,0.12) 0%, transparent 70%),
                        radial-gradient(ellipse 50% 60% at 80% 80%, rgba(90, 70, 220, 0.08) 0%, transparent 70%),
                        radial-gradient(ellipse 40% 40% at 50% 50%, rgba(60, 50, 140, 0.06) 0%, transparent 70%);
                    pointer-events: none;
                }

                .login-orb {
                    position: absolute;
                    border-radius: 50%;
                    pointer-events: none;
                    filter: blur(1px);
                }
                .login-orb-1 {
                    width: 300px; height: 300px;
                    top: -80px; left: -80px;
                    background: radial-gradient(circle, rgba(124,108,252,0.15) 0%, transparent 70%);
                    animation: float-1 8s ease-in-out infinite;
                }
                .login-orb-2 {
                    width: 200px; height: 200px;
                    bottom: -40px; right: 10%;
                    background: radial-gradient(circle, rgba(90,70,220,0.12) 0%, transparent 70%);
                    animation: float-2 10s ease-in-out infinite;
                }
                .login-orb-3 {
                    width: 150px; height: 150px;
                    top: 40%; right: -30px;
                    background: radial-gradient(circle, rgba(168,159,255,0.1) 0%, transparent 70%);
                    animation: float-3 7s ease-in-out infinite;
                }

                .grid-overlay {
                    position: absolute;
                    inset: 0;
                    background-image:
                        linear-gradient(rgba(124,108,252,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(124,108,252,0.03) 1px, transparent 1px);
                    background-size: 48px 48px;
                    pointer-events: none;
                }

                .login-card {
                    position: relative;
                    width: 420px;
                    padding: 48px 44px;
                    background: rgba(15, 15, 24, 0.8);
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 24px;
                    box-shadow:
                        0 0 0 1px rgba(124,108,252,0.08),
                        0 24px 80px rgba(0,0,0,0.6),
                        inset 0 1px 0 rgba(255,255,255,0.06);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    opacity: ${mounted ? 1 : 0};
                    transform: ${mounted ? 'translateY(0)' : 'translateY(24px)'};
                    transition: opacity 0.5s ease, transform 0.5s ease;
                    z-index: 10;
                }

                .logo-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-bottom: 32px;
                }

                .logo-icon {
                    position: relative;
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .logo-icon-ring {
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    border: 1.5px solid rgba(124,108,252,0.5);
                    animation: pulse-ring 3s ease-in-out infinite;
                }

                .logo-icon-inner {
                    width: 34px;
                    height: 34px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #6c5ce7 0%, #a89fff 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 20px rgba(124,108,252,0.5);
                }

                .logo-text {
                    font-size: 1.5rem;
                    font-weight: 700;
                    letter-spacing: -0.04em;
                    color: var(--text-primary);
                }
                .logo-text span {
                    color: #7c6cfc;
                }

                .login-subtitle {
                    text-align: center;
                    color: var(--text-muted);
                    font-size: 0.82rem;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    font-weight: 500;
                    margin-bottom: 36px;
                    padding-bottom: 28px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .login-field-group {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    margin-bottom: 24px;
                }

                .login-field {
                    position: relative;
                }

                .login-field-label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    letter-spacing: 0.04em;
                    margin-bottom: 7px;
                    text-transform: uppercase;
                    transition: color var(--transition);
                }
                .login-field.focused .login-field-label {
                    color: #a89fff;
                }

                .login-input {
                    width: 100%;
                    padding: 13px 16px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 10px;
                    color: var(--text-primary);
                    font-size: 0.95rem;
                    font-family: var(--font-sans);
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
                    letter-spacing: 0.01em;
                }
                .login-input::placeholder {
                    color: rgba(144, 144, 168, 0.4);
                }
                .login-input:focus {
                    border-color: rgba(124,108,252,0.5);
                    background: rgba(124,108,252,0.04);
                    box-shadow: 0 0 0 3px rgba(124,108,252,0.1), inset 0 1px 2px rgba(0,0,0,0.3);
                }

                .login-error {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 11px 14px;
                    background: rgba(224, 82, 82, 0.08);
                    border: 1px solid rgba(224, 82, 82, 0.2);
                    border-radius: 8px;
                    color: #ff7c7c;
                    font-size: 0.83rem;
                    margin-bottom: 18px;
                    animation: shake 0.4s ease;
                }

                .login-btn {
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, #6c5ce7 0%, #7c6cfc 60%, #9d8fff 100%);
                    color: #fff;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.93rem;
                    font-weight: 600;
                    font-family: var(--font-sans);
                    cursor: pointer;
                    letter-spacing: 0.02em;
                    transition: opacity 0.18s, transform 0.18s, box-shadow 0.18s;
                    box-shadow: 0 4px 20px rgba(124,108,252,0.35);
                    position: relative;
                    overflow: hidden;
                }
                .login-btn::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(rgba(255,255,255,0.08), transparent);
                    pointer-events: none;
                }
                .login-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 28px rgba(124,108,252,0.5);
                }
                .login-btn:active:not(:disabled) {
                    transform: translateY(0);
                }
                .login-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .login-btn-loader {
                    display: inline-block;
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin-slow 0.7s linear infinite;
                    margin-right: 8px;
                    vertical-align: middle;
                }

                .login-footer {
                    text-align: center;
                    margin-top: 28px;
                    color: var(--text-muted);
                    font-size: 0.73rem;
                    letter-spacing: 0.05em;
                }
            `}</style>

            <div className="login-container">
                <div className="login-bg-gradient" />
                <div className="grid-overlay" />
                <div className="login-orb login-orb-1" />
                <div className="login-orb login-orb-2" />
                <div className="login-orb login-orb-3" />

                <div className="login-card">
                    <div className="logo-wrapper">
                        <div className="logo-icon">
                            <div className="logo-icon-ring" />
                            <div className="logo-icon-inner">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                </svg>
                            </div>
                        </div>
                        <div className="logo-text">Hal<span>kill</span></div>
                    </div>

                    <p className="login-subtitle">Intelligence Engine · Secure Access</p>

                    {error && (
                        <div className="login-error">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="login-field-group">
                            <div className={`login-field ${focusedField === 'username' ? 'focused' : ''}`}>
                                <label className="login-field-label" htmlFor="username">Username</label>
                                <input
                                    id="username"
                                    className="login-input"
                                    type="text"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    onFocus={() => setFocusedField('username')}
                                    onBlur={() => setFocusedField(null)}
                                    autoComplete="username"
                                    required
                                />
                            </div>
                            <div className={`login-field ${focusedField === 'password' ? 'focused' : ''}`}>
                                <label className="login-field-label" htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    className="login-input"
                                    type="password"
                                    placeholder="••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onFocus={() => setFocusedField('password')}
                                    onBlur={() => setFocusedField(null)}
                                    autoComplete="current-password"
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="login-btn" disabled={isLoading}>
                            {isLoading && <span className="login-btn-loader" />}
                            {isLoading ? 'Authenticating...' : 'Enter Vault'}
                        </button>
                    </form>

                    <p className="login-footer">Protected · End-to-End Encrypted · Private</p>
                </div>
            </div>
        </>
    );
};

export default Login;