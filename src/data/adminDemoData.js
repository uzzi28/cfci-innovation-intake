/**
 * Mock admin API payloads for local UI testing without sign-in or a running API.
 * Intake questions match server seed (`server/app/seed.py` DEFAULT_TEMPLATE_KEY) — not Airtable.
 */

const now = new Date();
const iso = (d) => d.toISOString();

/** Same sections as the API seeds into SQLite — canonical product brief outline */
export const DEMO_INTAKE_TEMPLATE = {
  intake_title: 'Duke Engineering Project Intake Application',
  fields: [
    {
      id: 101,
      name: 'Company Name',
      field_type: 'string',
      description: 'Legal or working name of your organization',
      sort_order: 0,
      is_required: true,
    },
    {
      id: 102,
      name: 'Primary contact',
      field_type: 'string',
      description: 'Full name of the person we should reach',
      sort_order: 1,
      is_required: true,
    },
    {
      id: 103,
      name: 'Contact email',
      field_type: 'email',
      description: 'We will use this for follow-up',
      sort_order: 2,
      is_required: true,
    },
    {
      id: 104,
      name: 'Website or primary link',
      field_type: 'url',
      description: 'Company site, deck, or LinkedIn',
      sort_order: 3,
      is_required: false,
    },
    {
      id: 105,
      name: 'Problem statement',
      field_type: 'long_text',
      description: 'What pain are you solving, and for whom?',
      sort_order: 4,
      is_required: true,
    },
    {
      id: 106,
      name: 'Proposed solution',
      field_type: 'long_text',
      description: 'How will you address the problem?',
      sort_order: 5,
      is_required: false,
    },
    {
      id: 107,
      name: 'Target audience',
      field_type: 'long_text',
      description: 'Who will use this product or service?',
      sort_order: 6,
      is_required: true,
    },
    {
      id: 108,
      name: 'Timeline & resources',
      field_type: 'long_text',
      description: 'When do you need this, and what help do you need?',
      sort_order: 7,
      is_required: false,
    },
  ],
};

export const DEMO_SUBMISSIONS_LIST = [
  {
    conversation_id: 9001,
    title: 'CFCI x Alex Chen Chat',
    started_at: iso(new Date(now - 86400000 * 3)),
    updated_at: iso(new Date(now - 86400000)),
    brief_locked_at: null,
    completeness_percent: 82,
    submission_status: 'pending',
    partner_name: 'Alex Chen',
    organization: 'GreenLoop Labs',
    user: { id: 1, email: 'alex.chen@duke.edu', name: 'Alex Chen' },
    form_fields: {
      'Company Name': 'GreenLoop Labs',
      'Primary contact': 'Alex Chen',
      'Contact email': 'alex.chen@duke.edu',
      'Website or primary link': 'https://greenloop.example',
      'Problem statement':
        'Students do not know if dorm waste is actually composted; we need visibility and engagement.',
      'Proposed solution': 'Campus compost tracking app with QR drop-off logs.',
      'Target audience': 'Duke students and dining halls',
      'Timeline & resources': 'Pilot by fall term; seeking design partner.',
    },
    message_count: 8,
  },
  {
    conversation_id: 9002,
    title: 'CFCI x Jordan Smith Chat',
    started_at: iso(new Date(now - 86400000 * 5)),
    updated_at: iso(new Date(now - 3600000 * 2)),
    brief_locked_at: iso(new Date(now - 7200000)),
    completeness_percent: 95,
    submission_status: 'reviewed',
    partner_name: 'Jordan Smith',
    organization: 'CareSim',
    user: { id: 2, email: 'jordan.smith@duke.edu', name: 'Jordan Smith' },
    form_fields: {
      'Company Name': 'CareSim',
      'Primary contact': 'Jordan Smith',
      'Contact email': 'jordan.smith@duke.edu',
      'Problem statement': 'Nursing students need more reps on ventilator alarms before clinicals.',
      'Proposed solution': 'Low-cost tabletop simulator + software for nursing labs.',
      'Target audience': 'Nursing programs and simulation labs',
    },
    message_count: 12,
  },
  {
    conversation_id: 9003,
    title: 'Guest intake — wearable hydration',
    started_at: iso(new Date(now - 86400000)),
    updated_at: iso(new Date(now - 600000)),
    brief_locked_at: null,
    completeness_percent: 41,
    submission_status: 'draft',
    partner_name: 'Sam Guest',
    organization: null,
    user: { id: 3, email: 'guest@example.com', name: 'Sam Guest' },
    form_fields: {
      'Primary contact': 'Sam Guest',
      'Contact email': 'guest@example.com',
      'Problem statement': 'Club athletes need better hydration feedback during summer training.',
    },
    message_count: 3,
  },
];

