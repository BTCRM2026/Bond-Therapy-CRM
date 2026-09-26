export const LETTER_TYPES = ['OFFER', 'APPOINTMENT', 'PROBATION', 'CONFIRMATION', 'INTERNSHIP', 'PROMOTION', 'SALARY_INCREMENT', 'WARNING', 'NOC', 'EXPERIENCE', 'RESIGNATION_ACCEPTANCE', 'RELIEVING', 'TERMINATION'] as const;
export type LetterType = (typeof LETTER_TYPES)[number];

export const LETTER_LABELS: Record<LetterType, string> = {
  OFFER: 'Offer Letter',
  APPOINTMENT: 'Appointment Letter',
  PROBATION: 'Probation Letter',
  CONFIRMATION: 'Confirmation Letter',
  INTERNSHIP: 'Internship Letter',
  PROMOTION: 'Promotion Letter',
  SALARY_INCREMENT: 'Salary Increment Letter',
  WARNING: 'Warning Letter',
  NOC: 'No Objection Certificate',
  EXPERIENCE: 'Experience Letter',
  RESIGNATION_ACCEPTANCE: 'Resignation Acceptance Letter',
  RELIEVING: 'Relieving Letter',
  TERMINATION: 'Termination Letter',
};

export const LETTER_CATEGORIES: Record<LetterType, string> = {
  OFFER: 'Hiring',
  APPOINTMENT: 'Hiring',
  PROBATION: 'Hiring',
  CONFIRMATION: 'Hiring',
  INTERNSHIP: 'Hiring',
  PROMOTION: 'Compensation',
  SALARY_INCREMENT: 'Compensation',
  WARNING: 'Compliance',
  NOC: 'Compliance',
  EXPERIENCE: 'Exit',
  RESIGNATION_ACCEPTANCE: 'Exit',
  RELIEVING: 'Exit',
  TERMINATION: 'Exit',
};

export type LetterFieldDef = { key: string; label: string; type: 'text' | 'date' | 'money' | 'textarea'; required: boolean; placeholder?: string };

export const LETTER_FIELDS: Record<LetterType, LetterFieldDef[]> = {
  OFFER: [
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'department', label: 'Department', type: 'text', required: true },
    { key: 'ctc', label: 'Annual CTC', type: 'money', required: true },
    { key: 'joiningDate', label: 'Proposed joining date', type: 'date', required: true },
  ],
  APPOINTMENT: [
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'department', label: 'Department', type: 'text', required: true },
    { key: 'ctc', label: 'Annual CTC', type: 'money', required: true },
    { key: 'joiningDate', label: 'Joining date', type: 'date', required: true },
    { key: 'probationMonths', label: 'Probation period (months)', type: 'text', required: true, placeholder: 'e.g. 3' },
  ],
  PROBATION: [
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'department', label: 'Department', type: 'text', required: true },
    { key: 'joiningDate', label: 'Joining date', type: 'date', required: true },
    { key: 'probationMonths', label: 'Probation period (months)', type: 'text', required: true, placeholder: 'e.g. 3' },
    { key: 'reviewDate', label: 'Probation review date', type: 'date', required: true },
  ],
  CONFIRMATION: [
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'department', label: 'Department', type: 'text', required: true },
    { key: 'confirmedFrom', label: 'Confirmed permanent from', type: 'date', required: true },
  ],
  INTERNSHIP: [
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'department', label: 'Department', type: 'text', required: true },
    { key: 'startDate', label: 'Start date', type: 'date', required: true },
    { key: 'endDate', label: 'End date', type: 'date', required: true },
    { key: 'stipend', label: 'Monthly stipend', type: 'money', required: true },
  ],
  PROMOTION: [
    { key: 'previousDesignation', label: 'Previous designation', type: 'text', required: true },
    { key: 'newDesignation', label: 'New designation', type: 'text', required: true },
    { key: 'effectiveDate', label: 'Effective date', type: 'date', required: true },
    { key: 'newCtc', label: 'Revised annual CTC', type: 'money', required: false },
  ],
  SALARY_INCREMENT: [
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'previousCtc', label: 'Previous annual CTC', type: 'money', required: true },
    { key: 'newCtc', label: 'Revised annual CTC', type: 'money', required: true },
    { key: 'effectiveDate', label: 'Effective date', type: 'date', required: true },
  ],
  WARNING: [
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'department', label: 'Department', type: 'text', required: true },
    { key: 'issueDate', label: 'Date of incident', type: 'date', required: true },
    { key: 'reason', label: 'Reason / description', type: 'textarea', required: true },
  ],
  NOC: [
    { key: 'purpose', label: 'Purpose', type: 'textarea', required: true, placeholder: 'e.g. applying for a personal loan' },
    { key: 'validUntil', label: 'Valid until', type: 'date', required: false },
  ],
  EXPERIENCE: [
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'department', label: 'Department', type: 'text', required: true },
    { key: 'joiningDate', label: 'Joining date', type: 'date', required: true },
    { key: 'endDate', label: 'Last working date (blank = till date)', type: 'date', required: false },
  ],
  RESIGNATION_ACCEPTANCE: [
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'resignationDate', label: 'Resignation submitted on', type: 'date', required: true },
    { key: 'lastWorkingDate', label: 'Last working date', type: 'date', required: true },
  ],
  RELIEVING: [
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'lastWorkingDate', label: 'Last working date', type: 'date', required: true },
  ],
  TERMINATION: [
    { key: 'designation', label: 'Designation', type: 'text', required: true },
    { key: 'terminationDate', label: 'Termination effective date', type: 'date', required: true },
    { key: 'reason', label: 'Reason', type: 'textarea', required: true },
    { key: 'settlementNote', label: 'Settlement note', type: 'textarea', required: false },
  ],
};
