import React, { useCallback, useEffect, useState } from 'react';
import { intakeFormAPI } from '../services/api';
import './FormBuilder.css';

export const INTAKE_FIELD_TYPES = [
  { value: 'string', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL / link' },
  { value: 'integer', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Checkbox' },
];

const DEMO_TEMPLATE_STORAGE_KEY = 'cfci-demo-intake-template-v2';

function cloneTemplate(seed) {
  return {
    intake_title: seed.intake_title || '',
    fields: (seed.fields || []).map((f) => ({ ...f })),
  };
}

function readStoredDemoTemplate() {
  try {
    const raw = localStorage.getItem(DEMO_TEMPLATE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.fields)) return null;
    return data;
  } catch {
    return null;
  }
}

function nextDemoFieldId(fields) {
  const nums = fields.map((f) => (typeof f.id === 'number' ? f.id : 0));
  const max = nums.length ? Math.max(...nums) : 100;
  return max + 1;
}

function BriefFieldCard({ field, index, totalCount, onMoveUp, onMoveDown, onRemove, applyPatch, busy }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    field_type: 'string',
    is_required: true,
  });

  const openEdit = () => {
    setDraft({
      name: field.name,
      description: field.description ?? '',
      field_type: field.field_type,
      is_required: Boolean(field.is_required),
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    const name = draft.name.trim();
    if (!name) return;
    try {
      await applyPatch({
        name,
        description: draft.description.trim() ? draft.description.trim() : null,
        field_type: draft.field_type,
        is_required: draft.is_required,
      });
      setEditing(false);
    } catch {
      /* parent surfaces error */
    }
  };

  const toggleRequired = async () => {
    try {
      await applyPatch({ is_required: !field.is_required });
    } catch {
      /* noop */
    }
  };

  if (editing) {
    return (
      <li className="fb-field-card fb-field-card-editing">
        <div className="fb-field-edit-grid">
          <label className="fb-label">
            Question label
            <input
              className="fb-input"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </label>
          <label className="fb-label">
            Type
            <select
              className="fb-input"
              value={draft.field_type}
              onChange={(e) => setDraft((d) => ({ ...d, field_type: e.target.value }))}
            >
              {INTAKE_FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="fb-label">
            Hint / description (optional)
            <textarea
              className="fb-input fb-textarea"
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </label>
          <label className="fb-checkbox-row">
            <input
              type="checkbox"
              checked={draft.is_required}
              onChange={(e) => setDraft((d) => ({ ...d, is_required: e.target.checked }))}
            />
            Required for submitters
          </label>
        </div>
        <div className="fb-field-actions">
          <button type="button" className="fb-icon-btn fb-primary-lite" onClick={saveEdit} disabled={busy}>
            Save section
          </button>
          <button type="button" className="fb-icon-btn" onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="fb-field-card">
      <div className="fb-field-meta">
        <span className="fb-pill">{field.field_type}</span>
        <label className="fb-req-toggle">
          <input type="checkbox" checked={Boolean(field.is_required)} disabled={busy} onChange={toggleRequired} />
          <span>Required</span>
        </label>
        <button type="button" className="fb-text-btn fb-edit-link" onClick={openEdit} disabled={busy}>
          Edit section
        </button>
      </div>
      <h3 className="fb-field-name">{field.name}</h3>
      {field.description ? <p className="fb-field-desc">{field.description}</p> : null}
      <div className="fb-field-actions">
        <button type="button" className="fb-icon-btn" onClick={onMoveUp} disabled={index === 0 || busy}>
          ↑
        </button>
        <button type="button" className="fb-icon-btn" onClick={onMoveDown} disabled={index >= totalCount - 1 || busy}>
          ↓
        </button>
        <button type="button" className="fb-icon-btn fb-danger" onClick={onRemove} disabled={busy}>
          Remove
        </button>
      </div>
    </li>
  );
}

/**
 * Full UI without API: matches production template seed; persists in localStorage only.
 */
function DemoIntakeTemplateEditor({ demoSeed }) {
  const [intakeTitle, setIntakeTitle] = useState('');
  const [fields, setFields] = useState([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('string');
  const [ready, setReady] = useState(false);

  const persist = useCallback((title, flds) => {
    try {
      localStorage.setItem(DEMO_TEMPLATE_STORAGE_KEY, JSON.stringify({ intake_title: title, fields: flds }));
    } catch (e) {
      console.warn('Could not persist demo template', e);
    }
  }, []);

  const applyTemplate = useCallback(
    (data) => {
      setIntakeTitle(data.intake_title || '');
      setFields((data.fields || []).map((f) => ({ ...f })));
    },
    []
  );

  useEffect(() => {
    const stored = readStoredDemoTemplate();
    applyTemplate(stored || cloneTemplate(demoSeed));
    setReady(true);
  }, [demoSeed, applyTemplate]);

  const saveTitle = () => {
    persist(intakeTitle, fields);
  };

  const addField = () => {
    if (!newName.trim()) return;
    const next = [
      ...fields,
      {
        id: nextDemoFieldId(fields),
        name: newName.trim(),
        field_type: newType,
        description: '',
        sort_order: fields.length,
        is_required: true,
      },
    ];
    setFields(next);
    setNewName('');
    persist(intakeTitle, next);
  };

  const removeField = (id) => {
    if (!window.confirm('Remove this question from the preview template?')) return;
    const next = fields.filter((f) => f.id !== id).map((f, i) => ({ ...f, sort_order: i }));
    setFields(next);
    persist(intakeTitle, next);
  };

  const moveField = (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    const [row] = next.splice(index, 1);
    next.splice(j, 0, row);
    const reordered = next.map((f, i) => ({ ...f, sort_order: i }));
    setFields(reordered);
    persist(intakeTitle, reordered);
  };

  const applyFieldPatch = async (fieldId, patch) => {
    setFields((prev) => {
      const next = prev.map((x) => (x.id === fieldId ? { ...x, ...patch } : x));
      persist(intakeTitle, next);
      return next;
    });
  };

  const refresh = () => {
    const stored = readStoredDemoTemplate();
    applyTemplate(stored || cloneTemplate(demoSeed));
  };

  const resetDefaults = () => {
    if (!window.confirm('Reset to the default Duke Engineering brief sections? Your local preview edits will be cleared.')) {
      return;
    }
    try {
      localStorage.removeItem(DEMO_TEMPLATE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const fresh = cloneTemplate(demoSeed);
    applyTemplate(fresh);
    persist(fresh.intake_title, fresh.fields);
  };

  if (!ready) {
    return (
      <div className="intake-template-loading">
        <p className="fb-muted">Loading preview template…</p>
      </div>
    );
  }

  return (
    <div className="intake-template-editor-root">
      <div className="fb-demo-banner" role="status">
        <strong>Preview mode</strong> — no server required. The app does not call Airtable; the live API stores this template
        in its own database (SQLite by default). Edits here are saved in <em>this browser only</em> until you run the API and
        use the staff form builder.
      </div>

      <div className="fb-layout fb-layout-embedded">
        <aside className="fb-sidebar">
          <h2 className="fb-sidebar-title">Add question</h2>
          <p className="fb-sidebar-hint">These labels become sections in each submitter&apos;s product brief.</p>
          <label className="fb-label">
            Type
            <select className="fb-input" value={newType} onChange={(e) => setNewType(e.target.value)}>
              {INTAKE_FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="fb-label">
            Question label
            <input
              className="fb-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Company name"
            />
          </label>
          <button type="button" className="fb-btn fb-btn-primary" onClick={addField}>
            Add to form
          </button>

          <h2 className="fb-sidebar-title fb-mt">Form settings</h2>
          <label className="fb-label">
            Intake title
            <input
              className="fb-input"
              value={intakeTitle}
              onChange={(e) => setIntakeTitle(e.target.value)}
              placeholder="Application title"
            />
          </label>
          <button type="button" className="fb-btn fb-btn-secondary" onClick={saveTitle}>
            Save title (browser)
          </button>
          <button type="button" className="fb-btn fb-btn-secondary fb-mt-sm" onClick={resetDefaults}>
            Reset to defaults
          </button>
        </aside>

        <main className="fb-main">
          <div className="fb-main-head">
            <h2 className="fb-main-title">
              Brief sections <span className="fb-count">{fields.length} questions · use arrows to reorder</span>
            </h2>
            <button type="button" className="fb-text-btn" onClick={refresh}>
              Reload saved preview
            </button>
          </div>

          <ul className="fb-field-list">
            {fields.map((f, i) => (
              <BriefFieldCard
                key={f.id}
                field={f}
                index={i}
                totalCount={fields.length}
                busy={false}
                onMoveUp={() => moveField(i, -1)}
                onMoveDown={() => moveField(i, 1)}
                onRemove={() => removeField(f.id)}
                applyPatch={(patch) => applyFieldPatch(f.id, patch)}
              />
            ))}
          </ul>
          {fields.length === 0 && <p className="fb-muted">No fields yet — add questions from the left.</p>}
        </main>
      </div>
    </div>
  );
}

/**
 * Staff: edit global intake questions (API). Demo: local preview matching server seed.
 */
const IntakeFormTemplateEditor = ({ token, disabled, disabledMessage, demoMode, demoSeed }) => {
  if (demoMode && demoSeed) {
    return <DemoIntakeTemplateEditor demoSeed={demoSeed} />;
  }

  const [loading, setLoading] = useState(() => Boolean(token && !disabled));
  const [error, setError] = useState('');
  const [intakeTitle, setIntakeTitle] = useState('');
  const [fields, setFields] = useState([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('string');
  const [busyField, setBusyField] = useState(null);

  const load = useCallback(async () => {
    if (!token || disabled) return;
    setError('');
    setLoading(true);
    try {
      const data = await intakeFormAPI.getTemplate(token);
      setIntakeTitle(data.intake_title || '');
      setFields(data.fields || []);
    } catch (e) {
      setError(e.message || 'Could not load form template.');
    } finally {
      setLoading(false);
    }
  }, [token, disabled]);

  useEffect(() => {
    if (disabled || !token) {
      setLoading(false);
      return;
    }
    load();
  }, [token, disabled, load]);

  const saveTitle = async () => {
    if (!token || disabled) return;
    try {
      await intakeFormAPI.updateTitle(token, intakeTitle);
      setError('');
    } catch (e) {
      setError(e.message || 'Could not save title');
    }
  };

  const addField = async () => {
    if (!token || disabled || !newName.trim()) return;
    try {
      await intakeFormAPI.createField(token, {
        name: newName.trim(),
        field_type: newType,
        is_required: true,
      });
      setNewName('');
      await load();
    } catch (e) {
      setError(e.message || 'Could not add field');
    }
  };

  const removeField = async (id) => {
    if (!token || disabled || !window.confirm('Delete this question? Only allowed if no submissions use it yet.')) return;
    try {
      await intakeFormAPI.deleteField(token, id);
      await load();
    } catch (e) {
      setError(e.message || 'Could not delete');
    }
  };

  const moveField = async (index, dir) => {
    const next = index + dir;
    if (next < 0 || next >= fields.length || !token || disabled) return;
    const reordered = [...fields];
    const [removed] = reordered.splice(index, 1);
    reordered.splice(next, 0, removed);
    const orderedIds = reordered.map((f) => f.id);
    try {
      await intakeFormAPI.reorderFields(token, orderedIds);
      setFields(reordered);
    } catch (e) {
      setError(e.message || 'Could not reorder');
    }
  };

  const patchFieldRow = async (fieldId, patch) => {
    setBusyField(fieldId);
    setError('');
    try {
      await intakeFormAPI.patchField(token, fieldId, patch);
      await load();
    } catch (e) {
      setError(e.message || 'Could not update field');
      throw e;
    } finally {
      setBusyField(null);
    }
  };

  if (disabled) {
    return (
      <div className="intake-template-disabled">
        <p className="fb-muted">{disabledMessage || 'Template editing is not available in this mode.'}</p>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  if (loading) {
    return (
      <div className="intake-template-loading">
        <p className="fb-muted">Loading intake template…</p>
      </div>
    );
  }

  return (
    <div className="intake-template-editor-root">
      {error && <div className="fb-error">{error}</div>}

      <div className="fb-layout fb-layout-embedded">
        <aside className="fb-sidebar">
          <h2 className="fb-sidebar-title">Add question</h2>
          <p className="fb-sidebar-hint">These labels become sections in each submitter&apos;s product brief.</p>
          <label className="fb-label">
            Type
            <select className="fb-input" value={newType} onChange={(e) => setNewType(e.target.value)}>
              {INTAKE_FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="fb-label">
            Question label
            <input
              className="fb-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Company name"
            />
          </label>
          <button type="button" className="fb-btn fb-btn-primary" onClick={addField}>
            Add to form
          </button>

          <h2 className="fb-sidebar-title fb-mt">Form settings</h2>
          <label className="fb-label">
            Intake title
            <input
              className="fb-input"
              value={intakeTitle}
              onChange={(e) => setIntakeTitle(e.target.value)}
              placeholder="Application title"
            />
          </label>
          <button type="button" className="fb-btn fb-btn-secondary" onClick={saveTitle}>
            Save title
          </button>
        </aside>

        <main className="fb-main">
          <div className="fb-main-head">
            <h2 className="fb-main-title">
              Brief sections <span className="fb-count">{fields.length} questions · use arrows to reorder</span>
            </h2>
            <button type="button" className="fb-text-btn" onClick={load}>
              Refresh
            </button>
          </div>

          <ul className="fb-field-list">
            {fields.map((f, i) => (
              <BriefFieldCard
                key={f.id}
                field={f}
                index={i}
                totalCount={fields.length}
                busy={busyField !== null}
                onMoveUp={() => moveField(i, -1)}
                onMoveDown={() => moveField(i, 1)}
                onRemove={() => removeField(f.id)}
                applyPatch={(patch) => patchFieldRow(f.id, patch)}
              />
            ))}
          </ul>
          {fields.length === 0 && <p className="fb-muted">No fields yet — add questions from the left.</p>}
        </main>
      </div>
    </div>
  );
};

export default IntakeFormTemplateEditor;
