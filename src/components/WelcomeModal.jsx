import React from 'react';
import './WelcomeModal.css';
import { BRAND } from '../constants/branding';

const WelcomeModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="intro-modal-overlay" onClick={onClose}>
      <div className="intro-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="intro-modal-title">
        <header className="intro-modal-brand">
          <div className="intro-brand-icon" aria-hidden>
            <span className="intro-brand-ring">
              <span className="intro-brand-ring-core" />
            </span>
          </div>
          <div className="intro-brand-text">
            <span className="intro-brand-kicker">Duke University</span>
            <span className="intro-brand-title">Engineering project intake</span>
          </div>
        </header>

        <h1 id="intro-modal-title" className="intro-modal-headline">
          Let&apos;s bring your idea to life.
        </h1>
        <p className="intro-modal-lead">
          We&apos;ll ask you a few questions about your idea to build a complete brief. This typically takes 5–10 minutes.
        </p>

        <section className="intro-expect" aria-label="What to expect">
          <h2 className="intro-expect-label">What to expect</h2>
          <ul className="intro-expect-list">
            <li>
              <span className="intro-expect-icon" aria-hidden>💬</span>
              <span>
                <strong>Chat with our AI assistant</strong> to refine your idea
              </span>
            </li>
            <li>
              <span className="intro-expect-icon" aria-hidden>📝</span>
              <span>
                <strong>Preview and edit</strong> your product brief
              </span>
            </li>
            <li>
              <span className="intro-expect-icon" aria-hidden>📄</span>
              <span>
                <strong>Download a PDF</strong> to submit to CFCI
              </span>
            </li>
          </ul>
        </section>

        <p className="intro-modal-footnote">
          You&apos;re using <strong>{BRAND.PRODUCT_NAME}</strong>. Before you submit, you can review our{' '}
          <a
            href="https://drive.google.com/file/d/1ER7oPqx6F8OlBkUtvYbKXjcyGvtRrNTg/view"
            target="_blank"
            rel="noopener noreferrer"
            className="intro-modal-link"
            onClick={(e) => e.stopPropagation()}
          >
            project intake sponsorship one-pager
          </a>
          .
        </p>

        <button type="button" className="intro-modal-cta" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
};

export default WelcomeModal;
