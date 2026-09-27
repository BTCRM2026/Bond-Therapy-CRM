import type { LetterType } from './letter-types.js';
import type { LetterSnapshot } from './letters.service.js';

type Recipient = {
  name: string;
  designation?: string | null;
  department?: string | null;
};
type Details = Record<string, string | undefined>;

const html = (value?: string | null) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('\n', '<br>');
const strong = (value?: string | null) => `<strong>${html(value)}</strong>`;
const dateFmt = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : '';
const money = (value?: string) =>
  value && Number.isFinite(Number(value))
    ? `INR ${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : '';

export function buildLetterContent(
  type: LetterType,
  recipient: Recipient,
  details: Details,
  snapshot?: LetterSnapshot,
): { subject: string; paragraphs: string[]; sections?: Array<{ title: string; paragraphs: string[] }> } {
  const name = html(recipient.name);
  const firstName = html(
    recipient.name.trim().split(/\s+/)[0] || recipient.name,
  );
  const d = details;
  const company = html(snapshot?.company.displayName || 'Bond Therapy Professional');
  const legalCompany = html(snapshot?.company.legalName || snapshot?.company.displayName || 'Bond Therapy Professional');
  const employee = snapshot?.employee;
  const assignedRoleClauses = employee?.roleTrack === 'SALES'
    ? [
        'Develop and maintain professional relationships with assigned salons, distributors and authorised business contacts; present Company products accurately; and complete assigned visits, follow-ups and business-development activities.',
        'Maintain accurate CRM records for customers, territories, leads, visits, quotations and material interactions. Territory or account ownership may be changed only with authorised management approval.',
        'Follow approved pricing, discount, credit, quotation and order procedures; avoid unauthorised commercial, technical or product claims; and promptly escalate material customer complaints or disputes.',
      ]
    : employee?.roleTrack === 'TECHNICAL'
      ? [
          'Perform assigned demonstrations, salon visits, training and technical services professionally, following approved product procedures, labels, safety instructions and Company training.',
          'Maintain professional hygiene and presentation, record technical visits and feedback accurately in the CRM, and promptly escalate adverse reactions, product complaints, safety concerns or unusual results.',
          'Do not provide medical diagnosis or advice, make unapproved claims, or knowingly alter approved technical procedures without appropriate authorisation.',
        ]
      : ['Perform the responsibilities assigned to the role diligently, maintain accurate records and follow lawful management instructions and applicable Company policies.'];

  switch (type) {
    case 'OFFER':
      return {
        subject: `Offer of employment - ${name}`,
        paragraphs: [
          `We are pleased to offer you the position of ${strong(d.designation)} in the ${strong(d.department)} department at ${company}. Your proposed joining date is ${strong(dateFmt(d.joiningDate))}, your primary work location will be ${strong(d.workLocation)}, and the employment type is ${strong(d.employmentType)}.`,
          `Your monthly gross earnings (Total A) will be ${strong(money(d.monthlyGross))} and annual cost to company will be ${strong(money(d.ctc))}, subject to statutory deductions and applicable Company policies. A detailed appointment letter will be issued after completion of joining formalities and verification of documents.`,
          `Please confirm your acceptance within the period communicated by Human Resources. We look forward to welcoming you and to a productive professional association.`,
        ],
      };
    case 'APPOINTMENT':
      return {
        subject: `Appointment as ${html(d.designation)}`,
        paragraphs: [`Following your acceptance of our offer, ${legalCompany} appoints you on the following employee-specific terms. This document and the applicable Company policies together govern your employment.`],
        sections: [
          { title: '1. Appointment and employee details', paragraphs: [`You are appointed as ${strong(d.designation)} in the ${strong(d.department)} department with effect from ${strong(dateFmt(d.joiningDate))}. Employee ID: ${strong(employee?.employeeCode || 'To be assigned')}. Employment type: ${strong(d.employmentType)}.`] },
          { title: '2. Reporting and place of work', paragraphs: [`Your primary work location is ${strong(d.workLocation)} and you will report to ${strong(d.reportingManager)} or another person designated by management. Business requirements may involve authorised travel to customer, salon, distributor, training, office, event or exhibition locations.`] },
          { title: '3. Probation', paragraphs: [`You will remain on probation for ${strong(`${html(d.probationMonths)} month(s)`)}. Performance, attendance, conduct, role suitability, communication and applicable technical or customer-handling capability may be reviewed. Confirmation is not automatic and remains subject to Company approval.`] },
          { title: '4. Working hours, attendance and leave', paragraphs: ['Working hours, weekly offs, field schedules, shifts and leave are governed by Company policy and role requirements. You must report on time, record attendance through the approved system, obtain leave approval and promptly report unavoidable absence.'] },
          { title: '5. Compensation and incentives', paragraphs: [`Your annual cost to company is ${strong(money(d.ctc))}, payable under the approved compensation structure and subject to statutory deductions. Any incentive, commission, bonus or performance-linked payment applies only when separately approved and configured under Company policy.`] },
          { title: '6. Duties and responsibilities', paragraphs: ['You must perform assigned duties diligently, maintain professional standards, follow lawful instructions and Company policies, protect Company property and information, maintain accurate records, and treat customers and colleagues professionally.'] },
          { title: employee?.roleTrack === 'SALES' ? '7. Sales and territory responsibilities' : employee?.roleTrack === 'TECHNICAL' ? '7. Technical and professional responsibilities' : '7. Role responsibilities', paragraphs: assignedRoleClauses },
          { title: '8. Performance expectations', paragraphs: [employee?.roleTrack === 'SALES' ? 'Performance may be assessed using approved records for revenue, salon acquisition, retention, collection, visit activity, follow-up completion, territory development and CRM discipline. No target is created by this document.' : employee?.roleTrack === 'TECHNICAL' ? 'Performance may be assessed using approved records for technical execution, product knowledge, demonstration quality, salon support, training participation, feedback, reporting, safety and conduct.' : 'Performance may be assessed using role-specific objectives and records approved by the Company.'] },
          { title: '9. Confidentiality and information security', paragraphs: ['Customer, salon, distributor, pricing, commercial, sales, CRM, employee, product, technical, training, internal communication and business-planning information must be kept confidential and disclosed only to authorised persons. Use only your authorised CRM account; do not share credentials, manipulate or delete records, or export confidential information without permission.'] },
          { title: '10. Customer relationships and professional conduct', paragraphs: ['Maintain respectful, professional relationships with customers, salons, distributors, colleagues and business partners. Company relationships, information and resources must not be misused for personal benefit. Harassment, discrimination, intimidation, abusive conduct, fraud and falsification of records are handled under Company policy and applicable law.'] },
          { title: '11. Company property and product compliance', paragraphs: ['Protect and return assigned devices, SIM cards, identity cards, samples, stock, tools, training material, documents, marketing material, credentials, access cards and other assets. When handling professional hair-care products, follow approved instructions and safety procedures, preserve product integrity and report complaints or incidents.'] },
          { title: '12. Travel, expenses and conflicts', paragraphs: ['Approved business travel and expenses are handled under the applicable policy. Disclose actual or potential conflicts of interest. Outside employment or business activity must not conflict with Company duties, confidentiality or business interests, subject to applicable law.'] },
          { title: '13. Intellectual property and policy changes', paragraphs: ['Work product created for Company business is handled under applicable law and Company policy. The Company may update internal policies, reporting structures and operating procedures subject to applicable law and contractual rights.'] },
          { title: '14. Notice, separation and exit responsibilities', paragraphs: [`Notice requirements are ${strong(d.noticePeriod)} as recorded for this employment. On separation you may be required to complete handover, return assets and samples, transfer responsibilities, clear advances, complete CRM handover and fulfil applicable exit formalities.`] },
          { title: '15. Statutory compliance and acceptance', paragraphs: [`These terms operate subject to applicable Indian law, employment regulations, employee-specific terms and Company policies. I acknowledge that I have read and understood the terms applicable to my employment and agree to comply with the Company's applicable policies, procedures and lawful instructions.`] },
        ],
      };
    case 'PROBATION':
      return {
        subject: `Confirmation of probation terms - ${name}`,
        paragraphs: [
          `This letter confirms that you joined ${company} as ${strong(d.designation)} in the ${strong(d.department)} department on ${strong(dateFmt(d.joiningDate))}. Your probation period is ${strong(`${html(d.probationMonths)} month(s)`)} and the current review status is ${strong(d.probationStatus)}.`,
          `Your performance, conduct and role suitability will be reviewed on or around ${strong(dateFmt(d.reviewDate))}. Based on that review, the probation may be confirmed, extended or concluded in accordance with Company policy.`,
          `We encourage you to use this period to understand your responsibilities, operating standards and performance expectations.`,
        ],
      };
    case 'CONFIRMATION':
      return {
        subject: `Confirmation of employment - ${name}`,
        paragraphs: [
          `We are pleased to confirm that you have successfully completed your probation as ${strong(d.designation)} in the ${strong(d.department)} department.`,
          `Your employment with ${company} is confirmed with effect from ${strong(dateFmt(d.confirmedFrom))}. All other applicable terms and conditions remain governed by the Appointment Letter / Staff Employment Agreement and applicable Company policies.`,
          `Congratulations on this milestone. We appreciate your contribution and look forward to your continued growth with the organisation.`,
        ],
      };
    case 'INTERNSHIP':
      return {
        subject: `Internship engagement - ${name}`,
        paragraphs: [
          `We are pleased to offer you an internship position with ${company} as ${strong(d.designation)} in the ${strong(d.department)} department. This engagement is designed to provide meaningful, practical exposure to our professional operations, standards and ways of working.`,
          `Your internship will commence on ${strong(dateFmt(d.startDate))} and conclude on ${strong(dateFmt(d.endDate))}. During this period, you will work closely with the assigned team, participate in relevant projects and carry out responsibilities aligned with the learning objectives and operational requirements of the department. You will receive appropriate guidance and feedback throughout the engagement.`,
          `You will report to the manager or mentor nominated by the Company and are expected to maintain accurate work records, meet agreed timelines and communicate progress responsibly. All documents, data, systems, work products and other materials accessed or created during the internship must be handled with due care and used only for authorised business purposes.`,
          `In recognition of your contribution, you will receive a monthly stipend of ${strong(money(d.stipend))}, payable in accordance with the Company's standard payment cycle and applicable requirements. This internship is a learning engagement and does not, by itself, constitute an offer or guarantee of permanent employment.`,
          `You are expected to maintain high standards of professionalism, punctuality, integrity and confidentiality, and to comply with all applicable Company policies and instructions. We look forward to a productive association and wish you a valuable and rewarding learning experience with Bond Therapy Professional.`,
        ],
      };
    case 'PROMOTION':
      return {
        subject: `Promotion to ${html(d.newDesignation)}`,
        paragraphs: [
          `In recognition of your performance and contribution, we are pleased to promote you from ${strong(d.previousDesignation)} to ${strong(d.newDesignation)} with effect from ${strong(dateFmt(d.effectiveDate))}.`,
          d.newCtc
            ? `Your revised annual cost to company will be ${strong(money(d.newCtc))}, subject to statutory deductions and the applicable compensation structure.`
            : `Your compensation and all other employment terms remain unchanged unless communicated separately in writing.`,
          `We congratulate you on this well-earned progression and trust that you will continue to demonstrate ownership, leadership and commitment in your expanded role.`,
        ],
      };
    case 'SALARY_INCREMENT':
      return {
        subject: `Revision of compensation - ${name}`,
        paragraphs: [
          `We are pleased to revise your annual cost to company for the role of ${strong(d.designation)} from ${strong(money(d.previousCtc))} to ${strong(money(d.newCtc))}, effective ${strong(dateFmt(d.effectiveDate))}. The total annual increase is ${strong(money(d.increaseAmount))}.`,
          `The revised compensation remains subject to statutory deductions and the Company's applicable policies. All other terms and conditions of your employment remain unchanged.`,
          `This revision recognises your contribution to the organisation. We look forward to your continued performance and professional growth.`,
        ],
      };
    case 'WARNING':
      return {
        subject: `Formal warning regarding conduct or performance`,
        paragraphs: [
          `This letter records a formal warning concerning the matter dated ${strong(dateFmt(d.issueDate))} in connection with your responsibilities as ${strong(d.designation)} in the ${strong(d.department)} department.`,
          `<strong>${html(d.warningCategory)} — documented concern for ${html(d.performancePeriod)}:</strong><br>${html(d.reason)}`,
          `<strong>Expected corrective action:</strong><br>${html(d.expectedImprovement)}<br><br>Your progress will be reviewed during ${html(d.reviewPeriod)}. The Company will provide reasonable role-related guidance. Failure to demonstrate sustained improvement may lead to further action under applicable Company policy.`,
          `Please acknowledge receipt of this communication and discuss any clarification required with Human Resources.`,
        ],
      };
    case 'NOC':
      return {
        subject: `No Objection Certificate - ${name}`,
        paragraphs: [
          `This is to certify that ${strong(recipient.name)}${employee?.employeeCode ? `, Employee ID ${strong(employee.employeeCode)}` : ''}, is associated with ${legalCompany}${recipient.designation ? ` as ${strong(recipient.designation)}` : ''}. Based on Company records, the Company has no objection to the following stated purpose:`,
          `${html(d.purpose)}`,
          d.validUntil
            ? `This certificate is valid until ${strong(dateFmt(d.validUntil))} and is issued solely for the purpose stated above.`
            : `This certificate is issued at the recipient's request solely for the purpose stated above.`,
        ],
      };
    case 'EXPERIENCE':
      return {
        subject: `Certificate of employment and experience - ${name}`,
        paragraphs: [
          `This is to certify that ${strong(recipient.name)} was employed with ${legalCompany} as ${strong(d.designation)} in the ${strong(d.department)} department from ${strong(dateFmt(d.joiningDate))} to ${strong(d.endDate ? dateFmt(d.endDate) : 'Present')}.`,
          `During this tenure, ${firstName} discharged assigned responsibilities with sincerity and maintained professional conduct.`,
          `We appreciate the contribution made to the organisation and wish ${firstName} success in future professional endeavours. This letter is issued upon request for official use.`,
        ],
      };
    case 'RESIGNATION_ACCEPTANCE':
      return {
        subject: `Acceptance of resignation - ${name}`,
        paragraphs: [
          `We acknowledge your resignation dated ${strong(dateFmt(d.resignationDate))} from the position of ${strong(d.designation)} and confirm its acceptance.`,
          `Your last working day with Bond Therapy Professional will be ${strong(dateFmt(d.lastWorkingDate))}. Please complete the required handover, return Company property and conclude all exit formalities by that date.`,
          `We thank you for your contribution during your association with the organisation and wish you success in your future endeavours.`,
        ],
      };
    case 'RELIEVING':
      return {
        subject: `Relieving confirmation - ${name}`,
        paragraphs: [
          `This is to certify that ${strong(recipient.name)}${employee?.employeeCode ? `, Employee ID ${strong(employee.employeeCode)}` : ''}, was employed with ${legalCompany} as ${strong(d.designation)} from ${strong(dateFmt(d.joiningDate))} to ${strong(dateFmt(d.lastWorkingDate))} and is relieved from duties with effect from ${strong(dateFmt(d.relievingDate))}.`,
          `The employee has completed the required handover and exit formalities, subject to settlement of any obligations identified under Company policy.`,
          `We thank ${firstName} for the contribution made during the tenure and wish ${firstName} success in future endeavours.`,
        ],
      };
    case 'TERMINATION':
      return {
        subject: `Termination of employment - ${name}`,
        paragraphs: [
          `This letter formally communicates that your employment as ${strong(d.designation)} with ${legalCompany} will end with effect from ${strong(dateFmt(d.terminationDate))}.`,
          `<strong>Approved reason category: ${html(d.reasonCategory)}</strong><br>${html(d.reason)}`,
          `<strong>Notice / pay treatment:</strong><br>${html(d.noticeTreatment)}`,
          d.settlementNote
            ? `${html(d.settlementNote)}`
            : `Your full and final settlement will be processed in accordance with Company policy and applicable requirements.`,
          `You must complete the prescribed handover, return all Company property, information and access credentials, and cooperate with the final-settlement process. Continuing confidentiality obligations remain applicable. This communication is issued subject to the applicable employment terms, Company policies and applicable law.`,
        ],
      };
    default:
      return { subject: name, paragraphs: [] };
  }
}
