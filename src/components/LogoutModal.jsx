import React from 'react';
import './LogoutModal.css';
import { BRAND } from '../constants/branding';

const LogoutModal = ({ isOpen, onClose, onConfirm, email }) => {
  if (!isOpen) return null;

  return (
    <div className="logout-modal-overlay" onClick={onClose}>
      <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="logout-modal-title">Are you sure you want to log out?</h2>
        <p className="logout-modal-text">
          Log out of {BRAND.PRODUCT_NAME} as <strong>{email}</strong>?
        </p>
        <div className="logout-modal-buttons">
          <button className="logout-cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="logout-confirm-button" onClick={onConfirm}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;

