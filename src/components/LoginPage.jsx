import React, { useState, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import './AuthPages.css';
import { BRAND } from '../constants/branding';

const cfciLogo = '/cfci-logo.jpg';

function friendlyLoginError(err) {
  const msg = err?.message || '';
  if (/\b500\b/i.test(msg)) {
    return 'Sign-in failed because of a server error. Try again shortly or continue as a guest.';
  }
  if (/fetch|network|failed to fetch/i.test(msg)) {
    return 'We could not reach the server. Check your connection and that the API is running.';
  }
  return msg || 'Invalid email or password';
}

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from && typeof location.state.from === 'string' ? location.state.from : '/';
  const isStaffEntry = redirectTo === '/admin';
  const [openAdminAfterLogin, setOpenAdminAfterLogin] = useState(isStaffEntry);

  const destinationAfterLogin = useMemo(() => {
    if (openAdminAfterLogin) return '/admin';
    return redirectTo;
  }, [openAdminAfterLogin, redirectTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await authAPI.login(email, password);
      
      // Login successful
      login(
        {
          id: response.user_id,
          email: response.email || email,
          firstname: response.firstname,
          lastname: response.lastname,
          is_staff: Boolean(response.is_staff),
        },
        response.access_token
      );

      navigate(destinationAfterLogin, { replace: true });
    } catch (err) {
      setError(friendlyLoginError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-header">
        <Link to="/">
          <img src={cfciLogo} alt={BRAND.LOGO_ALT} className="auth-logo" />
        </Link>
      </div>

      <div className="auth-content">
        <h1 className="auth-title">{isStaffEntry ? 'Staff sign in' : 'Welcome back!'}</h1>
        <p className="auth-subtitle">
          {isStaffEntry ? (
            <>
              Sign in with your <strong>staff</strong> account to open the <strong>admin submissions</strong>{' '}
              dashboard for {BRAND.PRODUCT_NAME}.
            </>
          ) : (
            <>Sign in to continue to {BRAND.PRODUCT_NAME}</>
          )}
        </p>

        {isStaffEntry && (
          <div className="auth-staff-callout" role="status">
            You opened this page from <strong>Staff admin</strong>. After a successful sign-in you&apos;ll go straight
            to the dashboard.
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              id="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              type="password"
              id="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">Create one</Link>
        </p>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <Link to="/" className="auth-guest-link">
          Continue as guest
        </Link>
      </div>
    </div>
  );
};

export default LoginPage;

