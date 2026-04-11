import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import './AuthPages.css';
import { BRAND } from '../constants/branding';

const cfciLogo = '/cfci-logo.jpg';

function friendlyRegisterError(err) {
  const msg = err?.message || '';
  if (/\b500\b/i.test(msg) || /internal server error/i.test(msg)) {
    return 'We could not create your account because of a temporary server problem. Please try again shortly, or use “Continue as guest” from the home page while the team fixes the API.';
  }
  if (/status:\s*502|502\b|503\b|504\b/i.test(msg)) {
    return 'The server is unavailable right now. Try again in a few minutes.';
  }
  if (/fetch|network|failed to fetch/i.test(msg)) {
    return 'We could not reach the server. Check your connection and that the API is running.';
  }
  return msg || 'Registration failed. Please try again.';
}

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Register the user
      await authAPI.register(
        formData.email,
        formData.password,
        formData.firstname,
        formData.lastname
      );
      
      // Auto-login after registration
      const loginResponse = await authAPI.login(formData.email, formData.password);
      
      login(
        {
          id: loginResponse.user_id,
          email: formData.email,
          firstname: formData.firstname,
          lastname: formData.lastname,
          is_staff: Boolean(loginResponse.is_staff),
        },
        loginResponse.access_token
      );
      
      navigate('/');
    } catch (err) {
      setError(friendlyRegisterError(err));
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
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Join {BRAND.PRODUCT_NAME} to get started</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstname" className="form-label">First name</label>
              <input
                type="text"
                id="firstname"
                name="firstname"
                className="form-input"
                placeholder="John"
                value={formData.firstname}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastname" className="form-label">Last name</label>
              <input
                type="text"
                id="lastname"
                name="lastname"
                className="form-input"
                placeholder="Doe"
                value={formData.lastname}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-input"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Confirm password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              className="form-input"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
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

export default RegisterPage;

