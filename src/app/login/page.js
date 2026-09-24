'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuctionArenaLogo from '@/components/AuctionArenaLogo';

function LoginPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode state: 'signin' | 'register'
  const initialMode = searchParams.get('tab') === 'register' ? 'register' : 'signin';
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Theme state
  const [theme, setTheme] = useState('dark');

  // Form states
  const [signinForm, setSigninForm] = useState({
    email: '',
    password: '',
    remember: true,
  });

  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    phone: '',
    tournamentName: '',
    password: '',
    confirmPassword: '',
    agreeTerms: true,
  });



  useEffect(() => {
    const saved = localStorage.getItem('player_auction_theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('player_auction_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };



  const handleSigninChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSigninForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
  };

  const handleRegisterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRegisterForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
  };

  const handleSigninSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signinForm.email,
          password: signinForm.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid credentials. Please recheck your email and password.');
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      setError('Connection error. Please verify your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match. Please recheck.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerForm.name,
          email: registerForm.email,
          password: registerForm.password,
          phone: registerForm.phone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-portal-wrapper">
      {/* Ambient Stadium Light Orbs */}
      <div className="ambient-orb orb-primary" />
      <div className="ambient-orb orb-secondary" />
      <div className="ambient-orb orb-tertiary" />

      {/* Top Navigation Header */}
      <header className="portal-header">
        <div className="portal-header__inner">
          <div className="portal-header__brand-group">
            <Link href="/" className="portal-header__brand-link">
              <AuctionArenaLogo size="small" />
            </Link>
            <div className="live-status-pill">
              <span className="live-dot-pulse" />
              <span>ARENA LIVE</span>
            </div>
          </div>

          <nav className="portal-header__nav">
            <Link href="/#tournaments" className="portal-nav-link">
              Watch Live Auctions
            </Link>
            <button
              onClick={() => {
                setMode('signin');
                setError('');
              }}
              className={`portal-nav-link ${mode === 'signin' ? 'active' : ''}`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`portal-nav-link ${mode === 'register' ? 'active' : ''}`}
            >
              Create Account
            </button>
            <Link href="/#features" className="portal-nav-link">
              Features
            </Link>
          </nav>

          <div className="portal-header__actions">
            <Link href="/#tournaments" className="btn-watch-live-chip">
              <span className="material-symbols-outlined icon-18">live_tv</span>
              <span>Watch Live</span>
            </Link>

            <button
              onClick={toggleTheme}
              className="portal-theme-btn"
              title="Toggle dark/light theme"
              aria-label="Toggle theme"
            >
              <span className="material-symbols-outlined icon-18">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main 2-Column Split Portal View */}
      <main className="portal-main-container">
        <div className="portal-grid">
          {/* LEFT 55%: Visual Broadcast Showcase */}
          <section className="portal-left-showcase">
            {/* Top Telemetry & Headline */}
            <div className="showcase-telemetry-block">
              <div className="telemetry-badges-row">
                <div className="telemetry-chip secondary">
                  <span className="pulse-dot" />
                  <span>Sports Player Auction Platform</span>
                </div>
                <div className="telemetry-chip subtle">
                  <span className="material-symbols-outlined icon-14">lock_reset</span>
                  <span>Broadcast Terminal V3.4</span>
                </div>
              </div>

              <h1 className="showcase-headline">
                Your Auction. <br />
                <span className="gradient-highlight">Your Teams. Your Game.</span>
              </h1>

              <p className="showcase-subtext">
                Create tournaments, manage players, control live bidding, and build winning squads from
                one broadcast-grade command deck.
              </p>
            </div>



            {/* Bottom Feature Ticker Strip */}
            <div className="showcase-ticker-strip">
              <div className="ticker-card">
                <span className="material-symbols-outlined ticker-icon secondary">speed</span>
                <div>
                  <p className="ticker-title">Ultra-Low Latency</p>
                  <p className="ticker-sub">&lt;14ms Bid Engine</p>
                </div>
              </div>

              <div className="ticker-card">
                <span className="material-symbols-outlined ticker-icon primary">videocam</span>
                <div>
                  <p className="ticker-title">OBS Integration</p>
                  <p className="ticker-sub">Realtime Graphic Stream</p>
                </div>
              </div>

              <div className="ticker-card">
                <span className="material-symbols-outlined ticker-icon tertiary">connected_tv</span>
                <div>
                  <p className="ticker-title">Dual-Screen Deck</p>
                  <p className="ticker-sub">Stage Projector Ready</p>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT 45%: Glassmorphism Authentication Panel */}
          <section className="portal-right-auth">
            <div className="auth-card-panel">
              <div className="card-top-glow-line" />

              {/* Panel Header */}
              <div className="auth-card-header">
                <div className="auth-title-row">
                  <h2 className="auth-main-title">
                    {mode === 'signin' ? 'Welcome back' : 'Create Organizer Account'}
                  </h2>
                  <span className="material-symbols-outlined icon-24 primary-color">
                    {mode === 'signin' ? 'verified_user' : 'app_registration'}
                  </span>
                </div>
                <p className="auth-subtext">
                  {mode === 'signin'
                    ? 'Sign in to manage your sports tournaments and live bidding stages.'
                    : 'Get started in minutes to host and broadcast world-class player auctions.'}
                </p>
              </div>

              {/* Segmented Switcher */}
              <div className="auth-segmented-switch">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError('');
                  }}
                  className={`switch-tab ${mode === 'signin' ? 'active' : ''}`}
                >
                  <span className="material-symbols-outlined icon-18">login</span>
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`switch-tab ${mode === 'register' ? 'active' : ''}`}
                >
                  <span className="material-symbols-outlined icon-18">how_to_reg</span>
                  <span>Create Account</span>
                </button>
              </div>

              {/* Error / Alert Banner */}
              {error && (
                <div className="auth-alert-banner">
                  <span className="material-symbols-outlined icon-20 danger-color">error</span>
                  <span className="alert-message">{error}</span>
                  <button
                    type="button"
                    onClick={() => setError('')}
                    className="alert-close-btn"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* VIEW 1: SIGN IN */}
              {mode === 'signin' && (
                <form onSubmit={handleSigninSubmit} className="auth-form-body">
                  <div className="auth-field-group">
                    <label htmlFor="signin-email" className="auth-label">
                      Email Address
                    </label>
                    <div className="input-with-icon">
                      <span className="material-symbols-outlined input-icon">mail</span>
                      <input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="organizer@premierleague.com"
                        value={signinForm.email}
                        onChange={handleSigninChange}
                        className="auth-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-field-group">
                    <div className="field-label-row">
                      <label htmlFor="signin-password" className="auth-label">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => alert('Password reset is available by contacting your tournament administrator or system support.')}
                        className="link-subtle"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="input-with-icon">
                      <span className="material-symbols-outlined input-icon">lock</span>
                      <input
                        id="signin-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={signinForm.password}
                        onChange={handleSigninChange}
                        className="auth-input"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="btn-password-eye"
                        aria-label="Toggle password view"
                      >
                        <span className="material-symbols-outlined icon-18">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="auth-options-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="remember"
                        checked={signinForm.remember}
                        onChange={handleSigninChange}
                        className="auth-checkbox"
                      />
                      <span>Remember terminal</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-auth-primary"
                  >
                    {loading ? (
                      <span className="btn-spinner-row">
                        <span className="spinner-sm" />
                        <span>Authenticating...</span>
                      </span>
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>

                  <div className="auth-switch-footer">
                    <span>Don&apos;t have an organizer account?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setError('');
                      }}
                      className="link-switch"
                    >
                      Create Account
                    </button>
                  </div>
                </form>
              )}

              {/* VIEW 2: CREATE ORGANIZER ACCOUNT */}
              {mode === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="auth-form-body">
                  <div className="auth-field-group">
                    <label htmlFor="reg-name" className="auth-label">
                      Full Name
                    </label>
                    <div className="input-with-icon">
                      <span className="material-symbols-outlined input-icon">person</span>
                      <input
                        id="reg-name"
                        name="name"
                        type="text"
                        placeholder="Vikramaditya Rathore"
                        value={registerForm.name}
                        onChange={handleRegisterChange}
                        className="auth-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-grid-2">
                    <div className="auth-field-group">
                      <label htmlFor="reg-email" className="auth-label">
                        Work Email
                      </label>
                      <div className="input-with-icon">
                        <span className="material-symbols-outlined input-icon">mail</span>
                        <input
                          id="reg-email"
                          name="email"
                          type="email"
                          placeholder="admin@league.org"
                          value={registerForm.email}
                          onChange={handleRegisterChange}
                          className="auth-input"
                          required
                        />
                      </div>
                    </div>

                    <div className="auth-field-group">
                      <label htmlFor="reg-phone" className="auth-label">
                        Mobile Number
                      </label>
                      <div className="input-with-icon">
                        <span className="material-symbols-outlined input-icon">phone</span>
                        <input
                          id="reg-phone"
                          name="phone"
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={registerForm.phone}
                          onChange={handleRegisterChange}
                          className="auth-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="auth-field-group">
                    <label htmlFor="reg-tournament" className="auth-label">
                      Tournament / Club Name (Optional)
                    </label>
                    <div className="input-with-icon">
                      <span className="material-symbols-outlined input-icon">emoji_events</span>
                      <input
                        id="reg-tournament"
                        name="tournamentName"
                        type="text"
                        placeholder="Apex Corporate Cricket League 2026"
                        value={registerForm.tournamentName}
                        onChange={handleRegisterChange}
                        className="auth-input"
                      />
                    </div>
                  </div>

                  <div className="auth-grid-2">
                    <div className="auth-field-group">
                      <label htmlFor="reg-password" className="auth-label">
                        Password
                      </label>
                      <div className="input-with-icon">
                        <span className="material-symbols-outlined input-icon">lock</span>
                        <input
                          id="reg-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create password"
                          value={registerForm.password}
                          onChange={handleRegisterChange}
                          className="auth-input"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    <div className="auth-field-group">
                      <label htmlFor="reg-confirm-password" className="auth-label">
                        Confirm
                      </label>
                      <div className="input-with-icon">
                        <span className="material-symbols-outlined input-icon">lock_clock</span>
                        <input
                          id="reg-confirm-password"
                          name="confirmPassword"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Repeat password"
                          value={registerForm.confirmPassword}
                          onChange={handleRegisterChange}
                          className="auth-input"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="auth-options-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="agreeTerms"
                        checked={registerForm.agreeTerms}
                        onChange={handleRegisterChange}
                        className="auth-checkbox"
                        required
                      />
                      <span>
                        I agree to the <a href="#" className="link-highlight">Terms of Service</a> &{' '}
                        <a href="#" className="link-highlight">Privacy Policy</a>
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-auth-primary"
                  >
                    {loading ? (
                      <span className="btn-spinner-row">
                        <span className="spinner-sm" />
                        <span>Creating Account...</span>
                      </span>
                    ) : (
                      <span>Create Organizer Account</span>
                    )}
                  </button>

                  <div className="auth-switch-footer">
                    <span>Already registered as an organizer?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setError('');
                      }}
                      className="link-switch"
                    >
                      Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="portal-loading"><div className="spinner" /></div>}>
      <LoginPortalContent />
    </Suspense>
  );
}
