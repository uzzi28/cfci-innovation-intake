import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BRAND } from '../constants/branding';
import IntakeFormTemplateEditor from './IntakeFormTemplateEditor';
import './FormBuilder.css';

const FormBuilder = () => {
  const { token, isAuthenticated, isLoading: authLoading, isStaff } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !token) {
      navigate('/login', { replace: true, state: { from: '/admin/form-builder' } });
      return;
    }
    if (!isStaff) {
      navigate('/', { replace: true });
    }
  }, [authLoading, isAuthenticated, token, isStaff, navigate]);

  if (authLoading) {
    return (
      <div className="form-builder-page">
        <p className="fb-muted">Loading form builder…</p>
      </div>
    );
  }

  if (!isAuthenticated || !token || !isStaff) {
    return null;
  }

  return (
    <div className="form-builder-page">
      <header className="fb-header">
        <div>
          <Link to="/" className="fb-back">
            ← Home
          </Link>
          <h1 className="fb-title">Form builder</h1>
          <p className="fb-lead">Customize intake questions for {BRAND.PRODUCT_NAME} — same editor as Admin → Product brief template.</p>
        </div>
        <div className="fb-header-actions">
          <Link to="/admin" className="fb-btn fb-btn-ghost">
            Admin dashboard
          </Link>
        </div>
      </header>

      <IntakeFormTemplateEditor token={token} />
    </div>
  );
};

export default FormBuilder;
