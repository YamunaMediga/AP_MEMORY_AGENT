import { User, RequestItem, PolicyItem, MemoryItem, SystemStatus, ParsedInvoice, DuplicateCheckResult, InvoiceLineItem } from './types.js';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('ap_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('ap_token', res.token);
    return res;
  },

  async register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    localStorage.setItem('ap_token', res.token);
    return res;
  },

  async quickLogin(): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/auth/quick-login', {
      method: 'POST',
    });
    localStorage.setItem('ap_token', res.token);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/auth/me');
  },

  logout() {
    localStorage.removeItem('ap_token');
  },

  // Requests
  async getRequests(): Promise<{ requests: RequestItem[] }> {
    return request<{ requests: RequestItem[] }>('/requests');
  },

  async parsePdf(data: {
    pdf_base64?: string;
    filename?: string;
    text_content?: string;
  }): Promise<{
    parsed: ParsedInvoice;
    duplicateCheck: DuplicateCheckResult;
  }> {
    return request('/requests/parse-pdf', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getSampleInvoices(): Promise<{
    samples: Array<{
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
    }>;
  }> {
    return request('/requests/sample-invoices');
  },

  async createRequest(data: {
    title: string;
    category: string;
    amount: number;
    currency: string;
    applicant_name: string;
    notes?: string;
    external_url?: string;
    invoice_number?: string;
    invoice_date?: string;
    pdf_hash?: string;
    pdf_filename?: string;
    raw_extracted_text?: string;
    learned_insights?: string[];
    line_items?: InvoiceLineItem[];
    amount_label?: string;
    extraction_method?: string;
    formatted_amount?: string;
    confidence?: number;
    tax_amount?: number;
    discount_amount?: number;
    shipping_amount?: number;
    validation_status?: string;
  }): Promise<{
    status?: 'processed' | 'duplicate';
    duplicate?: boolean;
    duplicate_type?: 'exact_file' | 'same_invoice_different_file';
    invoice_record_id: string;
    existing_invoice_record_id?: string;
    message?: string;
    request: RequestItem;
    data?: RequestItem;
  }> {
    return request('/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getRequest(id: string): Promise<{ request: RequestItem }> {
    return request<{ request: RequestItem }>(`/requests/${id}`);
  },

  async getInvoice(id: string): Promise<{
    invoice_record_id: string;
    invoice_number?: string;
    vendor: string;
    invoice_date?: string;
    currency: string;
    invoice_total: number;
    formatted_amount: string;
    amount_label: string;
    line_items: InvoiceLineItem[];
    tax: number;
    discount: number;
    shipping: number;
    status: string;
    extraction_method: string;
    confidence: number;
    validation_status: string;
    new_learning: string[];
    audit_trail: any[];
    recalled_memories: any[];
    invoice: RequestItem;
    request: RequestItem;
    data: RequestItem;
  }> {
    return request(`/invoice/${id}`);
  },

  async reEvaluateRequest(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/requests/${id}/re-evaluate`, {
      method: 'POST',
    });
  },

  async manualAction(id: string, action: 'approved' | 'rejected' | 'flagged'): Promise<{ request: RequestItem }> {
    return request<{ request: RequestItem }>(`/requests/${id}/manual-action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  async recordHumanFeedback(
    id: string,
    payload: {
      decision: 'approved' | 'rejected' | 'corrected' | 'flagged';
      comment?: string;
      exceptionGranted?: boolean;
      correctedRecommendation?: string;
    }
  ): Promise<{ success: boolean; request: RequestItem; memoryContent: string }> {
    return request<{ success: boolean; request: RequestItem; memoryContent: string }>(
      `/requests/${id}/human-feedback`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async getVendorProfiles(): Promise<{ profiles: any[] }> {
    return request<{ profiles: any[] }>('/requests/vendors');
  },

  async getMemoryActivity(): Promise<{ activities: any[] }> {
    return request<{ activities: any[] }>('/requests/memory-activity');
  },

  async getLearningMetrics(): Promise<any> {
    return request<any>('/requests/learning-metrics');
  },

  async demoReset(): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>('/requests/demo-reset', {
      method: 'POST',
    });
  },

  async deleteRequest(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/requests/${id}`, {
      method: 'DELETE',
    });
  },

  // Policies (Hindsight memory retention)
  async getPolicies(): Promise<{ policies: PolicyItem[] }> {
    return request<{ policies: PolicyItem[] }>('/policies');
  },

  async createPolicy(instruction: string, category: string): Promise<{ policy: PolicyItem; memoryMode: string }> {
    return request<{ policy: PolicyItem; memoryMode: string }>('/policies', {
      method: 'POST',
      body: JSON.stringify({ instruction, category }),
    });
  },

  async getMemories(): Promise<{ memories: MemoryItem[] }> {
    return request<{ memories: MemoryItem[] }>('/policies/memories');
  },

  async reflectMemories(prompt?: string): Promise<{ reflection: string }> {
    return request<{ reflection: string }>('/policies/reflect', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },

  // Agent Chat
  async chatWithAgent(message: string): Promise<{ message: string; recalledMemories: MemoryItem[]; timestamp: string }> {
    return request<{ message: string; recalledMemories: MemoryItem[]; timestamp: string }>('/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  // System & Config
  async getSystemStatus(): Promise<SystemStatus> {
    return request<SystemStatus>('/config/status');
  },

  async updateApiKeys(data: { groqApiKey?: string; hindsightApiKey?: string }): Promise<any> {
    return request('/config/update-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getRecentActivity(): Promise<{ events: any[] }> {
    return request<{ events: any[] }>('/config/activity');
  },
};
