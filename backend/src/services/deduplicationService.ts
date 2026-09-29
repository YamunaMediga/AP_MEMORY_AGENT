import { queryOne } from '../database/db.js';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: 'exact_file' | 'same_invoice_different_file';
  reason?: string;
  originalRequestId?: string;
  originalRefCode?: string;
  originalDate?: string;
  originalAmount?: number;
  matchType?: 'file_hash' | 'invoice_number' | 'amount_date_vendor';
}

class DeduplicationService {
  /**
   * Evaluates whether an incoming invoice/request is a duplicate of a previously submitted record
   */
  public checkDuplicate(params: {
    userId: string;
    invoiceNumber?: string;
    applicantName?: string;
    amount?: number;
    invoiceDate?: string;
    pdfHash?: string;
    currentRequestId?: string;
  }): DuplicateCheckResult {
    const { userId, invoiceNumber, applicantName, amount, invoiceDate, pdfHash, currentRequestId } = params;

    // Check 1: Exact File Hash match (identical PDF uploaded again)
    if (pdfHash) {
      const hashMatch = queryOne<any>(
        `SELECT id, ref_code, created_at, amount, applicant_name, invoice_number 
         FROM requests 
         WHERE user_id = ? AND pdf_hash = ? AND (id != ? OR ? IS NULL)
         LIMIT 1`,
        [userId, pdfHash, currentRequestId || '', currentRequestId || null]
      );

      if (hashMatch) {
        return {
          isDuplicate: true,
          duplicateType: 'exact_file',
          matchType: 'file_hash',
          reason: `Exact identical PDF file was previously submitted on ${new Date(hashMatch.created_at).toLocaleDateString()} under ${hashMatch.ref_code}.`,
          originalRequestId: hashMatch.id,
          originalRefCode: hashMatch.ref_code,
          originalDate: hashMatch.created_at,
          originalAmount: hashMatch.amount,
        };
      }
    }

    // Check 2: Same Invoice Number from the same Vendor/Applicant
    if (invoiceNumber && applicantName && invoiceNumber.trim() && applicantName.trim()) {
      const invMatch = queryOne<any>(
        `SELECT id, ref_code, created_at, amount, applicant_name, invoice_number 
         FROM requests 
         WHERE user_id = ? 
           AND LOWER(invoice_number) = LOWER(?) 
           AND LOWER(applicant_name) = LOWER(?)
           AND (id != ? OR ? IS NULL)
         LIMIT 1`,
        [userId, invoiceNumber.trim(), applicantName.trim(), currentRequestId || '', currentRequestId || null]
      );

      if (invMatch) {
        return {
          isDuplicate: true,
          duplicateType: 'same_invoice_different_file',
          matchType: 'invoice_number',
          reason: `Duplicate Invoice Warning: Invoice #${invoiceNumber} from ${applicantName} for $${amount || invMatch.amount} was already processed on ${new Date(invMatch.created_at).toLocaleDateString()} under ${invMatch.ref_code}.`,
          originalRequestId: invMatch.id,
          originalRefCode: invMatch.ref_code,
          originalDate: invMatch.created_at,
          originalAmount: invMatch.amount,
        };
      }
    }

    // Check 3: Near-duplicate match (Same vendor + exact amount + same transmission date)
    if (applicantName && amount !== undefined && invoiceDate) {
      const nearMatch = queryOne<any>(
        `SELECT id, ref_code, created_at, amount, applicant_name, invoice_number 
         FROM requests 
         WHERE user_id = ? 
           AND LOWER(applicant_name) = LOWER(?) 
           AND ABS(amount - ?) < 0.01
           AND invoice_date = ?
           AND (id != ? OR ? IS NULL)
         LIMIT 1`,
        [userId, applicantName.trim(), amount, invoiceDate, currentRequestId || '', currentRequestId || null]
      );

      if (nearMatch) {
        return {
          isDuplicate: true,
          duplicateType: 'same_invoice_different_file',
          matchType: 'amount_date_vendor',
          reason: `Potential Double-Billing: An invoice for $${amount} from ${applicantName} dated ${invoiceDate} was already submitted under ${nearMatch.ref_code}.`,
          originalRequestId: nearMatch.id,
          originalRefCode: nearMatch.ref_code,
          originalDate: nearMatch.created_at,
          originalAmount: nearMatch.amount,
        };
      }
    }

    return { isDuplicate: false };
  }
}

export const deduplicationService = new DeduplicationService();
