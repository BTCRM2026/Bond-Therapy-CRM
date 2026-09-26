import type { LetterType } from './letter-types.js';

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
): { subject: string; paragraphs: string[] } {
  const name = html(recipient.name);
  const firstName = html(
    recipient.name.trim().split(/\s+/)[0] || recipient.name,
  );
  const d = details;

  switch (type) {
    case 'OFFER':
      return {
        subject: `Offer of employment - ${name}`,
        paragraphs: [
          `We are pleased to offer you the position of ${strong(d.designation)} in the ${strong(d.department)} department at Bond Therapy Professional. Your proposed joining date is ${strong(dateFmt(d.joiningDate))}.`,
          `Your annual cost to company will be ${strong(money(d.ctc))}, subject to statutory deductions and the Company's applicable policies. A detailed appointment letter will be issued after completion of joining formalities and verification of documents.`,
          `Please confirm your acceptance within the period communicated by Human Resources. We look forward to welcoming you and to a productive professional association.`,
        ],
      };
    case 'APPOINTMENT':
      return {
        subject: `Appointment as ${html(d.designation)}`,
        paragraphs: [
          `Following your acceptance of our offer, we are pleased to appoint you as ${strong(d.designation)} in the ${strong(d.department)} department with effect from ${strong(dateFmt(d.joiningDate))}.`,
          `Your annual cost to company will be ${strong(money(d.ctc))}, payable in accordance with the Company's compensation structure and subject to statutory deductions. You will remain on probation for ${strong(`${html(d.probationMonths)} month(s)`)} from your date of joining.`,
          `During your employment, you are expected to perform your responsibilities diligently, protect confidential information, and comply with all Company policies. Your appointment is subject to satisfactory verification of the information and documents provided by you.`,
          `We welcome you to Bond Therapy Professional and look forward to your contribution and growth with the organisation.`,
        ],
      };
    case 'PROBATION':
      return {
        subject: `Confirmation of probation terms - ${name}`,
        paragraphs: [
          `This letter confirms that you joined Bond Therapy Professional as ${strong(d.designation)} in the ${strong(d.department)} department on ${strong(dateFmt(d.joiningDate))}. Your probation period is ${strong(`${html(d.probationMonths)} month(s)`)}.`,
          `Your performance, conduct and role suitability will be reviewed on or around ${strong(dateFmt(d.reviewDate))}. Based on that review, the probation may be confirmed, extended or concluded in accordance with Company policy.`,
          `We encourage you to use this period to understand your responsibilities, operating standards and performance expectations.`,
        ],
      };
    case 'CONFIRMATION':
      return {
        subject: `Confirmation of employment - ${name}`,
        paragraphs: [
          `We are pleased to confirm that you have successfully completed your probation as ${strong(d.designation)} in the ${strong(d.department)} department.`,
          `Your employment with Bond Therapy Professional is confirmed with effect from ${strong(dateFmt(d.confirmedFrom))}. All other terms and conditions of your employment remain unchanged unless communicated separately in writing.`,
          `Congratulations on this milestone. We appreciate your contribution and look forward to your continued growth with the organisation.`,
        ],
      };
    case 'INTERNSHIP':
      return {
        subject: `Internship engagement - ${name}`,
        paragraphs: [
          `We are pleased to offer you an internship position with Bond Therapy Professional as ${strong(d.designation)} in the ${strong(d.department)} department. This engagement is designed to provide meaningful, practical exposure to our professional operations, standards and ways of working.`,
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
          `We are pleased to revise your annual cost to company for the role of ${strong(d.designation)} from ${strong(money(d.previousCtc))} to ${strong(money(d.newCtc))}, effective ${strong(dateFmt(d.effectiveDate))}.`,
          `The revised compensation remains subject to statutory deductions and the Company's applicable policies. All other terms and conditions of your employment remain unchanged.`,
          `This revision recognises your contribution to the organisation. We look forward to your continued performance and professional growth.`,
        ],
      };
    case 'WARNING':
      return {
        subject: `Formal warning regarding conduct or performance`,
        paragraphs: [
          `This letter records a formal warning concerning the matter dated ${strong(dateFmt(d.issueDate))} in connection with your responsibilities as ${strong(d.designation)} in the ${strong(d.department)} department.`,
          `<strong>Recorded concern:</strong><br>${html(d.reason)}`,
          `The stated matter is not consistent with the standards expected at Bond Therapy Professional. You are required to take immediate corrective action and demonstrate sustained improvement. Any recurrence or failure to improve may lead to further disciplinary action in accordance with Company policy.`,
          `Please acknowledge receipt of this communication and discuss any clarification required with Human Resources.`,
        ],
      };
    case 'NOC':
      return {
        subject: `No Objection Certificate - ${name}`,
        paragraphs: [
          `This is to certify that Bond Therapy Professional has no objection to ${strong(recipient.name)}${recipient.designation ? `, ${strong(recipient.designation)}` : ''}, proceeding for the following stated purpose:`,
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
          `This is to certify that ${strong(recipient.name)} was employed with Bond Therapy Professional as ${strong(d.designation)} in the ${strong(d.department)} department from ${strong(dateFmt(d.joiningDate))} to ${strong(d.endDate ? dateFmt(d.endDate) : 'Present')}.`,
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
          `This is to confirm that ${strong(recipient.name)}, employed as ${strong(d.designation)}, has been relieved from duties at Bond Therapy Professional with effect from the close of business on ${strong(dateFmt(d.lastWorkingDate))}.`,
          `The employee has completed the required handover and exit formalities, subject to settlement of any obligations identified under Company policy.`,
          `We thank ${firstName} for the contribution made during the tenure and wish ${firstName} success in future endeavours.`,
        ],
      };
    case 'TERMINATION':
      return {
        subject: `Termination of employment - ${name}`,
        paragraphs: [
          `This letter formally communicates that your employment as ${strong(d.designation)} with Bond Therapy Professional will end with effect from ${strong(dateFmt(d.terminationDate))}.`,
          `<strong>Reason:</strong><br>${html(d.reason)}`,
          d.settlementNote
            ? `${html(d.settlementNote)}`
            : `Your full and final settlement will be processed in accordance with Company policy and applicable requirements.`,
          `You must return all Company property, information and access credentials in your possession and complete the prescribed exit formalities.`,
        ],
      };
    default:
      return { subject: name, paragraphs: [] };
  }
}
