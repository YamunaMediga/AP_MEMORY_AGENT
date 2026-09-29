# Accounts Payable AI Agent That Learns Using Hindsight

The **Accounts Payable AI Agent** is a production-grade system demonstrating **“AI Agents That Learn Using Hindsight.”** Rather than operating as a rigid, static rule engine, the agent retains memories from previous invoice reviews, detects discrepancy patterns, absorbs human review decisions and exceptions, and recalls past precedents to autonomously approve subsequent invoices.

---

## 1. Core Architectural Pillars

### A. PDF Invoice Amount & Line-Item Extraction
- **Complete PDF Inspection**: Inspects raw PDF streams, extracted text, table structures, and visual layouts.
- **Line Items & Financial Breakdown**: Parses structured line items (`description`, `quantity`, `unitPrice`, `amount`), taxes, discounts, and freight/shipping charges.
- **Label Hierarchy Prioritization**:
  $$\text{Amount Due / Total Due / Balance Due (Priority 1)} \succ \text{Grand Total / Invoice Total (Priority 2)} \succ \text{Total Payable (Priority 3)} \succ \text{Total (Priority 4)} \succ \text{Calculated Subtotal + Charges (Priority 5)}$$
- **Multi-Currency & Code Support**: Parses standard symbols (`$`, `₹`, `€`, `£`) as well as 3-letter ISO currency codes (`USD`, `INR`, `EUR`, `GBP`).
- **Validation Engine**: Performs mathematical validation between line items, subtotal, taxes, shipping, and the total payable.

