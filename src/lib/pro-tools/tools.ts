// Pro tool suite — tool definitions.
//
// Each entry drives a full page at /projects/[id]/pro/<slug>. Slugs must
// match the hrefs in `getNavCategories` (lib/navCategories.ts) and the icons
// must exist in `sidebarIcons` (components/sidebar/SidebarIcons.tsx).
// `tests/pro-tools-registry.test.ts` enforces both.

import type { ProToolGroup, ProToolStatus, ProTool } from './types';

// Reusable status sets -------------------------------------------------------

const PIPELINE: ProToolStatus[] = [
  { value: 'not_started', label: 'Not started', tone: 'neutral' },
  { value: 'in_progress', label: 'In progress', tone: 'info' },
  { value: 'blocked', label: 'Blocked', tone: 'bad' },
  { value: 'done', label: 'Done', tone: 'good' },
];

const APPROVAL: ProToolStatus[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'submitted', label: 'Submitted', tone: 'info' },
  { value: 'approved', label: 'Approved', tone: 'good' },
  { value: 'rejected', label: 'Rejected', tone: 'bad' },
];

const BOOKING: ProToolStatus[] = [
  { value: 'enquiry', label: 'Enquiry', tone: 'neutral' },
  { value: 'held', label: 'Held', tone: 'warn' },
  { value: 'confirmed', label: 'Confirmed', tone: 'good' },
  { value: 'cancelled', label: 'Cancelled', tone: 'bad' },
];

const NOTES = {
  key: 'notes', label: 'Notes', type: 'textarea' as const,
  placeholder: 'Anything the department needs to know…',
};

const OWNER = {
  key: 'owner', label: 'Owner', type: 'text' as const,
  placeholder: 'Who is responsible', column: true, hideBelow: 'lg' as const,
};

const DUE = {
  key: 'due_date', label: 'Due', type: 'date' as const,
  column: true, align: 'right' as const, hideBelow: 'md' as const,
};