const DEMO_DETAILS = {
  9001: {
    conversation_id: 9001,
    title: 'CFCI x Alex Chen Chat',
    started_at: DEMO_SUBMISSIONS_LIST[0].started_at,
    updated_at: DEMO_SUBMISSIONS_LIST[0].updated_at,
    brief_locked_at: DEMO_SUBMISSIONS_LIST[0].brief_locked_at,
    completeness_percent: 82,
    submission_status: DEMO_SUBMISSIONS_LIST[0].submission_status,
    user: DEMO_SUBMISSIONS_LIST[0].user,
    form_fields: DEMO_SUBMISSIONS_LIST[0].form_fields,
    messages: [
      {
        message_num: 1,
        sender: 'agent',
        content:
          "Hi! I'm here to help you build a product brief. What problem are you trying to solve on campus?",
        created_at: iso(new Date(now - 86400000 * 3)),
      },
      {
        message_num: 2,
        sender: 'user',
        content:
          'We want to make composting visible — students don’t know if their dorm’s waste actually gets composted.',
        created_at: iso(new Date(now - 86400000 * 3 + 120000)),
      },
      {
        message_num: 3,
        sender: 'agent',
        content:
          'Great angle. Who would use the product day-to-day — residents, RAs, facilities, or all of the above?',
        created_at: iso(new Date(now - 86400000 * 3 + 180000)),
      },
    ],
  },
  9002: {
    conversation_id: 9002,
    title: 'CFCI x Jordan Smith Chat',
    started_at: DEMO_SUBMISSIONS_LIST[1].started_at,
    updated_at: DEMO_SUBMISSIONS_LIST[1].updated_at,
    brief_locked_at: DEMO_SUBMISSIONS_LIST[1].brief_locked_at,
    completeness_percent: DEMO_SUBMISSIONS_LIST[1].completeness_percent,
    submission_status: DEMO_SUBMISSIONS_LIST[1].submission_status,
    user: DEMO_SUBMISSIONS_LIST[1].user,
    form_fields: DEMO_SUBMISSIONS_LIST[1].form_fields,
    messages: [
      {
        message_num: 1,
        sender: 'agent',
        content: 'Tell me about the training gap you want the simulator to address.',
        created_at: iso(new Date(now - 86400000 * 5)),
      },
      {
        message_num: 2,
        sender: 'user',
        content:
          'Nursing students need reps on alarm thresholds before clinicals; we want a tabletop device + software.',
        created_at: iso(new Date(now - 86400000 * 5 + 90000)),
      },
    ],
  },
  9003: {
    conversation_id: 9003,
    title: 'Guest intake — wearable hydration',
    started_at: DEMO_SUBMISSIONS_LIST[2].started_at,
    updated_at: DEMO_SUBMISSIONS_LIST[2].updated_at,
    brief_locked_at: DEMO_SUBMISSIONS_LIST[2].brief_locked_at,
    completeness_percent: DEMO_SUBMISSIONS_LIST[2].completeness_percent,
    submission_status: DEMO_SUBMISSIONS_LIST[2].submission_status,
    user: DEMO_SUBMISSIONS_LIST[2].user,
    form_fields: DEMO_SUBMISSIONS_LIST[2].form_fields,
    messages: [
      {
        message_num: 1,
        sender: 'agent',
        content: 'What does your wearable measure, and who is it for?',
        created_at: iso(new Date(now - 86400000)),
      },
      {
        message_num: 2,
        sender: 'user',
        content: 'Sweat + temp for club athletes during summer training.',
        created_at: iso(new Date(now - 86400000 + 60000)),
      },
    ],
  },
};

export function getDemoSubmissionDetail(conversationId) {
  return DEMO_DETAILS[conversationId] || null;
}