### B. Enterprise Discrepancy Engine ([`discrepancyService.ts`](file:///c:/Users/yamun/OneDrive/Desktop/AP-memory-agent/backend/src/services/discrepancyService.ts))
- **Automated PO Matching**: Matches invoices against Purchase Order baselines (e.g. PO #PO-8841 for $100,000, PO #PO-8899 for $80,000).
- **Discrepancy Categorization**:
  - `shipping_unmatched`: Detects unapproved shipping or freight charges not authorized on the PO.
  - `po_amount_variance`: Detects baseline PO price mismatches.
  - `tax_variance`: Detects miscalculated sales tax or VAT.
  - `missing_po`: Detects large invoices missing a purchase order authorization.

### C. Continuous Memory Retention & Hindsight Recall ([`hindsightService.ts`](file:///c:/Users/yamun/OneDrive/Desktop/AP-memory-agent/backend/src/services/hindsightService.ts))
- **Additive Persistent Memory Bank**: Every processed invoice and human review writes rich structured memory records to SQLite (`memory_records`) and Hindsight Cloud API:
  - `vendor_name`, `invoice_ref`, `discrepancy_type`, `human_decision`, `exception_note`, `why_relevant`, `learning_scope`.
- **Intelligent Recall**:
  - Recalls past human approvals and exceptions for the specific vendor and discrepancy type.
  - Generates plain-English finance rationale: *"Finance confirmed shipping charges are permitted for ABC Suppliers."*

### D. 8-Step Visual Lifecycle Audit Trail ([`agentService.ts`](file:///c:/Users/yamun/OneDrive/Desktop/AP-memory-agent/backend/src/services/agentService.ts))
Every invoice is processed through 8 distinct, auditable checkpoints streamed in real-time over Server-Sent Events (SSE):
1. **Invoice received & registered**: Ingestion, ref-code assignment, deduplication check.
2. **Hindsight pre-recall**: Pre-checks prior vendor memories and precedents before extraction.
3. **Multimodal / PDF Data Extracted**: Extracts monetary amounts, candidate ranking, and confidence.
4. **Validation completed**: Mathematical validation of line items, subtotal, taxes, and shipping.
5. **Discrepancy engine check**: Purchase order matching, variance calculation, and shipping verification.
6. **Recalling relevant Hindsight memories**: Searches persistent bank for human decisions, exceptions, and pricing benchmarks.
7. **Agent AP decision & recommendation generated**: Generates plain-English reasoning citing exact past memories.
8. **Learning retained to Hindsight**: Retains new vendor knowledge, benchmarks, and reviewer exceptions.

---

## 2. Fast Real-Time Processing Pipeline

The invoice extraction and validation engine is optimized for high-speed, sub-second execution without sacrificing accuracy:

### A. Single-Pass PDF Text & Structure Extraction
- **No line-by-line loops**: Replaced line-by-line processing loops with single-pass PDF stream parsing using `unpdf`.
- **No redundant AI calls**: Extracts line items, taxes, shipping, vendor, transmission date, and monetary candidate hierarchy in a single synchronous pass rather than making separate LLM calls per field.
- **Visual fallback only when necessary**: Text extraction executes first with a strict 3.5s timeout. Visual/OCR inspection is only triggered if text extraction yields fewer than 20 characters.

### B. Immediate Pre-Extraction Deduplication (< 2ms)
- SHA-256 fingerprint is calculated immediately upon upload in `POST /api/requests/parse-pdf`.
- The database is checked **before** launching any PDF parsing or candidate analysis. If an identical file was already processed, it responds immediately without invoking parsers.

### C. In-Memory SHA-256 Caching
- In-memory cache in [`pdfService.ts`](file:///c:/Users/yamun/OneDrive/Desktop/AP-memory-agent/backend/src/services/pdfService.ts) caches parsed results by file hash for 15 minutes, delivering 0ms response times for repeat client requests.

### D. Asynchronous / Non-Blocking Hindsight Learning
- Invoice records are persisted to SQLite immediately and emitted to the UI via SSE.
- Memory retention to Hindsight Cloud API is offloaded to a non-blocking `setImmediate` queue running concurrently via `Promise.allSettled()`, ensuring users never wait on external network latency.

### E. Strict Timeout Protection
- PDF parsing: 3,500ms timeout guard with fallback.
- Groq LLM inference: 2,500ms race timeout, falling back seamlessly to deterministic rules.
- Hindsight Cloud retention/recall: 1,500ms timeout guard to ensure cloud latency never hangs the AP pipeline.

### F. Informative Real-Time Progress Checklist & Retry
- Both [`NewRequestModal.tsx`](file:///c:/Users/yamun/OneDrive/Desktop/AP-memory-agent/frontend/src/components/NewRequestModal.tsx) and [`InteractiveDemoView.tsx`](file:///c:/Users/yamun/OneDrive/Desktop/AP-memory-agent/frontend/src/components/InteractiveDemoView.tsx) provide a dynamic, multi-stage progress checklist:
  - `Uploading PDF ✓`
  - `Checking duplicate ✓`
  - `Reading invoice ✓`
  - `Extracting invoice data ✓`
  - `Validating total ✓`
  - `Completed ✓` (or `Saving invoice...`)
- Equipped with client-side timeout guards and an interactive **"Retry"** button in case of network disruptions.

---

## 3. Strict Runtime Deduplication & Isolated Invoice Records

### A. SHA-256 Exact File Deduplication
- When an identical PDF is uploaded again:
  - The system computes the SHA-256 hash directly from the file buffer.
  - **No duplicate record is inserted** into SQLite.
  - **No duplicate agent processing or learning** is written to Hindsight.
  - Returns immediate response:
    ```json
    {
      "status": "duplicate",
      "duplicate": true,
      "duplicate_type": "exact_file",
      "invoice_record_id": "req_...",
      "message": "This invoice file has already been processed.",
      "data": { ... }
    }
    ```
  - In the UI, a duplicate banner is rendered with a 1-click **"View Existing Invoice Record"** action button.

### B. Content-Level Deduplication Across Files
- Catches double-billing when a duplicate invoice is submitted with a different filename or hash:
  - Matches `LOWER(applicant_name) + LOWER(invoice_number)` OR `LOWER(applicant_name) + invoice_date + amount`.
  - Flags the request with `duplicate_type: "same_invoice_different_file"`.

### C. Distinct Invoices from the Same Vendor
- Invoices with distinct numbers or amounts (e.g., `INV-1001` vs `INV-1002`) are processed as independent records with unique `invoice_record_id`s.

### D. Isolated Detail View (`GET /api/invoice/:invoice_record_id`)
- Fully isolated component: [`InvoiceDetailModal.tsx`](file:///c:/Users/yamun/OneDrive/Desktop/AP-memory-agent/frontend/src/components/InvoiceDetailModal.tsx).
- Fetches strictly from `GET /api/invoice/:id`.
- Zero reliance on global `latestInvoice` or shared mutable state.
- Presents:
  - Unique `invoice_record_id`, Ref Code, and Status.
  - Vendor, Invoice #, Transmission Date, and Total Amount Payable.
  - Full Line Items table (Item #, Description, Qty, Unit Price, Amount).
  - Financial breakdown (Taxes, Shipping/Freight, Discounts, Total).
  - Extraction Method & Confidence score.
  - Retained Hindsight continuous learnings for this invoice.
  - Recalled memory precedents.
  - Complete 8-step lifecycle audit trail.

---

## 4. Before-Memory vs. After-Memory Demonstration

The system includes a dedicated, interactive walkthrough demonstrating how memory eliminates repetitive human reviews:

```
[ Step 1: Invoice A ]
ABC Suppliers submits $105,000 ($100,000 PO #PO-8841 + $5,000 Shipping)
Agent: ⚠️ FLAGGED FOR REVIEW (No prior exception in Hindsight)
      ↓
Human Reviewer: APPROVES & GRANTS EXCEPTION ("Shipping charges authorized per logistics agreement")
      ↓
Memory Retained into Hindsight: vendor='ABC Suppliers', discrepancy='shipping_unmatched', decision='approved'
      ↓
[ Step 2: Invoice B ]
ABC Suppliers later submits $84,000 ($80,000 PO #PO-8899 + $4,000 Shipping)
Agent: Recalls prior human decision from Invoice A!
Agent: ✅ RECOMMENDED APPROVAL CITING MEMORY!
Rationale: "Approved based on previous human precedent: Shipping charges permitted for ABC Suppliers."
```

### Side-by-Side Comparison

| Dimension | Step 1: Before Memory (Invoice A) | Step 2: After Memory (Invoice B) |
| :--- | :--- | :--- |
| **Vendor** | ABC Suppliers | ABC Suppliers |
| **Invoice Amount** | $105,000.00 | $84,000.00 |
| **Discrepancy** | +$5,000 unlisted shipping fee | +$4,000 unlisted shipping fee |
| **Agent Decision** | **⚠️ FLAGGED FOR REVIEW** | **✅ RECOMMENDED APPROVAL** |
| **Agent Rationale** | *"No relevant previous experience was found to authorize this discrepancy. Recommending review..."* | *"I found a previous invoice from ABC Suppliers with a similar shipping discrepancy. The finance team approved it because shipping charges were allowed for this vendor..."* |
| **Memories Recalled** | 0 relevant approval precedents | 4 memories including prior human exception |
| **Human Touch Required?** | **Yes (Manual review & exception)** | **No (Zero-touch automated approval)** |

---

## 5. Verification & Automated Test Results

The strict deduplication and isolation suite passes all 5 enterprise benchmarks:

```
=================================================================
  STRICT DEDUPLICATION & ISOLATED INVOICE RECORD VERIFICATION   
=================================================================

✓ Step 1: Authenticated successfully as: Hackathon Reviewer (judge@hackathon.ai)
✓ Initial invoice records in database: 32

--- TEST 1: INGEST UNIQUE INVOICE FROM REAL PDF ---
Extracted fields from PDF:
  Invoice #: INV-TEST-674010
  Date: 2026-10-18
  Amount: $18500 USD
  Vendor: Apex Cloud Services 674010
  Line items count: 2
  SHA-256: 0ab6b5ba1c52842b90cfefad793efa5221967336422a9ca8db5fe1add5c77399
Submission 1 Response:
  Status: processed
  Duplicate flag: false
  Invoice Record ID: req_3428f1b0-d924-4e00-96a9-f51cfd4af2c2
✓ TEST 1 PASSED: New invoice created with unique ID: req_3428f1b0-d924-4e00-96a9-f51cfd4af2c2

--- TEST 2: RE-UPLOAD EXACT SAME FILE (SHA-256 DEDUPLICATION) ---
Duplicate check during PDF preview:
  isDuplicate: true
  duplicateType: exact_file
  originalRequestId: req_3428f1b0-d924-4e00-96a9-f51cfd4af2c2
Submission 2 Response:
  Status: duplicate
  Duplicate flag: true
  Duplicate Type: exact_file
  Returned Record ID: req_3428f1b0-d924-4e00-96a9-f51cfd4af2c2
  Message: This invoice file has already been processed.
✓ TEST 2 PASSED: Exact duplicate file was rejected from insertion and returned existing record!

--- TEST 3: CONTENT-LEVEL DEDUPLICATION (DIFFERENT FILE, SAME INVOICE #) ---
Submission 3 Response:
  Status: duplicate
  Duplicate flag: true
  Duplicate Type: same_invoice_different_file
  Returned Record ID: req_3428f1b0-d924-4e00-96a9-f51cfd4af2c2
✓ TEST 3 PASSED: Cross-file duplicate content correctly blocked!

--- TEST 4: DISTINCT NEW INVOICE FROM SAME VENDOR ---
Submission 4 Response:
  Status: processed
  Duplicate flag: false
  New Invoice Record ID: req_2b93127e-6ed8-4564-85ed-70dba89dc427
✓ TEST 4 PASSED: Distinct invoice from same vendor created independent record ID: req_2b93127e-6ed8-4564-85ed-70dba89dc427

--- TEST 5: ISOLATED INVOICE RECORD RETRIEVAL (GET /api/invoice/:id) ---
Record 1 Isolated Data:
  ID: req_3428f1b0-d924-4e00-96a9-f51cfd4af2c2
  Invoice #: INV-TEST-674010
  Amount: 18500
  Vendor: Apex Cloud Services 674010
Record 4 Isolated Data:
  ID: req_2b93127e-6ed8-4564-85ed-70dba89dc427
  Invoice #: INV-DISTINCT-674011
  Amount: 7200
  Vendor: Apex Cloud Services 674010
✓ TEST 5 PASSED: Both invoices return strictly isolated records from GET /api/invoice/:id!

=================================================================
    ✓ ALL 5 STRICT DEDUPLICATION & ISOLATION BENCHMARKS PASSED!   
=================================================================
```

---

## 6. How to Try It in the Application

1. Open your browser to **`http://localhost:5173`**.
2. Log in using the **"⚡ 1-Click Hackathon Reviewer Demo Login"** button.
3. **Try Runtime PDF Ingestion & Deduplication**:
   - In **Invoices & Pipeline**, click **`+ Ingest Invoice PDF`**.
   - Select or drag a PDF (or click one of the 1-click test samples).
   - Notice the extracted invoice metadata, line items, and SHA-256 fingerprint.
   - If the exact same file is uploaded again:
     - Notice the alert: *"Exact File Duplicate Detected (SHA-256 Match)"*.
     - Click **`View Existing Record`** to open its isolated detail modal.
4. **Try Isolated Detail View**:
   - Click the **`View Invoice`** button on any invoice in the pipeline.
   - The modal displays strictly that invoice's line items, financial breakdown, extracted confidence, and 8-step lifecycle audit trail.
5. **Try the Before/After Learning Demo**:
   - Click the **`⚡ Before/After Demo`** tab in the top navigation bar.
   - Click **`📄 Process Invoice A ($105,000 with $5,000 Shipping)`**.
   - Notice the agent flags the unapproved $5,000 shipping charge because no prior memory exists.
   - In the **Finance Reviewer Intervention** box, click **`✓ Approve & Grant Shipping Exception`**.
   - Watch the exception get retained into Hindsight memory.
   - Now click **`🧠 Process Invoice B ($84,000 with Learned Memory)`**.
   - Notice the agent **automatically approves** Invoice B, citing the human approval precedent from Invoice A!
6. Click **`📊 AP Dashboard`** to see the updated *Experiences Remembered* and *Influenced Recommendations* metrics.
7. Click **`🏢 Vendor Profiles`** to explore the synthesized profile for ABC Suppliers.
8. Click **`🧠 Memory Activity Log`** to view the chronological log of all retained precedents.
9. Click **`↺ Reset Demo State`** anytime to reset and run the demonstration again.
