import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../services/api';
import { BRAND } from '../constants/branding';
import { computeAdminDemoMode } from '../utils/adminDemoMode';
import { DEMO_INTAKE_TEMPLATE, DEMO_SUBMISSIONS_LIST, getDemoSubmissionDetail } from '../data/adminDemoData';
import IntakeFormTemplateEditor from './IntakeFormTemplateEditor';
import './AdminDashboard.css';

const cfciLogo = '/cfci-logo.jpg';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const AdminDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const demoMode = useMemo(() => computeAdminDemoMode(searchParams), [searchParams]);
  const dashboardSection = searchParams.get('tab') === 'template' ? 'template' : 'submissions';

  const { token, user, isAuthenticated, isLoading: authLoading, isStaff } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState(() => (demoMode ? [...DEMO_SUBMISSIONS_LIST] : []));
  const [total, setTotal] = useState(() => (demoMode ? DEMO_SUBMISSIONS_LIST.length : 0));
  const [listError, setListError] = useState('');
  const [loadingList, setLoadingList] = useState(() => !demoMode);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterTab, setFilterTab] = useState('all');
  const [detailArtifact, setDetailArtifact] = useState('brief');
  const [statusSaving, setStatusSaving] = useState(false);

  const allowedHere = demoMode || Boolean(isStaff);

  const setDashboardSection = useCallback(
    (next) => {
      const p = new URLSearchParams(searchParams);
      if (next === 'template') p.set('tab', 'template');
      else p.delete('tab');
      setSearchParams(p, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // When URL adds ?demo=1 after mount, pick up demo data
  useEffect(() => {
    if (demoMode) {
      setSubmissions([...DEMO_SUBMISSIONS_LIST]);
      setTotal(DEMO_SUBMISSIONS_LIST.length);
      setLoadingList(false);
      setListError('');
    }
  }, [demoMode]);

  const loadList = useCallback(async () => {
    if (demoMode) {
      setListError('');
      setLoadingList(true);
      await new Promise((r) => setTimeout(r, 250));
      setSubmissions([...DEMO_SUBMISSIONS_LIST]);
      setTotal(DEMO_SUBMISSIONS_LIST.length);
      setLoadingList(false);
      return;
    }
    if (!token) return;
    setListError('');
    setLoadingList(true);
    try {
      const data = await adminAPI.listSubmissions(token);
      setSubmissions(data.submissions || []);
      setTotal(data.total ?? (data.submissions || []).length);
    } catch (e) {
      setListError(e.message || 'Could not load submissions.');
      setSubmissions([]);
    } finally {
      setLoadingList(false);
    }
  }, [token, demoMode]);

  useEffect(() => {
    if (demoMode) return;
    if (authLoading) return;
    if (!isAuthenticated || !token) {
      navigate('/login', { replace: true, state: { from: '/admin' } });
      return;
    }
    if (!allowedHere) {
      setLoadingList(false);
      return;
    }
    loadList();
  }, [demoMode, authLoading, isAuthenticated, token, navigate, loadList, allowedHere]);

  const loadDetail = async (conversationId) => {
    setDetailArtifact('brief');
    setSelectedId(conversationId);
    setDetail(null);
    setDetailError('');
    setLoadingDetail(true);

    if (demoMode) {
      await new Promise((r) => setTimeout(r, 150));
      const d = getDemoSubmissionDetail(conversationId);
      if (d) {
        setDetail(d);
      } else {
        setDetailError('No demo detail for this id.');
      }
      setLoadingDetail(false);
      return;
    }

    if (!token) {
      setLoadingDetail(false);
      return;
    }
    try {
      const data = await adminAPI.getSubmission(token, conversationId);
      setDetail(data);
    } catch (e) {
      setDetailError(e.message || 'Could not load this submission.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const searchFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((s) => {
      const blob = [
        s.title,
        s.user?.email,
        s.user?.name,
        s.partner_name,
        s.organization,
        ...Object.values(s.form_fields || {}),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [submissions, query]);

  const filtered = useMemo(() => {
    if (filterTab === 'all') return searchFiltered;
    return searchFiltered.filter((s) => (s.submission_status || 'draft') === filterTab);
  }, [searchFiltered, filterTab]);

  const handleSubmissionStatusChange = async (nextStatus) => {
    if (!selectedId || !detail) return;
    const allowed = ['draft', 'pending', 'reviewed'];
    if (!allowed.includes(nextStatus)) return;

    if (demoMode) {
      const locked = nextStatus === 'reviewed';
      const lockDate = locked ? new Date().toISOString() : null;
      setSubmissions((prev) =>
        prev.map((s) =>
          s.conversation_id === selectedId
            ? { ...s, submission_status: nextStatus, brief_locked_at: lockDate }
            : s
        )
      );
      setDetail((d) =>
        d && d.conversation_id === selectedId
          ? { ...d, submission_status: nextStatus, brief_locked_at: lockDate }
          : d
      );
      return;
    }

    if (!token) return;
    setStatusSaving(true);
    setDetailError('');
    try {
      await adminAPI.updateSubmissionStatus(token, selectedId, nextStatus);
      const data = await adminAPI.getSubmission(token, selectedId);
      setDetail(data);
      await loadList();
    } catch (e) {
      setDetailError(e.message || 'Could not update status.');
    } finally {
      setStatusSaving(false);
    }
  };

  if (authLoading && !demoMode) {
    return (
      <div className="admin-page">
        <p className="admin-muted">Loading…</p>
      </div>
    );
  }

  if (!demoMode && !allowedHere) {
    return (
      <div className="admin-page admin-restricted">
        <Link to="/" className="admin-back">
          ← Back to intake
        </Link>
        <h1>Staff admin</h1>
        <p className="admin-muted">
          Your account does not have staff privileges. Add your email to the server{' '}
          <code>STAFF_EMAILS</code> environment variable (comma-separated), restart the API, then sign in again.
        </p>
        <p className="admin-muted" style={{ marginTop: 16 }}>
          <Link to="/admin?demo=1" className="admin-back">
            Open admin preview with mock data (no sign-in, no server)
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {demoMode && (
        <div className="admin-banner admin-banner-demo" role="status">
          <strong>Demo mode</strong> — mock submissions and a full template editor (saved in this browser only). No Airtable or
          other external intake API is called here. For live data, remove <code>?demo=1</code>, run the API, and sign in as
          staff.
        </div>
      )}

      <header className="admin-top">
        <div className="admin-top-left">
          <Link to="/">
            <img src={cfciLogo} alt={BRAND.LOGO_ALT} className="admin-logo" />
          </Link>
          <div className="admin-titles">
            <span className="admin-product">{BRAND.PRODUCT_NAME}</span>
            <span className="admin-role-pill" aria-label="Admin mode">
              Staff admin
            </span>
            <h1 className="admin-h1">Admin dashboard</h1>
            <p className="admin-sub">
              Review submitted product briefs (structured answers), optional chat transcript, and configure what the brief
              asks for.
            </p>
          </div>
        </div>
        <div className="admin-top-actions">
          <Link to="/" className="admin-btn admin-btn-secondary">
            Intake chat
          </Link>
        </div>
      </header>

      <div className="admin-main-tabs" role="tablist" aria-label="Admin sections">
        <button
          type="button"
          role="tab"
          aria-selected={dashboardSection === 'submissions'}
          className={`admin-main-tab ${dashboardSection === 'submissions' ? 'is-active' : ''}`}
          onClick={() => setDashboardSection('submissions')}
        >
          Submissions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={dashboardSection === 'template'}
          className={`admin-main-tab ${dashboardSection === 'template' ? 'is-active' : ''}`}
          onClick={() => setDashboardSection('template')}
        >
          Product brief template
        </button>
      </div>

      {dashboardSection === 'template' && (
        <section className="admin-template-section" aria-label="Intake template editor">
          <div className="admin-template-head">
            <h2 className="admin-template-title">What the product brief contains</h2>
            <p className="admin-template-lead">
              Edit the questions and section labels submitters answer. Their brief document is built from these fields — not
              from the chat transcript.
            </p>
            {!demoMode && isStaff && (
              <Link to="/admin/form-builder" className="admin-template-standalone">
                Open full-screen editor
              </Link>
            )}
          </div>
          {demoMode ? (
            <IntakeFormTemplateEditor demoMode demoSeed={DEMO_INTAKE_TEMPLATE} />
          ) : (
            <IntakeFormTemplateEditor token={token} />
          )}
        </section>
      )}

      {dashboardSection === 'submissions' && (
        <>
      <div className="admin-filter-row">
        {['all', 'draft', 'pending', 'reviewed'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`admin-filter-pill ${filterTab === tab ? 'is-active' : ''}`}
            onClick={() => setFilterTab(tab)}
          >
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="admin-toolbar">
        <label className="admin-search-label">
          <span className="sr-only">Search</span>
          <input
            type="search"
            className="admin-search"
            placeholder="Search by title, email, or field text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="admin-count">
          {filtered.length} of {total} conversation{total === 1 ? '' : 's'}
        </span>
        <button type="button" className="admin-btn admin-btn-ghost" onClick={loadList} disabled={loadingList}>
          Refresh
        </button>
      </div>

      {listError && <div className="admin-banner admin-banner-error">{listError}</div>}

      <div className="admin-layout">
        <section className="admin-list-panel" aria-label="Submission list">
          {loadingList ? (
            <p className="admin-muted admin-pad">Loading submissions…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-muted admin-pad">No submissions match your search.</p>
          ) : (
            <ul className="admin-card-list">
              {filtered.map((s) => (
                <li key={s.conversation_id}>
                  <button
                    type="button"
                    className={`admin-card ${selectedId === s.conversation_id ? 'is-active' : ''}`}
                    onClick={() => loadDetail(s.conversation_id)}
                  >
                    <span className="admin-card-title">{s.title || `Conversation #${s.conversation_id}`}</span>
                    <span className="admin-card-meta">
                      {s.partner_name || s.user?.name || s.user?.email}
                      {s.organization ? ` · ${s.organization}` : ''}
                    </span>
                    <span className="admin-card-progress">
                      <span className="admin-progress-bar">
                        <span
                          className="admin-progress-fill"
                          style={{ width: `${Math.min(100, s.completeness_percent ?? 0)}%` }}
                        />
                      </span>
                      {s.completeness_percent ?? 0}% ·{' '}
                      <span className={`admin-status-pill admin-status-${s.submission_status || 'draft'}`}>
                        {(s.submission_status || 'draft').toUpperCase()}
                      </span>
                      {s.brief_locked_at && <span className="admin-locked-tag">Locked</span>}
                    </span>
                    <span className="admin-card-date">{formatDate(s.updated_at)}</span>
                    <span className="admin-card-badge">{s.message_count ?? 0} messages</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-detail-panel" aria-label="Submission detail">
          {!selectedId && !loadingDetail && (
            <div className="admin-detail-empty">
              <p>Select a submission to open its product brief (default) or switch to the chat transcript.</p>
            </div>
          )}
          {loadingDetail && <p className="admin-muted admin-pad">Loading detail…</p>}
          {detailError && <div className="admin-banner admin-banner-error">{detailError}</div>}
          {detail && !loadingDetail && (
            <div className="admin-detail-inner">
              <header className="admin-detail-head">
                <h2 className="admin-detail-title">{detail.title || `Conversation #${detail.conversation_id}`}</h2>
                <p className="admin-detail-user">
                  {detail.user?.name} · {detail.user?.email}
                </p>
                <p className="admin-detail-dates">
                  Started {formatDate(detail.started_at)} · Updated {formatDate(detail.updated_at)}
                </p>

                <div className="admin-review-status-block">
                  <label htmlFor="admin-submission-status" className="admin-status-label">
                    Staff review status
                  </label>
                  <select
                    id="admin-submission-status"
                    className="admin-status-select"
                    value={detail.submission_status || 'draft'}
                    onChange={(e) => handleSubmissionStatusChange(e.target.value)}
                    disabled={statusSaving || (!demoMode && !token)}
                  >
                    <option value="draft">Draft — intake still in progress</option>
                    <option value="pending">Pending — under staff review</option>
                    <option value="reviewed">Reviewed — submitter brief locked</option>
                  </select>
                  <p className="admin-status-hint">
                    Use <strong>Draft</strong> while the submitter is still filling in the brief. Move to{' '}
                    <strong>Pending</strong> when you are actively reviewing. <strong>Reviewed</strong> locks the brief so
                    the submitter cannot change answers via chat (same as the previous lock action).
                  </p>
                  {detail.brief_locked_at && (
                    <p className="admin-locked-note">Submitter edits locked as of {formatDate(detail.brief_locked_at)}.</p>
                  )}
                </div>
              </header>

              <div className="admin-detail-subtabs" role="tablist" aria-label="Submission views">
                <button
                  type="button"
                  role="tab"
                  aria-selected={detailArtifact === 'brief'}
                  className={`admin-detail-subtab ${detailArtifact === 'brief' ? 'is-active' : ''}`}
                  onClick={() => setDetailArtifact('brief')}
                >
                  Product brief
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={detailArtifact === 'chat'}
                  className={`admin-detail-subtab ${detailArtifact === 'chat' ? 'is-active' : ''}`}
                  onClick={() => setDetailArtifact('chat')}
                >
                  Chat transcript
                </button>
              </div>

              {detailArtifact === 'brief' && (
                <section className="admin-brief-doc admin-brief-doc-primary" aria-label="Product brief document">
                  <h3 className="admin-block-title">Submission document</h3>
                  <p className="admin-brief-context">
                    Answers to your intake template — this is the structured product brief, not the conversation log.
                  </p>
                  {detail.form_fields && Object.keys(detail.form_fields).length > 0 ? (
                    <dl className="admin-brief-dl">
                      {Object.entries(detail.form_fields).map(([k, v]) => (
                        <div key={k} className="admin-brief-row">
                          <dt>{k}</dt>
                          <dd>{v ? String(v) : '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="admin-muted">No brief fields captured yet.</p>
                  )}
                </section>
              )}

              {detailArtifact === 'chat' && (
                <div className="admin-columns admin-columns-transcript-only">
                  <div className="admin-messages-block">
                    <h3 className="admin-block-title">Chat transcript</h3>
                    <p className="admin-brief-context">Reference only — the official brief is under Product brief.</p>
                    <div className="admin-messages">
                      {(detail.messages || []).map((m) => (
                        <div key={`${m.message_num}-${m.created_at}`} className={`admin-msg admin-msg-${m.sender}`}>
                          <span className="admin-msg-label">{m.sender}</span>
                          <pre className="admin-msg-body">{m.content}</pre>
                          <span className="admin-msg-time">{formatDate(m.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