export const PRO_TOOLS: ProTool[] = [
  // ── Money ────────────────────────────────────────────────────────────────
  {
    slug: 'portfolio', icon: 'portfolio', flag: 'pro_portfolio',
    label: 'Portfolio', tagline: 'Every title on the slate, in one view.',
    group: 'Money', noun: 'title', titleLabel: 'Title', titlePlaceholder: 'Project or title name',
    statuses: [
      { value: 'development', label: 'Development', tone: 'neutral' },
      { value: 'financing', label: 'Financing', tone: 'warn' },
      { value: 'production', label: 'Production', tone: 'info' },
      { value: 'post', label: 'Post', tone: 'accent' },
      { value: 'delivered', label: 'Delivered', tone: 'good' },
    ],
    groupBy: 'format',
    fields: [
      { key: 'format', label: 'Format', type: 'select', column: true,
        options: ['Feature', 'Short', 'Series', 'Documentary', 'Commercial', 'Music Video', 'Other'] },
      { key: 'logline', label: 'Logline', type: 'textarea', placeholder: 'One sentence.' },
      { key: 'budget', label: 'Budget', type: 'currency', column: true, align: 'right' },
      { key: 'committed', label: 'Committed', type: 'currency', column: true, align: 'right', hideBelow: 'lg' },
      OWNER,
      { key: 'target_delivery', label: 'Target delivery', type: 'date', column: true, align: 'right', hideBelow: 'md' },
      NOTES,
    ],
    stats: [
      { label: 'Titles', kind: 'count' },
      { label: 'Slate budget', kind: 'sum', field: 'budget', format: 'currency' },
      { label: 'Committed', kind: 'sum', field: 'committed', format: 'currency' },
      { label: 'In production', kind: 'status', status: 'production' },
    ],
    starters: ['Untitled Feature', 'Series — Season 1'],
  },
  {
    slug: 'accounting', icon: 'accounting', flag: 'pro_accounting',
    label: 'Production Accounting', tagline: 'Purchase orders, invoices and cost report lines.',
    group: 'Money', layout: 'ledger', noun: 'cost line', titleLabel: 'Description', titlePlaceholder: 'What was purchased',
    statuses: [
      { value: 'committed', label: 'Committed', tone: 'neutral' },
      { value: 'invoiced', label: 'Invoiced', tone: 'warn' },
      { value: 'paid', label: 'Paid', tone: 'good' },
      { value: 'disputed', label: 'Disputed', tone: 'bad' },
    ],
    groupBy: 'account',
    related: ['vendors', 'departments', 'equipment'],
    fields: [
      { key: 'account', label: 'Account', type: 'select', column: true,
        options: ['Above the Line', 'Production', 'Post-Production', 'Other', 'Contingency'] },
      { key: 'po_number', label: 'PO number', type: 'text', column: true, hideBelow: 'lg', placeholder: 'PO-0001' },
      { key: 'vendor', label: 'Vendor', type: 'text', column: true, hideBelow: 'md' },
      { key: 'estimated', label: 'Estimated', type: 'currency', column: true, align: 'right' },
      { key: 'actual', label: 'Actual', type: 'currency', column: true, align: 'right' },
      { key: 'invoice_date', label: 'Invoice date', type: 'date' },
      NOTES,
    ],
    stats: [
      { label: 'Lines', kind: 'count' },
      { label: 'Estimated', kind: 'sum', field: 'estimated', format: 'currency' },
      { label: 'Actual', kind: 'sum', field: 'actual', format: 'currency' },
      { label: 'Unpaid', kind: 'status', status: 'invoiced' },
    ],
  },
  {
    slug: 'greenlight', icon: 'greenlight', flag: 'pro_greenlight',
    label: 'Greenlight & Financing', tagline: 'Track the money from first conversation to signed.',
    group: 'Money', layout: 'ledger', noun: 'source', titleLabel: 'Source', titlePlaceholder: 'Financier, fund or broadcaster',
    statuses: [
      { value: 'target', label: 'Target', tone: 'neutral' },
      { value: 'pitched', label: 'Pitched', tone: 'info' },
      { value: 'soft_yes', label: 'Soft yes', tone: 'warn' },
      { value: 'committed', label: 'Committed', tone: 'good' },
      { value: 'passed', label: 'Passed', tone: 'bad' },
    ],
    groupBy: 'source_type',
    related: ['accounting', 'tax-incentives', 'distribution'],
    fields: [
      { key: 'source_type', label: 'Type', type: 'select', column: true,
        options: ['Equity', 'Soft money', 'Pre-sale', 'Gap', 'Grant', 'Broadcaster', 'Deferral'] },
      { key: 'amount', label: 'Amount', type: 'currency', column: true, align: 'right' },
      { key: 'contact', label: 'Contact', type: 'text', column: true, hideBelow: 'md' },
      { key: 'recoupment', label: 'Recoupment position', type: 'text', hint: 'Where they sit in the waterfall' },
      DUE, NOTES,
    ],
    stats: [
      { label: 'Sources', kind: 'count' },
      { label: 'Raised', kind: 'sum', field: 'amount', format: 'currency' },
      { label: 'Committed', kind: 'status', status: 'committed' },
      { label: 'Passed', kind: 'status', status: 'passed' },
    ],
  },
  {
    slug: 'tax-incentives', icon: 'tax-incentives', flag: 'pro_tax_incentives',
    label: 'Tax Incentives', tagline: 'Rebates, credits and the paperwork each one needs.',
    group: 'Money', layout: 'ledger', noun: 'incentive', titleLabel: 'Incentive', titlePlaceholder: 'e.g. Norwegian incentive scheme',
    statuses: APPROVAL,
    fields: [
      { key: 'jurisdiction', label: 'Jurisdiction', type: 'text', column: true },
      { key: 'rate', label: 'Rate', type: 'percent', column: true, align: 'right' },
      { key: 'qualifying_spend', label: 'Qualifying spend', type: 'currency', column: true, align: 'right' },
      { key: 'estimated_return', label: 'Estimated return', type: 'currency', column: true, align: 'right', hideBelow: 'lg' },
      { key: 'application_url', label: 'Application link', type: 'url' },
      DUE, NOTES,
    ],
    stats: [
      { label: 'Schemes', kind: 'count' },
      { label: 'Qualifying spend', kind: 'sum', field: 'qualifying_spend', format: 'currency' },
      { label: 'Estimated return', kind: 'sum', field: 'estimated_return', format: 'currency' },
      { label: 'Approved', kind: 'status', status: 'approved' },
    ],
  },
  {
    slug: 'crowdfunding', icon: 'crowdfunding', flag: 'pro_crowdfunding',
    label: 'Crowdfunding', tagline: 'Tiers, backers and the rewards you owe them.',
    group: 'Money', layout: 'ledger', noun: 'tier', titleLabel: 'Reward tier', titlePlaceholder: 'e.g. Executive Producer credit',
    statuses: [
      { value: 'planned', label: 'Planned', tone: 'neutral' },
      { value: 'live', label: 'Live', tone: 'info' },
      { value: 'fulfilling', label: 'Fulfilling', tone: 'warn' },
      { value: 'fulfilled', label: 'Fulfilled', tone: 'good' },
    ],
    fields: [
      { key: 'pledge', label: 'Pledge amount', type: 'currency', column: true, align: 'right' },
      { key: 'backers', label: 'Backers', type: 'number', column: true, align: 'right' },
      { key: 'raised', label: 'Raised', type: 'currency', column: true, align: 'right' },
      { key: 'reward', label: 'Reward', type: 'textarea', placeholder: 'What the backer receives' },
      { key: 'ship_by', label: 'Ship by', type: 'date', column: true, align: 'right', hideBelow: 'md' },
      NOTES,
    ],
    stats: [
      { label: 'Tiers', kind: 'count' },
      { label: 'Backers', kind: 'sum', field: 'backers' },
      { label: 'Raised', kind: 'sum', field: 'raised', format: 'currency' },
      { label: 'Fulfilled', kind: 'status', status: 'fulfilled' },
    ],
  },
  {
    slug: 'box-office', icon: 'box-office', flag: 'pro_box_office',
    label: 'Box Office & Revenue', tagline: 'Revenue by window, territory and platform.',
    group: 'Money', layout: 'ledger', noun: 'revenue line', titleLabel: 'Line', titlePlaceholder: 'e.g. UK theatrical — week 1',
    statuses: [
      { value: 'projected', label: 'Projected', tone: 'neutral' },
      { value: 'reported', label: 'Reported', tone: 'info' },
      { value: 'reconciled', label: 'Reconciled', tone: 'good' },
    ],
    groupBy: 'window',
    fields: [
      { key: 'window', label: 'Window', type: 'select', column: true,
        options: ['Theatrical', 'TVOD', 'SVOD', 'AVOD', 'Broadcast', 'Physical', 'Ancillary'] },
      { key: 'territory', label: 'Territory', type: 'text', column: true, hideBelow: 'md' },
      { key: 'gross', label: 'Gross', type: 'currency', column: true, align: 'right' },
      { key: 'net', label: 'Net to producer', type: 'currency', column: true, align: 'right' },
      { key: 'period', label: 'Reporting period', type: 'text', placeholder: 'Q1 2026' },
      NOTES,
    ],
    stats: [
      { label: 'Lines', kind: 'count' },
      { label: 'Gross', kind: 'sum', field: 'gross', format: 'currency' },
      { label: 'Net', kind: 'sum', field: 'net', format: 'currency' },
      { label: 'Territories', kind: 'distinct', field: 'territory' },
    ],
  },

  // ── Legal & Rights ───────────────────────────────────────────────────────
  {
    slug: 'rights', icon: 'rights', flag: 'pro_rights',
    label: 'Rights & Clearances', tagline: 'Nothing reaches picture lock uncleared.',
    group: 'Legal & Rights', layout: 'board', noun: 'clearance', titleLabel: 'Item', titlePlaceholder: 'What needs clearing',
    statuses: [
      { value: 'identified', label: 'Identified', tone: 'neutral' },
      { value: 'requested', label: 'Requested', tone: 'info' },
      { value: 'negotiating', label: 'Negotiating', tone: 'warn' },
      { value: 'cleared', label: 'Cleared', tone: 'good' },
      { value: 'denied', label: 'Denied', tone: 'bad' },
    ],
    groupBy: 'rights_type',
    related: ['music-sound', 'legal', 'post-production'],
    fields: [
      { key: 'rights_type', label: 'Type', type: 'select', column: true,
        options: ['Music', 'Footage', 'Artwork', 'Trademark', 'Location', 'Likeness', 'Underlying work', 'Other'] },
      { key: 'rights_holder', label: 'Rights holder', type: 'text', column: true, hideBelow: 'md' },
      { key: 'scene', label: 'Scene', type: 'ref', refSource: 'scenes', column: true, hideBelow: 'lg' },
      { key: 'timecode', label: 'Timecode', type: 'text', placeholder: '00:14:22' },
      { key: 'territory', label: 'Territory', type: 'text', placeholder: 'World' },
      { key: 'term', label: 'Term', type: 'text', placeholder: 'In perpetuity' },
      { key: 'fee', label: 'Fee', type: 'currency', column: true, align: 'right' },
      DUE, NOTES,
    ],
    stats: [
      { label: 'Items', kind: 'count' },
      { label: 'Cleared', kind: 'status', status: 'cleared' },
      { label: 'Outstanding', kind: 'status', status: 'requested' },
      { label: 'Clearance cost', kind: 'sum', field: 'fee', format: 'currency' },
    ],
    starters: ['Needle drop — opening titles', 'Archive footage — act two'],
  },
  {
    slug: 'legal', icon: 'legal', flag: 'pro_legal',
    label: 'Legal & Contracts', tagline: 'Every agreement, who signed and what is outstanding.',
    group: 'Legal & Rights', layout: 'board', noun: 'contract', titleLabel: 'Agreement', titlePlaceholder: 'e.g. Director’s agreement',
    statuses: [
      { value: 'drafting', label: 'Drafting', tone: 'neutral' },
      { value: 'in_review', label: 'In review', tone: 'info' },
      { value: 'out_for_signature', label: 'Out for signature', tone: 'warn' },
      { value: 'executed', label: 'Executed', tone: 'good' },
      { value: 'terminated', label: 'Terminated', tone: 'bad' },
    ],
    groupBy: 'contract_type',
    related: ['rights', 'talent', 'vendors'],
    fields: [
      { key: 'contract_type', label: 'Type', type: 'select', column: true,
        options: ['Talent', 'Crew', 'Option', 'Writer', 'Location', 'Vendor', 'Distribution', 'NDA', 'Other'] },
      { key: 'counterparty', label: 'Counterparty', type: 'text', column: true, hideBelow: 'md' },
      { key: 'value', label: 'Value', type: 'currency', column: true, align: 'right' },
      { key: 'signed_on', label: 'Signed', type: 'date', column: true, align: 'right', hideBelow: 'lg' },
      { key: 'expires_on', label: 'Expires', type: 'date' },
      { key: 'document_url', label: 'Document link', type: 'url' },
      NOTES,
    ],
    stats: [
      { label: 'Agreements', kind: 'count' },
      { label: 'Executed', kind: 'status', status: 'executed' },
      { label: 'Awaiting signature', kind: 'status', status: 'out_for_signature' },
      { label: 'Contracted value', kind: 'sum', field: 'value', format: 'currency' },
    ],
  },
  {
    slug: 'compliance', icon: 'compliance', flag: 'pro_compliance',
    label: 'Insurance & Compliance', tagline: 'Certificates, policies and risk sign-off.',
    group: 'Legal & Rights', layout: 'checklist', noun: 'policy', titleLabel: 'Policy / requirement',
    titlePlaceholder: 'e.g. General liability',
    statuses: [
      { value: 'required', label: 'Required', tone: 'neutral' },
      { value: 'quoted', label: 'Quoted', tone: 'info' },
      { value: 'bound', label: 'Bound', tone: 'good' },
      { value: 'expired', label: 'Expired', tone: 'bad' },
    ],
    groupBy: 'cover_type',
    fields: [
      { key: 'cover_type', label: 'Cover', type: 'select', column: true,
        options: ['General liability', 'Equipment', 'Errors & omissions', 'Workers comp', 'Cast', 'Vehicle', 'Drone', 'Other'] },
      { key: 'insurer', label: 'Insurer / broker', type: 'text', column: true, hideBelow: 'md' },
      { key: 'policy_number', label: 'Policy number', type: 'text', column: true, hideBelow: 'lg' },
      { key: 'coverage', label: 'Coverage limit', type: 'currency', column: true, align: 'right' },
      { key: 'premium', label: 'Premium', type: 'currency', align: 'right' },
      { key: 'expires_on', label: 'Expires', type: 'date', column: true, align: 'right' },
      NOTES,
    ],
    stats: [
      { label: 'Policies', kind: 'count' },
      { label: 'Bound', kind: 'status', status: 'bound' },
      { label: 'Expired', kind: 'status', status: 'expired' },
      { label: 'Premiums', kind: 'sum', field: 'premium', format: 'currency' },
    ],
  },
  {
    slug: 'broadcast-compliance', icon: 'broadcast-compliance', flag: 'pro_broadcast_compliance',
    label: 'Broadcast Compliance', tagline: 'Delivery specs, classification and editorial notes.',
    group: 'Legal & Rights', layout: 'checklist', noun: 'check', titleLabel: 'Requirement', titlePlaceholder: 'e.g. Loudness — EBU R128',
    statuses: PIPELINE,
    groupBy: 'area',
    fields: [
      { key: 'area', label: 'Area', type: 'select', column: true,
        options: ['Audio', 'Video', 'Captions', 'Editorial', 'Classification', 'Metadata', 'Legal'] },
      { key: 'broadcaster', label: 'Broadcaster / platform', type: 'text', column: true, hideBelow: 'md' },
      { key: 'spec', label: 'Spec', type: 'text', placeholder: '-23 LUFS ±0.5' },
      { key: 'result', label: 'Measured result', type: 'text', column: true, hideBelow: 'lg' },
      OWNER, DUE, NOTES,
    ],
    stats: [
      { label: 'Checks', kind: 'count' },
      { label: 'Passed', kind: 'status', status: 'done' },
      { label: 'Blocked', kind: 'status', status: 'blocked' },
      { label: 'Platforms', kind: 'distinct', field: 'broadcaster' },
    ],
  },
  {
    slug: 'sustainability', icon: 'sustainability', flag: 'pro_sustainability',
    label: 'Sustainability', tagline: 'Carbon actions and the numbers behind the green stamp.',
    group: 'Legal & Rights', layout: 'checklist', noun: 'action', titleLabel: 'Action', titlePlaceholder: 'e.g. Replace diesel gennies',
    statuses: PIPELINE,
    groupBy: 'category',
    fields: [
      { key: 'category', label: 'Category', type: 'select', column: true,
        options: ['Energy', 'Transport', 'Waste', 'Catering', 'Materials', 'Accommodation', 'Offset'] },
      { key: 'co2_saved', label: 'CO₂e saved (kg)', type: 'number', column: true, align: 'right' },
      { key: 'cost', label: 'Cost', type: 'currency', column: true, align: 'right', hideBelow: 'lg' },
      OWNER, DUE, NOTES,
    ],
    stats: [
      { label: 'Actions', kind: 'count' },
      { label: 'CO₂e saved (kg)', kind: 'sum', field: 'co2_saved' },
      { label: 'Done', kind: 'status', status: 'done' },
      { label: 'Spend', kind: 'sum', field: 'cost', format: 'currency' },
    ],
  },

  // ── People ───────────────────────────────────────────────────────────────
  {
    slug: 'crew-portal', icon: 'crew-portal', flag: 'pro_crew_portal',
    label: 'Crew Portal', tagline: 'Onboarding, paperwork and start dates per crew member.',
    group: 'People', layout: 'cards', noun: 'crew member', titleLabel: 'Name', titlePlaceholder: 'Crew member name',
    statuses: [
      { value: 'invited', label: 'Invited', tone: 'neutral' },
      { value: 'onboarding', label: 'Onboarding', tone: 'info' },
      { value: 'active', label: 'Active', tone: 'good' },
      { value: 'wrapped', label: 'Wrapped', tone: 'accent' },
    ],
    groupBy: 'department',
    related: ['departments', 'travel', 'catering'],
    fields: [
      { key: 'department', label: 'Department', type: 'select', column: true,
        options: ['Production', 'Camera', 'Grip & Electric', 'Art', 'Costume', 'Hair & Make-up', 'Sound', 'Post', 'VFX', 'Locations', 'Transport', 'Other'] },
      { key: 'role', label: 'Role', type: 'text', column: true },
      { key: 'email', label: 'Email', type: 'text', column: true, hideBelow: 'lg' },
      { key: 'rate', label: 'Day rate', type: 'currency', align: 'right' },
      { key: 'start_date', label: 'Start', type: 'date', column: true, align: 'right', hideBelow: 'md' },
      { key: 'paperwork', label: 'Paperwork returned', type: 'checkbox' },
      NOTES,
    ],
    stats: [
      { label: 'Crew', kind: 'count' },
      { label: 'Active', kind: 'status', status: 'active' },
      { label: 'Onboarding', kind: 'status', status: 'onboarding' },
      { label: 'Departments', kind: 'distinct', field: 'department' },
    ],
  },
  {
    slug: 'departments', icon: 'departments', flag: 'pro_departments',
    label: 'Departments', tagline: 'Heads of department, budgets and headcount.',
    group: 'People', layout: 'ledger', noun: 'department', titleLabel: 'Department', titlePlaceholder: 'e.g. Camera',
    statuses: [
      { value: 'planning', label: 'Planning', tone: 'neutral' },
      { value: 'staffed', label: 'Staffed', tone: 'info' },
      { value: 'shooting', label: 'Shooting', tone: 'good' },
      { value: 'wrapped', label: 'Wrapped', tone: 'accent' },
    ],
    fields: [
      { key: 'hod', label: 'Head of department', type: 'text', column: true },
      { key: 'headcount', label: 'Headcount', type: 'number', column: true, align: 'right' },
      { key: 'budget', label: 'Budget', type: 'currency', column: true, align: 'right' },
      { key: 'spent', label: 'Spent', type: 'currency', column: true, align: 'right', hideBelow: 'lg' },
      { key: 'contact', label: 'Contact', type: 'text', hideBelow: 'md' },
      NOTES,
    ],
    stats: [
      { label: 'Departments', kind: 'count' },
      { label: 'Headcount', kind: 'sum', field: 'headcount' },
      { label: 'Budget', kind: 'sum', field: 'budget', format: 'currency' },
      { label: 'Spent', kind: 'sum', field: 'spent', format: 'currency' },
    ],
  },
  {
    slug: 'talent', icon: 'talent', flag: 'pro_talent_mgmt',
    label: 'Talent Management', tagline: 'Offers, agents, deals and availability.',
    group: 'People', layout: 'cards', noun: 'talent', titleLabel: 'Performer', titlePlaceholder: 'Performer name',
    statuses: [
      { value: 'wishlist', label: 'Wishlist', tone: 'neutral' },
      { value: 'offer_out', label: 'Offer out', tone: 'info' },
      { value: 'negotiating', label: 'Negotiating', tone: 'warn' },
      { value: 'attached', label: 'Attached', tone: 'good' },
      { value: 'passed', label: 'Passed', tone: 'bad' },
    ],
    related: ['legal', 'travel', 'extras'],
    fields: [
      { key: 'role', label: 'Character', type: 'ref', refSource: 'characters', column: true },
      { key: 'agency', label: 'Agency', type: 'text', column: true, hideBelow: 'md' },
      { key: 'agent', label: 'Agent', type: 'text', hideBelow: 'lg' },
      { key: 'quote', label: 'Quote', type: 'currency', column: true, align: 'right' },
      { key: 'availability', label: 'Availability', type: 'text', placeholder: 'Mar–May 2026' },
      { key: 'offer_expires', label: 'Offer expires', type: 'date', column: true, align: 'right', hideBelow: 'lg' },
      NOTES,
    ],
    stats: [
      { label: 'Talent', kind: 'count' },
      { label: 'Attached', kind: 'status', status: 'attached' },
      { label: 'Offers out', kind: 'status', status: 'offer_out' },
      { label: 'Quoted total', kind: 'sum', field: 'quote', format: 'currency' },
    ],
  },
  {
    slug: 'extras', icon: 'extras', flag: 'pro_extras',
    label: 'Extras & Background', tagline: 'Background casting calls, sizes and call times.',
    group: 'People', layout: 'cards', noun: 'call', titleLabel: 'Background call', titlePlaceholder: 'e.g. Café patrons — day 4',
    statuses: BOOKING,
    fields: [
      { key: 'shoot_day', label: 'Shoot day', type: 'ref', refSource: 'shoot_days', column: true },
      { key: 'count', label: 'Number required', type: 'number', column: true, align: 'right' },
      { key: 'call_time', label: 'Call time', type: 'text', column: true, align: 'right', hideBelow: 'md' },
      { key: 'wardrobe', label: 'Wardrobe note', type: 'text', hideBelow: 'lg' },
      { key: 'rate', label: 'Rate each', type: 'currency', align: 'right' },
      { key: 'agency', label: 'Agency', type: 'text', column: true, hideBelow: 'lg' },
      NOTES,
    ],
    stats: [
      { label: 'Calls', kind: 'count' },
      { label: 'Background required', kind: 'sum', field: 'count' },
      { label: 'Confirmed', kind: 'status', status: 'confirmed' },
      { label: 'Agencies', kind: 'distinct', field: 'agency' },
    ],
  },
  {
    slug: 'travel', icon: 'travel', flag: 'pro_travel',
    label: 'Travel & Accommodation', tagline: 'Flights, hotels and ground for cast and crew.',
    group: 'People', noun: 'booking', titleLabel: 'Traveller', titlePlaceholder: 'Who is travelling',
    statuses: BOOKING,
    groupBy: 'booking_type',
    related: ['crew-portal', 'talent', 'catering'],
    fields: [
      { key: 'booking_type', label: 'Type', type: 'select', column: true,
        options: ['Flight', 'Train', 'Hotel', 'Car hire', 'Ground transport', 'Per diem'] },
      { key: 'reference', label: 'Reference', type: 'text', column: true, hideBelow: 'lg' },
      { key: 'depart', label: 'From', type: 'date', column: true, align: 'right', hideBelow: 'md' },
      { key: 'ret', label: 'To', type: 'date', column: true, align: 'right', hideBelow: 'md' },
      { key: 'cost', label: 'Cost', type: 'currency', column: true, align: 'right' },
      NOTES,
    ],
    stats: [
      { label: 'Bookings', kind: 'count' },
      { label: 'Confirmed', kind: 'status', status: 'confirmed' },
      { label: 'Travel spend', kind: 'sum', field: 'cost', format: 'currency' },
      { label: 'Travellers', kind: 'count' },
    ],
  },
  {
    slug: 'catering', icon: 'catering', flag: 'pro_catering',
    label: 'Catering & Craft', tagline: 'Meals, headcounts and dietary requirements per day.',
    group: 'People', noun: 'meal', titleLabel: 'Service', titlePlaceholder: 'e.g. Day 3 — lunch',
    statuses: BOOKING,
    fields: [
      { key: 'shoot_day', label: 'Shoot day', type: 'ref', refSource: 'shoot_days', column: true },
      { key: 'meal', label: 'Meal', type: 'select', column: true,
        options: ['Breakfast', 'Lunch', 'Dinner', 'Craft', 'Second meal'] },
      { key: 'headcount', label: 'Headcount', type: 'number', column: true, align: 'right' },
      { key: 'dietary', label: 'Dietary requirements', type: 'textarea', placeholder: '4 vegan, 2 gluten free…' },
      { key: 'supplier', label: 'Supplier', type: 'text', column: true, hideBelow: 'md' },
      { key: 'cost', label: 'Cost', type: 'currency', column: true, align: 'right', hideBelow: 'lg' },
      NOTES,
    ],
    stats: [
      { label: 'Services', kind: 'count' },
      { label: 'Meals served', kind: 'sum', field: 'headcount' },
      { label: 'Catering spend', kind: 'sum', field: 'cost', format: 'currency' },
      { label: 'Confirmed', kind: 'status', status: 'confirmed' },
    ],
  },

  // ── Production ───────────────────────────────────────────────────────────
  {
    slug: 'locations', icon: 'scouting', flag: 'pro_location_scouting',
    label: 'Location Scouting', tagline: 'Recces, permits and what each place costs.',
    group: 'Production', layout: 'cards', noun: 'location', titleLabel: 'Location', titlePlaceholder: 'Place name',
    statuses: [
      { value: 'scouting', label: 'Scouting', tone: 'neutral' },
      { value: 'recced', label: 'Recced', tone: 'info' },
      { value: 'permit_pending', label: 'Permit pending', tone: 'warn' },
      { value: 'locked', label: 'Locked', tone: 'good' },
      { value: 'rejected', label: 'Rejected', tone: 'bad' },
    ],
    related: ['safety', 'travel', 'vendors'],
    fields: [
      { key: 'scenes', label: 'Scenes', type: 'text', column: true, placeholder: '12, 14, 30' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'contact', label: 'Owner / contact', type: 'text', column: true, hideBelow: 'md' },
      { key: 'fee', label: 'Location fee', type: 'currency', column: true, align: 'right' },
      { key: 'permit_ref', label: 'Permit reference', type: 'text', hideBelow: 'lg' },
      { key: 'recce_date', label: 'Recce date', type: 'date', column: true, align: 'right', hideBelow: 'lg' },
      { key: 'power', label: 'Power on site', type: 'checkbox' },
      NOTES,
    ],
    stats: [
      { label: 'Locations', kind: 'count' },
      { label: 'Locked', kind: 'status', status: 'locked' },
      { label: 'Permits pending', kind: 'status', status: 'permit_pending' },
      { label: 'Location spend', kind: 'sum', field: 'fee', format: 'currency' },
    ],
  },
  {
    slug: 'vendors', icon: 'vendors', flag: 'pro_vendor_mgmt',
    label: 'Vendor Management', tagline: 'Suppliers, contacts, terms and spend.',
    group: 'Production', layout: 'cards', noun: 'vendor', titleLabel: 'Vendor', titlePlaceholder: 'Company name',
    statuses: [
      { value: 'prospect', label: 'Prospect', tone: 'neutral' },
      { value: 'approved', label: 'Approved', tone: 'good' },
      { value: 'on_hold', label: 'On hold', tone: 'warn' },
      { value: 'blacklisted', label: 'Blacklisted', tone: 'bad' },
    ],
    groupBy: 'category',
    fields: [
      { key: 'category', label: 'Category', type: 'select', column: true,
        options: ['Camera', 'Lighting', 'Grip', 'Sound', 'Art', 'Costume', 'Post', 'VFX', 'Transport', 'Catering', 'Other'] },
      { key: 'contact', label: 'Contact', type: 'text', column: true, hideBelow: 'md' },
      { key: 'email', label: 'Email', type: 'text', hideBelow: 'lg' },
      { key: 'terms', label: 'Payment terms', type: 'text', column: true, hideBelow: 'lg', placeholder: 'Net 30' },
      { key: 'spend', label: 'Spend to date', type: 'currency', column: true, align: 'right' },
      NOTES,
    ],
    stats: [
      { label: 'Vendors', kind: 'count' },
      { label: 'Approved', kind: 'status', status: 'approved' },
      { label: 'Categories', kind: 'distinct', field: 'category' },
      { label: 'Total spend', kind: 'sum', field: 'spend', format: 'currency' },
    ],
  },
  {
    slug: 'equipment', icon: 'equipment', flag: 'pro_equipment',
    label: 'Equipment Rentals', tagline: 'Kit out, kit back, and what it costs per day.',
    group: 'Production', noun: 'rental', titleLabel: 'Item', titlePlaceholder: 'e.g. ARRI Alexa 35 body',
    statuses: [
      { value: 'quoted', label: 'Quoted', tone: 'neutral' },
      { value: 'reserved', label: 'Reserved', tone: 'warn' },
      { value: 'out', label: 'Out', tone: 'info' },
      { value: 'returned', label: 'Returned', tone: 'good' },
      { value: 'damaged', label: 'Damaged', tone: 'bad' },
    ],
    groupBy: 'category',
    related: ['vendors', 'accounting', 'departments'],
    fields: [
      { key: 'category', label: 'Category', type: 'select', column: true,
        options: ['Camera', 'Lenses', 'Lighting', 'Grip', 'Sound', 'Power', 'Data', 'Other'] },
      { key: 'supplier', label: 'Supplier', type: 'text', column: true, hideBelow: 'md' },
      { key: 'quantity', label: 'Qty', type: 'number', column: true, align: 'right' },
      { key: 'daily_rate', label: 'Daily rate', type: 'currency', align: 'right' },
      { key: 'total', label: 'Total', type: 'currency', column: true, align: 'right' },
      { key: 'out_date', label: 'Out', type: 'date', column: true, align: 'right', hideBelow: 'lg' },
      { key: 'due_back', label: 'Due back', type: 'date' },
      NOTES,
    ],
    stats: [
      { label: 'Rentals', kind: 'count' },
      { label: 'Rental spend', kind: 'sum', field: 'total', format: 'currency' },
      { label: 'Currently out', kind: 'status', status: 'out' },
      { label: 'Suppliers', kind: 'distinct', field: 'supplier' },
    ],
  },
  {
    slug: 'safety', icon: 'stunts', flag: 'pro_stunts_safety',
    label: 'Stunts & Safety', tagline: 'Risk assessments, stunt breakdowns and sign-off.',
    group: 'Production', layout: 'checklist', noun: 'assessment', titleLabel: 'Activity', titlePlaceholder: 'e.g. Car chase — scene 44',
    statuses: [
      { value: 'identified', label: 'Identified', tone: 'neutral' },
      { value: 'assessed', label: 'Assessed', tone: 'info' },
      { value: 'mitigated', label: 'Mitigated', tone: 'warn' },
      { value: 'signed_off', label: 'Signed off', tone: 'good' },
    ],
    groupBy: 'risk_level',
    related: ['locations', 'crew-portal', 'compliance'],
    fields: [
      { key: 'risk_level', label: 'Risk', type: 'select', column: true,
        options: ['Low', 'Medium', 'High', 'Extreme'] },
      { key: 'hazard', label: 'Hazard', type: 'textarea', placeholder: 'What could go wrong' },
      { key: 'mitigation', label: 'Mitigation', type: 'textarea', placeholder: 'Controls in place' },
      { key: 'coordinator', label: 'Coordinator', type: 'text', column: true, hideBelow: 'md' },
      { key: 'scene', label: 'Scene', type: 'ref', refSource: 'scenes', column: true, hideBelow: 'lg' },
      { key: 'medic_required', label: 'Medic on set', type: 'checkbox' },
      DUE, NOTES,
    ],
    stats: [
      { label: 'Assessments', kind: 'count' },
      { label: 'Signed off', kind: 'status', status: 'signed_off' },
      { label: 'Outstanding', kind: 'status', status: 'identified' },
      { label: 'Coordinators', kind: 'distinct', field: 'coordinator' },
    ],
    starters: ['Working at height', 'Vehicle work', 'Firearms / armoury'],
  },
  {
    slug: 'script-supervising', icon: 'script-supervising', flag: 'pro_script_supervising',
    label: 'Script Supervising', tagline: 'Continuity notes, takes and coverage per scene.',
    group: 'Production', noun: 'note', titleLabel: 'Scene / slate', titlePlaceholder: 'e.g. 24A / take 3',
    statuses: [
      { value: 'unshot', label: 'Unshot', tone: 'neutral' },
      { value: 'partial', label: 'Partial coverage', tone: 'warn' },
      { value: 'covered', label: 'Covered', tone: 'good' },
      { value: 'reshoot', label: 'Reshoot', tone: 'bad' },
    ],
    fields: [
      { key: 'shoot_day', label: 'Shoot day', type: 'ref', refSource: 'shoot_days', column: true },
      { key: 'takes', label: 'Takes', type: 'number', column: true, align: 'right' },
      { key: 'printed', label: 'Circled takes', type: 'text', column: true, align: 'right', hideBelow: 'md' },
      { key: 'screen_time', label: 'Screen time', type: 'text', hideBelow: 'lg', placeholder: '1:20' },
      { key: 'continuity', label: 'Continuity notes', type: 'textarea' },
      NOTES,
    ],
    stats: [
      { label: 'Entries', kind: 'count' },
      { label: 'Takes shot', kind: 'sum', field: 'takes' },
      { label: 'Covered', kind: 'status', status: 'covered' },
      { label: 'Reshoots', kind: 'status', status: 'reshoot' },
    ],
  },

  // ── Post & Delivery ──────────────────────────────────────────────────────
  {
    slug: 'post-production', icon: 'post-production', flag: 'pro_post_production',
    label: 'Post-Production', tagline: 'The post schedule from ingest to deliverable.',
    group: 'Post & Delivery', layout: 'board', noun: 'task', titleLabel: 'Task', titlePlaceholder: 'e.g. Picture lock',
    statuses: PIPELINE,
    groupBy: 'stage',
    related: ['vfx-tracking', 'music-sound', 'archival'],
    fields: [
      { key: 'stage', label: 'Stage', type: 'select', column: true,
        options: ['Ingest', 'Assembly', 'Offline', 'Online', 'Colour', 'Sound', 'Mix', 'Deliverables'] },
      { key: 'facility', label: 'Facility', type: 'text', column: true, hideBelow: 'md' },
      OWNER,
      { key: 'start_date', label: 'Start', type: 'date', hideBelow: 'lg' },
      DUE,
      { key: 'cost', label: 'Cost', type: 'currency', column: true, align: 'right', hideBelow: 'lg' },
      NOTES,
    ],
    stats: [
      { label: 'Tasks', kind: 'count' },
      { label: 'Complete', kind: 'status', status: 'done' },
      { label: 'Blocked', kind: 'status', status: 'blocked' },
      { label: 'Post spend', kind: 'sum', field: 'cost', format: 'currency' },
    ],
  },
  {
    slug: 'vfx-tracking', icon: 'vfx-tracking', flag: 'pro_vfx_tracking',
    label: 'VFX Tracking', tagline: 'Shot-level VFX status, vendor and version.',
    group: 'Post & Delivery', layout: 'board', noun: 'shot', titleLabel: 'Shot ID', titlePlaceholder: 'e.g. SEQ010_0120',
    statuses: [
      { value: 'bid', label: 'Bid', tone: 'neutral' },
      { value: 'awarded', label: 'Awarded', tone: 'info' },
      { value: 'in_progress', label: 'In progress', tone: 'warn' },
      { value: 'review', label: 'In review', tone: 'accent' },
      { value: 'final', label: 'Final', tone: 'good' },
      { value: 'omitted', label: 'Omitted', tone: 'bad' },
    ],
    groupBy: 'vfx_type',
    related: ['post-production', 'script-supervising', 'accounting'],
    fields: [
      { key: 'vfx_type', label: 'Type', type: 'select', column: true,
        options: ['Clean-up', 'Comp', 'CG', 'Matte painting', 'Set extension', 'Simulation', 'Screen replacement', 'Other'] },
      { key: 'vendor', label: 'Vendor', type: 'text', column: true, hideBelow: 'md' },
      { key: 'scene', label: 'Scene', type: 'ref', refSource: 'scenes', column: true, hideBelow: 'lg' },
      { key: 'version', label: 'Version', type: 'text', column: true, align: 'right', hideBelow: 'lg', placeholder: 'v004' },
      { key: 'frames', label: 'Frames', type: 'number', align: 'right' },
      { key: 'bid_cost', label: 'Bid', type: 'currency', column: true, align: 'right' },
      DUE, NOTES,
    ],
    stats: [
      { label: 'Shots', kind: 'count' },
      { label: 'Final', kind: 'status', status: 'final' },
      { label: 'In progress', kind: 'status', status: 'in_progress' },
      { label: 'VFX budget', kind: 'sum', field: 'bid_cost', format: 'currency' },
    ],
  },
  {
    slug: 'music-sound', icon: 'music-sound', flag: 'pro_music_sound',
    label: 'Music & Sound', tagline: 'Cue sheet, licences and the sound deliverables.',
    group: 'Post & Delivery', noun: 'cue', titleLabel: 'Cue / track', titlePlaceholder: 'e.g. Main title theme',
    statuses: [
      { value: 'temp', label: 'Temp', tone: 'neutral' },
      { value: 'commissioned', label: 'Commissioned', tone: 'info' },
      { value: 'licensed', label: 'Licensed', tone: 'warn' },
      { value: 'delivered', label: 'Delivered', tone: 'good' },
    ],
    groupBy: 'cue_type',
    related: ['rights', 'post-production', 'legal'],
    fields: [
      { key: 'cue_type', label: 'Type', type: 'select', column: true,
        options: ['Score', 'Source', 'Needle drop', 'Library', 'SFX', 'Foley', 'ADR'] },
      { key: 'composer', label: 'Composer / artist', type: 'text', column: true, hideBelow: 'md' },
      { key: 'publisher', label: 'Publisher', type: 'text', hideBelow: 'lg' },
      { key: 'timecode', label: 'Timecode', type: 'text', column: true, align: 'right', hideBelow: 'lg' },
      { key: 'duration', label: 'Duration', type: 'text', placeholder: '2:14' },
      { key: 'fee', label: 'Fee', type: 'currency', column: true, align: 'right' },
      NOTES,
    ],
    stats: [
      { label: 'Cues', kind: 'count' },
      { label: 'Licensed', kind: 'status', status: 'licensed' },
      { label: 'Still temp', kind: 'status', status: 'temp' },
      { label: 'Music spend', kind: 'sum', field: 'fee', format: 'currency' },
    ],
  },
  {
    slug: 'multilang', icon: 'multilang', flag: 'pro_multilang',
    label: 'Localisation', tagline: 'Subtitles, dubs and territory language deliverables.',
    group: 'Post & Delivery', layout: 'board', noun: 'version', titleLabel: 'Language', titlePlaceholder: 'e.g. Norwegian subtitles',
    statuses: PIPELINE,
    groupBy: 'deliverable',
    fields: [
      { key: 'deliverable', label: 'Deliverable', type: 'select', column: true,
        options: ['Subtitles', 'SDH', 'Dub', 'Voice-over', 'Audio description', 'Script translation', 'Metadata'] },
      { key: 'language', label: 'Language', type: 'text', column: true },
      { key: 'vendor', label: 'Vendor', type: 'text', column: true, hideBelow: 'md' },
      { key: 'cost', label: 'Cost', type: 'currency', column: true, align: 'right', hideBelow: 'lg' },
      DUE, NOTES,
    ],
    stats: [
      { label: 'Versions', kind: 'count' },
      { label: 'Languages', kind: 'distinct', field: 'language' },
      { label: 'Delivered', kind: 'status', status: 'done' },
      { label: 'Localisation spend', kind: 'sum', field: 'cost', format: 'currency' },
    ],
  },
  {
    slug: 'distribution', icon: 'distribution', flag: 'pro_distribution',
    label: 'Distribution Pipeline', tagline: 'Sales agents, platforms and delivery windows.',
    group: 'Post & Delivery', layout: 'board', noun: 'deal', titleLabel: 'Partner', titlePlaceholder: 'Distributor or platform',
    statuses: [
      { value: 'target', label: 'Target', tone: 'neutral' },
      { value: 'submitted', label: 'Submitted', tone: 'info' },
      { value: 'negotiating', label: 'Negotiating', tone: 'warn' },
      { value: 'signed', label: 'Signed', tone: 'good' },
      { value: 'live', label: 'Live', tone: 'accent' },
      { value: 'passed', label: 'Passed', tone: 'bad' },
    ],
    groupBy: 'channel',
    related: ['festival', 'multilang', 'box-office'],
    fields: [
      { key: 'channel', label: 'Channel', type: 'select', column: true,
        options: ['Theatrical', 'SVOD', 'AVOD', 'TVOD', 'Broadcast', 'Educational', 'Festival', 'Sales agent'] },
      { key: 'territory', label: 'Territory', type: 'text', column: true, hideBelow: 'md' },
      { key: 'contact', label: 'Contact', type: 'text', hideBelow: 'lg' },
      { key: 'minimum_guarantee', label: 'Minimum guarantee', type: 'currency', column: true, align: 'right' },
      { key: 'window_start', label: 'Window opens', type: 'date', column: true, align: 'right', hideBelow: 'lg' },
      NOTES,
    ],
    stats: [
      { label: 'Deals', kind: 'count' },
      { label: 'Signed', kind: 'status', status: 'signed' },
      { label: 'Territories', kind: 'distinct', field: 'territory' },
      { label: 'Guarantees', kind: 'sum', field: 'minimum_guarantee', format: 'currency' },
    ],
  },
  {
    slug: 'archival', icon: 'archival', flag: 'pro_archival',
    label: 'Archival', tagline: 'Masters, LTO sets and where every element lives.',
    group: 'Post & Delivery', layout: 'checklist', noun: 'asset', titleLabel: 'Asset', titlePlaceholder: 'e.g. Graded master ProRes 4444',
    statuses: [
      { value: 'pending', label: 'Pending', tone: 'neutral' },
      { value: 'archived', label: 'Archived', tone: 'good' },
      { value: 'verified', label: 'Verified', tone: 'accent' },
      { value: 'missing', label: 'Missing', tone: 'bad' },
    ],
    groupBy: 'asset_type',
    related: ['wrap', 'post-production', 'rights'],
    fields: [
      { key: 'asset_type', label: 'Type', type: 'select', column: true,
        options: ['Camera original', 'Master', 'Audio stems', 'Project files', 'VFX elements', 'Documents', 'Stills'] },
      { key: 'medium', label: 'Medium', type: 'text', column: true, hideBelow: 'md', placeholder: 'LTO-9 / cloud' },
      { key: 'location', label: 'Physical location', type: 'text', column: true, hideBelow: 'lg' },
      { key: 'size_tb', label: 'Size (TB)', type: 'number', column: true, align: 'right' },
      { key: 'checksum', label: 'Checksum verified', type: 'checkbox' },
      { key: 'retention_until', label: 'Retain until', type: 'date' },
      NOTES,
    ],
    stats: [
      { label: 'Assets', kind: 'count' },
      { label: 'Archived', kind: 'status', status: 'archived' },
      { label: 'Missing', kind: 'status', status: 'missing' },
      { label: 'Storage (TB)', kind: 'sum', field: 'size_tb' },
    ],
  },
  {
    slug: 'wrap', icon: 'wrap', flag: 'pro_wrap',
    label: 'Wrap & Completion', tagline: 'The closing checklist — returns, reports and final payments.',
    group: 'Post & Delivery', layout: 'checklist', noun: 'item', titleLabel: 'Wrap item', titlePlaceholder: 'e.g. Return camera package',
    statuses: PIPELINE,
    groupBy: 'area',
    related: ['archival', 'accounting', 'equipment'],
    fields: [
      { key: 'area', label: 'Area', type: 'select', column: true,
        options: ['Equipment', 'Locations', 'Accounts', 'Legal', 'Crew', 'Archive', 'Deliverables'] },
      OWNER, DUE,
      { key: 'outstanding', label: 'Outstanding amount', type: 'currency', column: true, align: 'right', hideBelow: 'lg' },
      NOTES,
    ],
    stats: [
      { label: 'Items', kind: 'count' },
      { label: 'Complete', kind: 'status', status: 'done' },
      { label: 'Outstanding', kind: 'status', status: 'not_started' },
      { label: 'Money outstanding', kind: 'sum', field: 'outstanding', format: 'currency' },
    ],
    starters: ['Return all rental kit', 'Final crew payments', 'Deliver archive drive'],
  },

  // ── Audience ─────────────────────────────────────────────────────────────
  {
    slug: 'festival', icon: 'festival', flag: 'pro_festival',
    label: 'Festival Strategy', tagline: 'Deadlines, fees and where the film has been accepted.',
    group: 'Audience', layout: 'board', noun: 'submission', titleLabel: 'Festival', titlePlaceholder: 'Festival name',
    statuses: [
      { value: 'shortlist', label: 'Shortlist', tone: 'neutral' },
      { value: 'submitted', label: 'Submitted', tone: 'info' },
      { value: 'accepted', label: 'Accepted', tone: 'good' },
      { value: 'declined', label: 'Declined', tone: 'bad' },
      { value: 'screened', label: 'Screened', tone: 'accent' },
    ],
    groupBy: 'tier',
    related: ['distribution', 'marketing', 'multilang'],
    fields: [
      { key: 'tier', label: 'Tier', type: 'select', column: true,
        options: ['A-list', 'Major', 'Regional', 'Genre', 'Student', 'Online'] },
      { key: 'country', label: 'Country', type: 'text', column: true, hideBelow: 'md' },
      { key: 'deadline', label: 'Deadline', type: 'date', column: true, align: 'right' },
      { key: 'festival_date', label: 'Festival dates', type: 'text', hideBelow: 'lg' },
      { key: 'fee', label: 'Entry fee', type: 'currency', column: true, align: 'right', hideBelow: 'lg' },
      { key: 'premiere_status', label: 'Premiere requirement', type: 'text', placeholder: 'World / International' },
      NOTES,
    ],
    stats: [
      { label: 'Festivals', kind: 'count' },
      { label: 'Submitted', kind: 'status', status: 'submitted' },
      { label: 'Accepted', kind: 'status', status: 'accepted' },
      { label: 'Entry fees', kind: 'sum', field: 'fee', format: 'currency' },
    ],
  },
  {
    slug: 'marketing', icon: 'marketing', flag: 'pro_marketing',
    label: 'Marketing & PR', tagline: 'Campaign beats, assets and press coverage.',
    group: 'Audience', layout: 'board', noun: 'activity', titleLabel: 'Activity', titlePlaceholder: 'e.g. Teaser trailer drop',
    statuses: PIPELINE,
    groupBy: 'channel',
    related: ['festival', 'newsletter', 'distribution'],
    fields: [
      { key: 'channel', label: 'Channel', type: 'select', column: true,
        options: ['Trailer', 'Social', 'Press', 'Poster', 'Stills', 'EPK', 'Screening', 'Paid media', 'Partnership'] },
      OWNER,
      { key: 'publish_date', label: 'Go live', type: 'date', column: true, align: 'right' },
      { key: 'spend', label: 'Spend', type: 'currency', column: true, align: 'right', hideBelow: 'lg' },
      { key: 'asset_url', label: 'Asset link', type: 'url' },
      NOTES,
    ],
    stats: [
      { label: 'Activities', kind: 'count' },
      { label: 'Live', kind: 'status', status: 'done' },
      { label: 'In progress', kind: 'status', status: 'in_progress' },
      { label: 'Campaign spend', kind: 'sum', field: 'spend', format: 'currency' },
    ],
  },
  {
    slug: 'newsletter', icon: 'newsletter', flag: 'pro_newsletter',
    label: 'Production Newsletter', tagline: 'Issues for cast, crew, investors and backers.',
    group: 'Audience', noun: 'issue', titleLabel: 'Issue', titlePlaceholder: 'e.g. Week 3 — production update',
    statuses: [
      { value: 'idea', label: 'Idea', tone: 'neutral' },
      { value: 'drafting', label: 'Drafting', tone: 'info' },
      { value: 'scheduled', label: 'Scheduled', tone: 'warn' },
      { value: 'sent', label: 'Sent', tone: 'good' },
    ],
    fields: [
      { key: 'audience', label: 'Audience', type: 'select', column: true,
        options: ['Cast & crew', 'Investors', 'Backers', 'Press', 'Public'] },
      { key: 'send_date', label: 'Send date', type: 'date', column: true, align: 'right' },
      { key: 'recipients', label: 'Recipients', type: 'number', column: true, align: 'right', hideBelow: 'lg' },
      { key: 'headline', label: 'Headline', type: 'text', hideBelow: 'md' },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: 'What goes in this issue…' },
      NOTES,
    ],
    stats: [
      { label: 'Issues', kind: 'count' },
      { label: 'Sent', kind: 'status', status: 'sent' },
      { label: 'Scheduled', kind: 'status', status: 'scheduled' },
      { label: 'Recipients reached', kind: 'sum', field: 'recipients' },
    ],
  },
  {
    slug: 'dailies', icon: 'dailies', flag: 'pro_dailies',
    label: 'Dailies', tagline: 'What was shot, who has seen it, and what it needs.',
    group: 'Post & Delivery', noun: 'roll', titleLabel: 'Roll / card', titlePlaceholder: 'e.g. A007_0421_C012',
    related: ['script-supervising', 'post-production', 'archival'],
    statuses: [
      { value: 'ingested', label: 'Ingested', tone: 'neutral' },
      { value: 'synced', label: 'Synced', tone: 'info' },
      { value: 'circulated', label: 'Circulated', tone: 'warn' },
      { value: 'approved', label: 'Approved', tone: 'good' },
      { value: 'flagged', label: 'Flagged', tone: 'bad' },
    ],
    fields: [
      { key: 'shoot_day', label: 'Shoot day', type: 'ref', refSource: 'shoot_days', column: true },
      { key: 'camera', label: 'Camera', type: 'text', column: true, hideBelow: 'md' },
      { key: 'clips', label: 'Clips', type: 'number', column: true, align: 'right' },
      { key: 'duration', label: 'Runtime', type: 'text', column: true, align: 'right', hideBelow: 'lg' },
      { key: 'size_gb', label: 'Size (GB)', type: 'number', align: 'right' },
      { key: 'backed_up', label: 'Backed up (two copies)', type: 'checkbox' },
      NOTES,
    ],
    stats: [
      { label: 'Rolls', kind: 'count' },
      { label: 'Clips', kind: 'sum', field: 'clips' },
      { label: 'Approved', kind: 'status', status: 'approved' },
      { label: 'Flagged', kind: 'status', status: 'flagged' },
    ],
  },
  {
    slug: 'deliverables', icon: 'deliverables', flag: 'pro_deliverables',
    label: 'Delivery Checklist', tagline: 'Everything the distributor asks for, ticked off.',
    group: 'Post & Delivery', layout: 'board', noun: 'deliverable', titleLabel: 'Deliverable', titlePlaceholder: 'e.g. Textless master',
    related: ['distribution', 'multilang', 'archival'],
    statuses: PIPELINE,
    groupBy: 'category',
    fields: [
      { key: 'category', label: 'Category', type: 'select', column: true,
        options: ['Picture', 'Audio', 'Text', 'Artwork', 'Legal', 'Metadata', 'Publicity'] },
      { key: 'recipient', label: 'Recipient', type: 'text', column: true, hideBelow: 'md' },
      { key: 'spec', label: 'Spec', type: 'text', hideBelow: 'lg', placeholder: 'ProRes 4444 XQ, 24fps' },
      OWNER, DUE,
      { key: 'delivered_on', label: 'Delivered', type: 'date', column: true, align: 'right', hideBelow: 'lg' },
      NOTES,
    ],
    stats: [
      { label: 'Deliverables', kind: 'count' },
      { label: 'Delivered', kind: 'status', status: 'done' },
      { label: 'Blocked', kind: 'status', status: 'blocked' },
      { label: 'Recipients', kind: 'distinct', field: 'recipient' },
    ],
    starters: ['Textless master', 'M&E audio stems', 'Closed captions', 'Key art'],
  },
  {
    slug: 'unions', icon: 'unions', flag: 'pro_unions',
    label: 'Unions & Guilds', tagline: 'Signatory status, minimums and the filings each one wants.',
    group: 'People', layout: 'cards', noun: 'agreement', titleLabel: 'Union / guild', titlePlaceholder: 'e.g. Norsk Skuespillerforbund',
    related: ['crew-portal', 'talent', 'legal'],
    statuses: APPROVAL,
    fields: [
      { key: 'agreement', label: 'Agreement', type: 'text', column: true, placeholder: 'Low budget theatrical' },
      { key: 'covered', label: 'Covered roles', type: 'text', column: true, hideBelow: 'md' },
      { key: 'minimum', label: 'Daily minimum', type: 'currency', column: true, align: 'right' },
      { key: 'fringes', label: 'Fringes', type: 'percent', column: true, align: 'right', hideBelow: 'lg' },
      { key: 'rep', label: 'Representative', type: 'text', hideBelow: 'lg' },
      DUE, NOTES,
    ],
    stats: [
      { label: 'Agreements', kind: 'count' },
      { label: 'Approved', kind: 'status', status: 'approved' },
      { label: 'Outstanding', kind: 'status', status: 'submitted' },
      { label: 'Avg minimum', kind: 'sum', field: 'minimum', format: 'currency' },
    ],
  },
  {
    slug: 'residuals', icon: 'residuals', flag: 'pro_residuals',
    label: 'Residuals & Royalties', tagline: 'Who is owed what, once the film starts earning.',
    group: 'Money', layout: 'ledger', noun: 'entitlement', titleLabel: 'Participant', titlePlaceholder: 'Name or company',
    related: ['box-office', 'greenlight', 'legal'],
    statuses: [
      { value: 'accruing', label: 'Accruing', tone: 'neutral' },
      { value: 'due', label: 'Due', tone: 'warn' },
      { value: 'paid', label: 'Paid', tone: 'good' },
      { value: 'disputed', label: 'Disputed', tone: 'bad' },
    ],
    groupBy: 'basis',
    fields: [
      { key: 'basis', label: 'Basis', type: 'select', column: true,
        options: ['Net profit', 'Gross', 'Adjusted gross', 'Residual', 'Royalty', 'Deferral'] },
      { key: 'role', label: 'Role', type: 'text', column: true, hideBelow: 'md' },
      { key: 'share', label: 'Share', type: 'percent', column: true, align: 'right' },
      { key: 'accrued', label: 'Accrued', type: 'currency', column: true, align: 'right' },
      { key: 'paid_to_date', label: 'Paid to date', type: 'currency', column: true, align: 'right', hideBelow: 'lg' },
      NOTES,
    ],
    stats: [
      { label: 'Participants', kind: 'count' },
      { label: 'Accrued', kind: 'sum', field: 'accrued', format: 'currency' },
      { label: 'Paid', kind: 'sum', field: 'paid_to_date', format: 'currency' },
      { label: 'Due now', kind: 'status', status: 'due' },
    ],
  },
  {
    slug: 'screenings', icon: 'screenings', flag: 'pro_screenings',
    label: 'Test Screenings', tagline: 'Audience reaction, scores and what the cut changed.',
    group: 'Audience', layout: 'cards', noun: 'screening', titleLabel: 'Screening', titlePlaceholder: 'e.g. Cut 3 — friends & family',
    related: ['marketing', 'festival', 'post-production'],
    statuses: [
      { value: 'planned', label: 'Planned', tone: 'neutral' },
      { value: 'scheduled', label: 'Scheduled', tone: 'info' },
      { value: 'held', label: 'Held', tone: 'good' },
      { value: 'cancelled', label: 'Cancelled', tone: 'bad' },
    ],
    fields: [
      { key: 'cut', label: 'Cut', type: 'text', column: true, placeholder: 'Assembly / rough / fine' },
      { key: 'venue', label: 'Venue', type: 'text', column: true, hideBelow: 'md' },
      { key: 'screening_date', label: 'Date', type: 'date', column: true, align: 'right' },
      { key: 'attendance', label: 'Attendance', type: 'number', column: true, align: 'right', hideBelow: 'lg' },
      { key: 'score', label: 'Score', type: 'percent', column: true, align: 'right' },
      { key: 'takeaways', label: 'Takeaways', type: 'textarea', placeholder: 'What the room told you' },
      NOTES,
    ],
    stats: [
      { label: 'Screenings', kind: 'count' },
      { label: 'Held', kind: 'status', status: 'held' },
      { label: 'Total attendance', kind: 'sum', field: 'attendance' },
      { label: 'Venues', kind: 'distinct', field: 'venue' },
    ],
  },
];

