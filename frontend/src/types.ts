export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface MemoryItem {
  id: string;
  content: string;
  context: string;
  memoryType?: string;
  relevanceScore: number;
  source: 'hindsight_cloud' | 'hindsight_local';
  createdAt: string;
  vendorName?: string;
  invoiceRef?: string;
  discrepancyType?: string;
  previousDecision?: string;
  exceptionNote?: string;
  whyRelevant?: string;
  learningScope?: 'general' | 'vendor' | 'invoice';
}

export interface AuditStepRecord {
  step: string;
  label: string;
  timestamp: string;
  details?: any;
}

export interface DiscrepancyResult {
  detected: boolean;
  type: 'none' | 'shipping_unmatched' | 'po_amount_variance' | 'tax_variance' | 'rate_surge' | 'missing_po';
  details?: string;
  varianceAmount?: number;
  currency?: string;
  severity?: 'low' | 'medium' | 'high';
  matchedPO?: {
    poNumber: string;
    vendorName: string;
    authorizedAmount: number;
    currency: string;
    shippingAllowed: boolean;
    shippingLimit?: number;
  };
  poAmount?: number;
  invoiceAmount?: number;
  exceptionApplicable?: boolean;
}

export interface InvoiceLineItem {
  itemNumber?: number;
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: 'exact_file' | 'same_invoice_different_file';
  reason?: string;
  originalRequestId?: string;
  originalRefCode?: string;
  originalDate?: string;
  originalAmount?: number;
  matchType?: 'file_hash' | 'invoice_number' | 'amount_date_vendor' | string;
  existingRecord?: RequestItem;
}

export interface RequestItem {
  id: string;
  invoice_record_id?: string;
  user_id: string;
  ref_code: string;
  title: string;
  category: string;
  amount: number;
  currency: string;
  applicant_name: string;
  vendor?: string;
  notes?: string;
  external_url?: string;
  status: 'pending' | 'analyzing' | 'approved' | 'rejected' | 'flagged' | 'changes_requested';
  agent_decision?: string;
  agent_rationale?: string;
  recalled_memory_json?: string;
  recalled_memories?: MemoryItem[];
  invoice_number?: string;
  invoice_date?: string;
  pdf_hash?: string;
  pdf_filename?: string;
  raw_extracted_text?: string;
  is_duplicate?: number;
  duplicate_of_ref?: string;
  learned_insights_json?: string;
  learned_insights?: string[];
  new_learning?: string[];
  learning_generated?: string[];
  po_number?: string;
  po_amount?: number;
  discrepancy_detected?: number;
  discrepancy_type?: string;
  discrepancy_details?: string;
  discrepancy_amount?: number;
  human_decision?: string;
  human_comment?: string;
  exception_granted?: string;
  audit_trail_json?: string;
  audit_trail?: AuditStepRecord[];
  amount_label?: string;
  extraction_method?: string;
  formatted_amount?: string;
  confidence?: number;
  line_items_json?: string;
  line_items?: InvoiceLineItem[];
  tax_amount?: number;
  tax?: number;
  taxes?: number;
  discount_amount?: number;
  discount?: number;
  discounts?: number;
  shipping_amount?: number;
  shipping?: number;
  validation_status?: string;
  created_at: string;
  updated_at: string;
}

export interface ParsedInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  currency: string;
  formattedAmount?: string;
  amountLabel?: string;
  extractionMethod?: 'text' | 'table' | 'visual' | 'calculated' | string;
  confidence?: number;
  validationStatus?: 'validated' | 'requires_review' | any;
  applicantName: string;
  category: string;
  title: string;
  notes: string;
  paymentTerms?: string;
  lineItemsSummary?: string;
  lineItems?: InvoiceLineItem[];
  remittanceInfo?: string;
  poNumber?: string;
  poAmount?: number;
  shippingAmount?: number;
  taxAmount?: number;
  discountAmount?: number;
  subtotalAmount?: number;
  learnedInsights?: string[];
  newLearnings?: {
    general: string;
    vendor: string;
    invoice: string;
  };
  pdfHash: string;
  rawText: string;
  amountCandidates?: Array<{
    amount: number;
    currency: string;
    label: string;
    confidence: number;
    rawText: string;
    pageNumber: number;
  }>;
  selectedAmountCandidate?: {
    amount: number;
    currency: string;
    label: string;
    confidence: number;
    pageNumber: number;
    extractionMethod: 'text_exact' | 'table_parser' | 'visual_fallback' | string;
  };
}

export interface PolicyItem {
  id: string;
  user_id: string;
  instruction: string;
  category: string;
  hindsight_status: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  user_id?: string;
  request_id?: string;
  eventType: string;
  description: string;
  createdAt: string;
}

export interface AgentStep {
  requestId: string;
  step: string;
  label: string;
  details?: any;
  timestamp: string;
}

export interface VendorMemoryProfile {
  vendorName: string;
  invoicesCount: number;
  amountRange: {
    min: number;
    max: number;
    avg: number;
    total: number;
    currency: string;
  };
  paymentTerms: string;
  previousDiscrepancies: string[];
  previousExceptions: string[];
  previousDecisions: {
    approved: number;
    rejected: number;
    flagged: number;
    corrected: number;
  };
  learnedPatterns: string[];
  recentMemories: MemoryItem[];
}

export interface MemoryActivityItem {
  id: string;
  date: string;
  vendor: string;
  event: string;
  content: string;
  memoryType: string;
  humanDecision?: string;
  exceptionNote?: string;
  sourceInvoice?: string;
  learningScope?: string;
  whyRelevant?: string;
}

export interface LearningMetrics {
  apOverview: {
    totalInvoices: number;
    approvedInvoices: number;
    rejectedInvoices: number;
    flaggedInvoices: number;
    totalDiscrepancies: number;
    humanCorrections: number;
    memoriesCreated: number;
    memoriesRecalled: number;
  };
  learningMetrics: {
    experiencesRemembered: number;
    influencedRecommendations: number;
    humanCorrectionsRetained: number;
    memoryInfluenceRate: number;
  };
}

export interface HumanFeedbackPayload {
  decision: 'approved' | 'rejected' | 'corrected' | 'flagged';
  comment?: string;
  exceptionGranted?: boolean;
  correctedRecommendation?: string;
}

export interface SampleInvoiceItem {
  id: string;
  name: string;
  invoiceNumber: string;
  invoiceDate: string;
  applicantName: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  pdf_base64: string;
}

export interface SystemStatus {
  status: string;
  hindsight: {
    mode: 'cloud' | 'local';
    cloudConfigured: boolean;
    cloudReachable: boolean;
    baseUrl: string;
    bankId: string;
    totalMemories: number;
  };
  groq: {
    configured: boolean;
    model: string;
  };
  database: {
    type: string;
    connected: boolean;
  };
  metrics: {
    totalRequests: number;
    approvedCount: number;
    flaggedCount: number;
  };
}
