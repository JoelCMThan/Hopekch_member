import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { getDashboardPath } from '../../permissions';
import './Login.css';

const EyeIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(email, password);
      navigate(getDashboardPath(user.role), { replace: true });
    } catch (err) {
      // Keep email and password — don't clear them
      setError(err.response?.data?.message || 'Incorrect email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">

        {/* Branding */}
        <div className="login-header">
          <h1 className="login-title">Hope Church</h1>
          <p className="login-subtitle">Your gateway to Hope Church</p>
        </div>

        {/* Card */}
        <div className="login-card">
          <div className="login-accent-bar" />

          <div className="login-card-header">
            <h2>Welcome Back</h2>
            <p>Please enter your credentials to access the system.</p>
          </div>

          {error && <div className="login-error alert-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">

            <div className="field">
              <label className="field-label">Email Address</label>
              <input
                className="field-input"
                type="email"
                name="email"
                placeholder="pastor@hopechurch.org"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                autoComplete="email"
                required
              />
            </div>

            <div className="field">
              <label className="field-label">Password</label>
              <div className="login-password-wrap">
                <input
                  className="field-input"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="login-btn btn btn--primary btn--md">
              {loading ? 'Signing in…' : 'Login to Dashboard'}
              <span className="arrow">→</span>
            </button>

          </form>
        </div>

        <p className="login-footer-note">
          Management systems are for authorised personnel only. All activity is monitored.
        </p>

      </div>
    </div>
  );
};

export default Login;