/** Lookup by URL slug. */
export const PRO_TOOLS_BY_SLUG: Record<string, ProTool> = Object.fromEntries(
  PRO_TOOLS.map((t) => [t.slug, t])
);

export function getProTool(slug: string): ProTool | undefined {
  return PRO_TOOLS_BY_SLUG[slug];
}

/**
 * Tools to offer as onward links from `tool`. Uses the explicit `related` list
 * when the useful next step is in another group, otherwise the tool's own
 * group — so every tool always has somewhere sensible to go.
 */
export function relatedTools(tool: ProTool, limit = 3): ProTool[] {
  const slugs = tool.related?.length
    ? tool.related
    : PRO_TOOLS.filter((t) => t.group === tool.group && t.slug !== tool.slug).map((t) => t.slug);
  return slugs
    .map((slug) => PRO_TOOLS_BY_SLUG[slug])
    .filter((t): t is ProTool => Boolean(t) && t.slug !== tool.slug)
    .slice(0, limit);
}

/** Tools bucketed by their `group`, in registry order. */
export function proToolsByGroup(): { group: ProToolGroup; tools: ProTool[] }[] {
  const groups: { group: ProToolGroup; tools: ProTool[] }[] = [];
  for (const tool of PRO_TOOLS) {
    const existing = groups.find((g) => g.group === tool.group);
    if (existing) existing.tools.push(tool);
    else groups.push({ group: tool.group, tools: [tool] });
  }
  return groups;
}
