import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import { chatAPI, conversationAPI, downloadBriefPdf } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LogoutModal from './LogoutModal';
import { BRAND } from '../constants/branding';
import { useInstructionsModal } from '../contexts/InstructionsModalContext';

const cfciLogo = '/cfci-logo.jpg';
const cfciIcon = '/cfci-icon.png';

const DISCIPLINE_OPTIONS = [
  'Software',
  'Mechanical',
  'Electrical',
  'Biomedical',
  'Data / ML',
  'Design / UX',
  'Other',
];

function buildAugmentedUserMessage(plain, disciplines, files) {
  const parts = [];
  if (disciplines.length > 0) {
    parts.push(`[Disciplines needed: ${disciplines.join(', ')}]`);
  }
  if (files.length > 0) {
    const names = files.map((f) => f.name).join(', ');
    parts.push(
      `[Attached for reference: ${names}. Full file upload to the server is not available yet—describe key details in your message if possible.]`
    );
  }
  if (parts.length === 0) return plain;
  return `${parts.join(' ')}\n\n${plain}`;
}

const LandingPage = () => {
  const { openInstructions } = useInstructionsModal();
  const [showGetStarted, setShowGetStarted] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState([]);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messageStepNum, setMessageStepNum] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [showBriefPanel, setShowBriefPanel] = useState(false);
  const [briefSubmitDone, setBriefSubmitDone] = useState(false);
  const [briefLocked, setBriefLocked] = useState(false);
  const [briefActionsOpen, setBriefActionsOpen] = useState(true);
  const [briefToast, setBriefToast] = useState('');

  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const { isAuthenticated, user, token, logout, isStaff } = useAuth();

  const authConversationId = typeof conversationId === 'number' ? conversationId : null;

  useEffect(() => {
    if (!token || !authConversationId) return;
    let cancelled = false;
    conversationAPI
      .getStatus(token, authConversationId)
      .then((s) => {
        if (!cancelled) setBriefLocked(Boolean(s.brief_locked_at));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, authConversationId, messages.length]);

  const toggleDiscipline = useCallback((label) => {
    setSelectedDisciplines((prev) =>
      prev.includes(label) ? prev.filter((d) => d !== label) : [...prev, label]
    );
  }, []);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    logout();
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const agentBriefExcerpt = useMemo(() => {
    return messages
      .filter((m) => m.sender === 'agent' && !m.isError && m.content)
      .map((m) => m.content)
      .join('\n\n---\n\n');
  }, [messages]);

  const handleSaveDraft = useCallback(async () => {
    if (!token || !authConversationId) return;
    try {
      await conversationAPI.saveDraft(token, authConversationId);
      setBriefToast('Draft saved.');
      setTimeout(() => setBriefToast(''), 3000);
    } catch (e) {
      setBriefToast(e.message || 'Could not save draft');
    }
  }, [token, authConversationId]);

  const handleDownloadPdf = useCallback(async () => {
    if (!token || !authConversationId) return;
    try {
      const blob = await downloadBriefPdf(token, authConversationId);
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = `project_brief_${authConversationId}.pdf`;
      a.click();
      URL.revokeObjectURL(u);
      setBriefToast('PDF downloaded.');
      setTimeout(() => setBriefToast(''), 2500);
    } catch (e) {
      setBriefToast(e.message || 'Could not generate PDF');
    }
  }, [token, authConversationId]);

  const handleEmailBrief = useCallback(async () => {
    if (!token || !authConversationId) return;
    try {
      const r = await conversationAPI.emailBriefStub(token, authConversationId);
      setBriefToast(r.message || 'Request recorded.');
      setTimeout(() => setBriefToast(''), 4000);
    } catch (e) {
      setBriefToast(e.message || 'Request failed');
    }
  }, [token, authConversationId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (briefLocked && isAuthenticated) return;
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    const messageForApi = buildAugmentedUserMessage(userMessage, selectedDisciplines, attachedFiles);

    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        content: userMessage,
        sender: 'user',
        timestamp: new Date(),
      },
    ]);

    setInputValue('');
    setIsLoading(true);
    setShowGetStarted(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    let convIdForRefresh = null;

    try {
      let response;

      if (isAuthenticated && token) {
        let currentConversationId = conversationId;
        let currentMessageStepNum = messageStepNum;

        if (!currentConversationId) {
          const initResponse = await chatAPI.initiate(token);
          currentConversationId = initResponse.conversation_id;
          currentMessageStepNum = 0;
          setConversationId(currentConversationId);
          setMessageStepNum(currentMessageStepNum);
        }

        convIdForRefresh = currentConversationId;

        response = await chatAPI.advance(
          token,
          currentConversationId,
          messageForApi,
          currentMessageStepNum + 1
        );

        setMessageStepNum(response.message_num);

        setMessages((prev) => [
          ...prev,
          {
            id: `agent-${Date.now()}`,
            content: response.content,
            sender: 'agent',
            timestamp: new Date(),
          },
        ]);
      } else {
        response = await chatAPI.sendMessage(messageForApi, conversationId);

        if (response.conversation_id) {
          setConversationId(response.conversation_id);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `agent-${Date.now()}`,
            content: response.message,
            sender: 'agent',
            timestamp: new Date(),
          },
        ]);
      }
      setAttachedFiles([]);
      if (token && typeof convIdForRefresh === 'number') {
        conversationAPI
          .getStatus(token, convIdForRefresh)
          .then((s) => {
            setBriefLocked(Boolean(s.brief_locked_at));
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errText = error?.message || '';
      if (/locked|403|brief has been reviewed/i.test(errText)) {
        setBriefLocked(true);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            content:
              'This intake brief is locked after staff review. You can still use **Save draft**, **Generate PDF**, and **Email brief** below.',
            sender: 'agent',
            isError: true,
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            content: "I'm sorry, I encountered an error. Please try again.",
            sender: 'agent',
            isError: true,
            timestamp: new Date(),
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files && files.length > 0) {
      const newFiles = files.map((file) => ({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      }));
      setAttachedFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = '';
  };

  const handlePDFAttach = () => {
    pdfInputRef.current?.click();
  };

  const handlePDFChange = (e) => {
    const files = Array.from(e.target.files);
    if (files && files.length > 0) {
      const newFiles = files.map((file) => ({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      }));
      setAttachedFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBuildClick = () => {
    setInputValue('I want to build ');
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleStartupNeedsClick = () => {
    setInputValue('My startup needs ');
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleLogoClick = () => {
    window.location.reload();
  };

  const handleSubmitToCfci = () => {
    setBriefSubmitDone(true);
  };

  const hasChatMessages = messages.length > 0;

  return (
    <div className="landing-page">
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
        email={user?.email}
      />

      {showBriefPanel && (
        <div
          className="brief-panel-overlay"
          role="presentation"
          onClick={() => setShowBriefPanel(false)}
        >
          <aside
            className="brief-panel"
            role="dialog"
            aria-labelledby="brief-panel-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="brief-panel-header">
              <h2 id="brief-panel-title" className="brief-panel-title">
                Review your brief
              </h2>
              <button
                type="button"
                className="brief-panel-close"
                onClick={() => setShowBriefPanel(false)}
                aria-label="Close brief panel"
              >
                ×
              </button>
            </div>
            <p className="brief-panel-lead">
              Below is a running summary from the assistant side of your conversation. When you are ready, submit to CFCI.
              Today your answers are stored by this app&apos;s server (database on disk by default); optional integrations like
              spreadsheets or file storage can be wired in later — the intake flow does not call Airtable yet.
            </p>
            <div
              className="brief-panel-body"
              dangerouslySetInnerHTML={{ __html: formatMessage(agentBriefExcerpt) || '<p class="brief-empty">No assistant messages yet.</p>' }}
            />
            {briefSubmitDone ? (
              <div className="brief-success" role="status">
                Thank you. Your intent to submit is recorded in this session. CFCI will finalize
                intake when the server integration is ready.
              </div>
            ) : (
              <button type="button" className="brief-submit-cfci" onClick={handleSubmitToCfci}>
                Submit to CFCI
              </button>
            )}
          </aside>
        </div>
      )}

      <header className="landing-header">
        <div className="landing-header-row">
          <div className="header-brand">
            <img
              src={cfciLogo}
              alt={BRAND.LOGO_ALT}
              className="header-logo"
              onClick={handleLogoClick}
            />
            <div className="header-brand-text">
              <span className="header-product-line">{BRAND.PRODUCT_NAME}</span>
              <span className="header-tagline">{BRAND.PRODUCT_TAGLINE}</span>
            </div>
          </div>
          <nav className="site-nav" aria-label="Primary">
            <Link to="/" className="site-nav-link is-active">
              Intake chat
            </Link>
            <Link to="/admin" className="site-nav-link site-nav-link-admin" title="Staff dashboard — sign in if prompted">
              <span className="site-nav-link-text">Staff admin</span>
              <span className="site-nav-badge" aria-hidden>
                Admin
              </span>
            </Link>
            {isStaff && (
              <Link to="/admin?tab=template" className="site-nav-link">
                Brief template
              </Link>
            )}
          </nav>
          <div className="header-auth">
            {hasChatMessages && (
              <button type="button" className="header-brief-btn" onClick={() => setShowBriefPanel(true)}>
                Brief &amp; submit
              </button>
            )}
            {isAuthenticated ? (
              <>
                <span className="user-greeting">Hi, {user?.firstname || user?.email}</span>
                <button className="header-auth-button" onClick={handleLogoutClick}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="header-auth-button">
                  Sign in
                </Link>
                <Link to="/register" className="header-auth-button primary">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="landing-content">
        {!hasChatMessages && (
          <>
            <div className="icon-container">
              <img src={cfciIcon} alt="" className="main-icon" aria-hidden />
            </div>
            <h1 className="landing-title">Tell us your idea.</h1>
          </>
        )}

        {hasChatMessages && (
          <div className="messages-container">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.sender === 'user' ? 'user-message' : 'agent-message'} ${message.isError ? 'error-message' : ''}`}
              >
                {message.sender === 'agent' && (
                  <div className="message-avatar">
                    <img src={cfciIcon} alt={BRAND.ASSISTANT_ALT} className="avatar-icon" />
                  </div>
                )}
                <div className="message-bubble">
                  <div
                    className="message-text"
                    dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                  />
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message agent-message">
                <div className="message-avatar">
                  <img src={cfciIcon} alt="" className="avatar-icon" aria-hidden />
                </div>
                <div className="message-bubble">
                  <div className="typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {hasChatMessages && isAuthenticated && authConversationId && briefActionsOpen && (
          <div className="brief-actions-bar" role="region" aria-label="Brief actions">
            {briefLocked && (
              <p className="brief-actions-locked">
                Staff has reviewed this brief — chat editing is locked. You can still export or email.
              </p>
            )}
            <div className="brief-actions-row">
              <button type="button" className="brief-action-btn brief-action-secondary" onClick={handleSaveDraft}>
                Save draft
              </button>
              <button
                type="button"
                className="brief-action-btn brief-action-secondary"
                onClick={() => setBriefActionsOpen(false)}
              >
                Back to chat
              </button>
              <button type="button" className="brief-action-btn brief-action-primary" onClick={handleDownloadPdf}>
                Generate PDF
              </button>
              <button type="button" className="brief-action-btn brief-action-email" onClick={handleEmailBrief}>
                Email brief
              </button>
            </div>
            {briefToast && <p className="brief-actions-toast">{briefToast}</p>}
          </div>
        )}

        {hasChatMessages && isAuthenticated && authConversationId && !briefActionsOpen && (
          <button type="button" className="brief-actions-reopen" onClick={() => setBriefActionsOpen(true)}>
            Show brief actions (save / PDF / email)
          </button>
        )}

        <section className="discipline-section" aria-labelledby="discipline-heading">
          <h2 id="discipline-heading" className="discipline-heading">
            What kind of work do you need?
          </h2>
          <p className="discipline-hint">Select all that apply—we include this with your messages to the assistant.</p>
          <div className="discipline-tags" role="group" aria-label="Disciplines">
            {DISCIPLINE_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={`discipline-tag ${selectedDisciplines.includes(d) ? 'is-selected' : ''}`}
                onClick={() => toggleDiscipline(d)}
                aria-pressed={selectedDisciplines.includes(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        {hasChatMessages && (
          <div className="chat-upload-toolbar" aria-label="Attach documents">
            <span className="chat-upload-label">Attachments</span>
            <button type="button" className="chat-upload-btn" onClick={handleFileAttach}>
              Files
            </button>
            <button type="button" className="chat-upload-btn" onClick={handlePDFAttach}>
              PDF
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="visually-hidden-input"
            multiple
          />
          <input
            type="file"
            ref={pdfInputRef}
            onChange={handlePDFChange}
            accept=".pdf,application/pdf"
            className="visually-hidden-input"
            multiple
          />
          <div className="input-container">
            <button
              type="button"
              className="attach-button"
              onClick={handleFileAttach}
              aria-label="Attach file"
              title="Attach file"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12.5 5.83333V14.1667C12.5 15.5474 11.3807 16.6667 10 16.6667C8.61929 16.6667 7.5 15.5474 7.5 14.1667V5C7.5 3.61929 8.61929 2.5 10 2.5C11.3807 2.5 12.5 3.61929 12.5 5V12.5C12.5 13.1904 11.9404 13.75 11.25 13.75C10.5596 13.75 10 13.1904 10 12.5V5.83333"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div className="input-content">
              {attachedFiles.length > 0 && (
                <div className="attached-files-inline">
                  {attachedFiles.map((fileInfo, index) => {
                    const fileExtension = fileInfo.name.split('.').pop()?.toUpperCase() || 'FILE';
                    return (
                      <div key={`${fileInfo.name}-${index}`} className="attached-file-inline">
                        <div className="file-indicator" style={{ backgroundColor: '#2563eb' }} />
                        <div className="file-details">
                          <span className="file-name-inline">{fileInfo.name}</span>
                          <span className="file-type">{fileExtension}</span>
                        </div>
                        <button
                          type="button"
                          className="remove-file-button-inline"
                          onClick={() => handleRemoveFile(index)}
                          aria-label="Remove file"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M9 3L3 9M3 3L9 9"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <textarea
                ref={textareaRef}
                className="text-input"
                placeholder="Describe your project or question…"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading || (briefLocked && isAuthenticated)}
              />
            </div>
            <button
              type="submit"
              className="send-button"
              aria-label="Send message"
              disabled={isLoading || !inputValue.trim() || (briefLocked && isAuthenticated)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M5 12H19M19 12L12 5M19 12L12 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </form>

        {!hasChatMessages && (
          <>
            {!showGetStarted && (
              <button type="button" className="show-suggestions-button" onClick={() => setShowGetStarted(true)}>
                Show suggestions
              </button>
            )}

            {showGetStarted && (
              <div className="get-started-section">
                <div className="get-started-header">
                  <h2 className="get-started-title">Get started</h2>
                  <button
                    type="button"
                    className="close-button"
                    onClick={() => setShowGetStarted(false)}
                    aria-label="Close get started section"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 4L4 12M4 4L12 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
                <div className="suggestion-cards">
                  <div className="suggestion-card" onClick={handlePDFAttach}>
                    <div className="card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 18V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="card-text">Attach relevant PDFs</p>
                  </div>
                  <div className="suggestion-card" onClick={handleBuildClick}>
                    <div className="card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M18.5 2.5C18.8978 2.10218 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10218 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p className="card-text">&quot;I want to build…&quot;</p>
                  </div>
                  <div className="suggestion-card" onClick={handleStartupNeedsClick}>
                    <div className="card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p className="card-text">&quot;My startup needs…&quot;</p>
                  </div>
                </div>
              </div>
            )}

            <button type="button" className="about-link" onClick={openInstructions}>
              Learn more about {BRAND.SHORT_NAME}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

function formatMessage(content) {
  if (!content) return '';

  let formatted = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  formatted = formatted.replace(/^---$/gm, '<hr />');
  formatted = formatted.replace(/\n/g, '<br />');

  return formatted;
}

export default LandingPage;
