/**
 * API service for Duke Engineering Project Intake (FastAPI backend).
 */

// Use empty string to leverage Vite's proxy, or fallback to localhost for direct API calls
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function formatErrorDetail(response, errorData) {
  const detail = errorData?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item?.msg === 'string' ? item.msg : JSON.stringify(item)))
      .join(' ');
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return `Request failed (${response.status})`;
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, mergedOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(formatErrorDetail(response, errorData));
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

/**
 * Chat API
 */
export const chatAPI = {
  /**
   * Get initial greeting message
   */
  getGreeting: async () => {
    return fetchAPI('/api/chat/greeting');
  },

  /**
   * Send a message in simple/guest mode (no auth required)
   */
  sendMessage: async (message, conversationId = null) => {
    return fetchAPI('/api/chat/simple', {
      method: 'POST',
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
      }),
    });
  },

  /**
   * Initiate a new conversation for authenticated users
   * Returns conversation_id and initial message
   */
  initiate: async (token) => {
    return fetchAPI('/api/chat/initiate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Advance an existing conversation for authenticated users
   * Sends message and gets AI response
   */
  advance: async (token, conversationId, message, messageStepNum) => {
    return fetchAPI('/api/chat/advance', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        user_message: message,
        message_step_num: messageStepNum,
      }),
    });
  },
};

/**
 * Auth API
 */
export const authAPI = {
  /**
   * Register a new user
   */
  register: async (email, password, firstname, lastname) => {
    return fetchAPI('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        firstname,
        lastname,
      }),
    });
  },

  /**
   * Login user
   */
  login: async (email, password) => {
    return fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
    });
  },
};

/**
 * Health check
 */
export const healthAPI = {
  check: async () => {
    return fetchAPI('/api/health');
  },
};

/**
 * Staff admin API (requires Bearer token; backend may evolve role checks)
 */
export const adminAPI = {
  listSubmissions: async (token) => {
    return fetchAPI('/api/admin/submissions', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  getSubmission: async (token, conversationId) => {
    return fetchAPI(`/api/admin/submissions/${conversationId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  lockBrief: async (token, conversationId, lock = true) => {
    return fetchAPI(`/api/admin/submissions/${conversationId}/lock-brief`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lock }),
    });
  },

  /** draft | pending | reviewed (reviewed locks submitter brief) */
  updateSubmissionStatus: async (token, conversationId, submissionStatus) => {
    return fetchAPI(`/api/admin/submissions/${conversationId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ submission_status: submissionStatus }),
    });
  },
};

export const intakeFormAPI = {
  getTemplate: async (token) => {
    return fetchAPI('/api/admin/intake-form', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  updateTitle: async (token, intakeTitle) => {
    return fetchAPI('/api/admin/intake-form/settings/title', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ intake_title: intakeTitle }),
    });
  },
  createField: async (token, body) => {
    return fetchAPI('/api/admin/intake-form/fields', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  },
  patchField: async (token, fieldId, body) => {
    return fetchAPI(`/api/admin/intake-form/fields/${fieldId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  },
  deleteField: async (token, fieldId) => {
    return fetchAPI(`/api/admin/intake-form/fields/${fieldId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  reorderFields: async (token, orderedIds) => {
    return fetchAPI('/api/admin/intake-form/fields/reorder', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ordered_ids: orderedIds }),
    });
  },
};

export const conversationAPI = {
  saveDraft: async (token, conversationId) => {
    return fetchAPI(`/api/conversations/${conversationId}/save-draft`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  emailBriefStub: async (token, conversationId, note = '') => {
    return fetchAPI(`/api/conversations/${conversationId}/email-brief`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note }),
    });
  },
  getStatus: async (token, conversationId) => {
    return fetchAPI(`/api/conversations/${conversationId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

export async function downloadBriefPdf(token, conversationId) {
  const url = `${API_BASE_URL}/api/pdf/submissions/${conversationId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `PDF failed (${response.status})`);
  }
  return response.blob();
}

export default {
  chat: chatAPI,
  auth: authAPI,
  health: healthAPI,
  admin: adminAPI,
  intakeForm: intakeFormAPI,
  conversation: conversationAPI,
};

