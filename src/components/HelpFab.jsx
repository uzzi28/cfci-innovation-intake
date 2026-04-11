import React from 'react';
import './HelpFab.css';

/**
 * Floating control to reopen the welcome / instructions modal after it was dismissed.
 */
const HelpFab = ({ onClick, hidden }) => {
  if (hidden) return null;

  return (
    <button
      type="button"
      className="help-fab"
      onClick={onClick}
      aria-label="Open instructions and what to expect"
      title="Instructions"
    >
      <span className="help-fab-icon" aria-hidden>
        ?
      </span>
    </button>
  );
};

export default HelpFab;
