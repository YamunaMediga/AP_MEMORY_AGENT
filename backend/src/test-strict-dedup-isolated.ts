/**
 * End-to-End Test: Strict Runtime Invoice Deduplication & Isolated Invoice Records
 */

const API_BASE = 'http://localhost:4000/api';

function createSimplePdf(lines: string[]): Buffer {
  const contentStream = [
    'BT',
    '/F1 12 Tf',
    '50 720 Td',
    '16 TL',
    ...lines.map((line) => `(${line.replace(/[()\\]/g, '')}) Tj T*`),
    'ET',
  ].join('\n');

  const streamLength = Buffer.byteLength(contentStream);

  const pdfParts = [
    '%PDF-1.4\n',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n`,
    `4 0 obj << /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];

  let offset = 0;
  const offsets = [0];
  const body = pdfParts.join('');

  for (const part of pdfParts) {
    offset += Buffer.byteLength(part);
    offsets.push(offset);
  }

  const xrefOffset = offset;
  const xref = [
    'xref\n',
    '0 6\n',
    '0000000000 65535 f \n',
    `${offsets[0].toString().padStart(10, '0')} 00000 n \n`,
    `${offsets[1].toString().padStart(10, '0')} 00000 n \n`,
    `${offsets[2].toString().padStart(10, '0')} 00000 n \n`,
    `${offsets[3].toString().padStart(10, '0')} 00000 n \n`,
    `${offsets[4].toString().padStart(10, '0')} 00000 n \n`,
    'trailer << /Root 1 0 R /Size 6 >>\n',
    'startxref\n',
    `${xrefOffset}\n`,
    '%%EOF',
  ].join('');

  return Buffer.from(body + xref);
}

async function runStrictDedupAndIsolationTest() {
  console.log('=================================================================');
  console.log('  STRICT DEDUPLICATION & ISOLATED INVOICE RECORD VERIFICATION   ');
  console.log('=================================================================\n');

  // 1. Authenticate as reviewer
  const loginRes = await fetch(`${API_BASE}/auth/quick-login`, { method: 'POST' });
  const auth = (await loginRes.json()) as any;
  const token = auth.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('✓ Step 1: Authenticated successfully as:', auth.user.name, `(${auth.user.email})`);

  // Count existing requests before test
  const initialListRes = await fetch(`${API_BASE}/requests`, { headers });
  const initialList = (await initialListRes.json()) as any;
  const initialCount = initialList.requests.length;
  console.log(`✓ Initial invoice records in database: ${initialCount}`);

  // Create a genuine PDF buffer with unique session ID
  const testRunId = Math.floor(100000 + Math.random() * 900000);
  const testInvNumber = `INV-TEST-${testRunId}`;
  const testVendor = `Apex Cloud Services ${testRunId}`;
  const testAmount = 18500.00;
  const testDate = '2026-10-18';
  const testFilename = `Invoice_Apex_${testRunId}.pdf`;

  const pdfBuffer = createSimplePdf([
    'COMMERCIAL TAX INVOICE',
    '-------------------------------------------------------',
    `Vendor: ${testVendor}`,
    `Invoice Number: ${testInvNumber}`,
    `Date of Transmission: ${testDate}`,
    'Payment Terms: Net-30',
    'Category: Cloud Infrastructure',
    '-------------------------------------------------------',
    'Item: High-Performance GPU Cluster Nodes (5 instances)',
    'Subtotal: USD 17,000.00',
    'Tax: USD 1,500.00',
    '-------------------------------------------------------',
    `Amount Due: USD ${testAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    '-------------------------------------------------------',
    'Remit to: Apex Cloud Services Bank ACH #99281726',
  ]);
  const pdfBase64 = pdfBuffer.toString('base64');

  // 2. TEST 1: Ingest unique PDF at runtime
  console.log('\n--- TEST 1: INGEST UNIQUE INVOICE FROM REAL PDF ---');
  const parse1Res = await fetch(`${API_BASE}/requests/parse-pdf`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pdf_base64: pdfBase64,
      filename: testFilename,
    }),
  });
  const parse1 = (await parse1Res.json()) as any;
  console.log('Extracted fields from PDF:');
  console.log('  Invoice #:', parse1.parsed.invoiceNumber);
  console.log('  Date:', parse1.parsed.invoiceDate);
  console.log('  Amount:', `$${parse1.parsed.amount} ${parse1.parsed.currency}`);
  console.log('  Vendor:', parse1.parsed.applicantName);
  console.log('  Line items count:', parse1.parsed.lineItems?.length || 0);
  console.log('  SHA-256:', parse1.parsed.pdfHash);

  // Submit Invoice 1
  const create1Res = await fetch(`${API_BASE}/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: parse1.parsed.title,
      category: parse1.parsed.category,
      amount: parse1.parsed.amount,
      currency: parse1.parsed.currency,
      applicant_name: parse1.parsed.applicantName,
      notes: parse1.parsed.notes,
      invoice_number: parse1.parsed.invoiceNumber,
      invoice_date: parse1.parsed.invoiceDate,
      pdf_hash: parse1.parsed.pdfHash,
      pdf_filename: testFilename,
      raw_extracted_text: parse1.parsed.rawText,
      learned_insights: parse1.parsed.learnedInsights,
      line_items: parse1.parsed.lineItems,
      amount_label: parse1.parsed.amountLabel,
      extraction_method: parse1.parsed.extractionMethod,
      formatted_amount: parse1.parsed.formattedAmount,
      confidence: parse1.parsed.confidence,
      tax_amount: parse1.parsed.taxAmount,
      discount_amount: parse1.parsed.discountAmount,
      shipping_amount: parse1.parsed.shippingAmount,
      validation_status: parse1.parsed.validationStatus,
    }),
  });
  const req1 = (await create1Res.json()) as any;
  console.log('Submission 1 Response:');
  console.log('  Status:', req1.status);
  console.log('  Duplicate flag:', req1.duplicate);
  console.log('  Invoice Record ID:', req1.invoice_record_id);

  if (req1.status !== 'processed' || req1.duplicate !== false || !req1.invoice_record_id) {
    throw new Error('TEST 1 FAILED: Expected new unique invoice record to be processed');
  }

  // Verify list count incremented by 1
  const listAfter1Res = await fetch(`${API_BASE}/requests`, { headers });
  const listAfter1 = (await listAfter1Res.json()) as any;
  if (listAfter1.requests.length !== initialCount + 1) {
    throw new Error(`TEST 1 FAILED: Expected count ${initialCount + 1}, got ${listAfter1.requests.length}`);
  }
  console.log('✓ TEST 1 PASSED: New invoice created with unique ID:', req1.invoice_record_id);

  // Wait 1.5s for agent processing
  await new Promise((r) => setTimeout(r, 1500));

  // 3. TEST 2: EXACT FILE DEDUPLICATION (SHA-256)
  console.log('\n--- TEST 2: RE-UPLOAD EXACT SAME FILE (SHA-256 DEDUPLICATION) ---');
  const parse2Res = await fetch(`${API_BASE}/requests/parse-pdf`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pdf_base64: pdfBase64,
      filename: testFilename,
    }),
  });
  const parse2 = (await parse2Res.json()) as any;
  console.log('Duplicate check during PDF preview:');
  console.log('  isDuplicate:', parse2.duplicateCheck?.isDuplicate);
  console.log('  duplicateType:', parse2.duplicateCheck?.duplicateType);
  console.log('  originalRequestId:', parse2.duplicateCheck?.originalRequestId);

  if (!parse2.duplicateCheck?.isDuplicate || parse2.duplicateCheck?.duplicateType !== 'exact_file') {
    throw new Error('TEST 2 FAILED: Expected exact_file duplicate detection during parse');
  }

  // Attempt to submit the exact same file
  const create2Res = await fetch(`${API_BASE}/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: parse2.parsed.title,
      category: parse2.parsed.category,
      amount: parse2.parsed.amount,
      currency: parse2.parsed.currency,
      applicant_name: parse2.parsed.applicantName,
      notes: parse2.parsed.notes,
      invoice_number: parse2.parsed.invoiceNumber,
      invoice_date: parse2.parsed.invoiceDate,
      pdf_hash: parse2.parsed.pdfHash,
      pdf_filename: testFilename,
      raw_extracted_text: parse2.parsed.rawText,
    }),
  });
  const req2 = (await create2Res.json()) as any;
  console.log('Submission 2 Response:');
  console.log('  Status:', req2.status);
  console.log('  Duplicate flag:', req2.duplicate);
  console.log('  Duplicate Type:', req2.duplicate_type);
  console.log('  Returned Record ID:', req2.invoice_record_id);
  console.log('  Message:', req2.message);

  if (req2.status !== 'duplicate' || req2.duplicate !== true || req2.duplicate_type !== 'exact_file') {
    throw new Error('TEST 2 FAILED: System should return status="duplicate" and duplicate_type="exact_file"');
  }

  if (req2.invoice_record_id !== req1.invoice_record_id) {
    throw new Error(`TEST 2 FAILED: Returned ID ${req2.invoice_record_id} should equal original ID ${req1.invoice_record_id}`);
  }

  // Verify list count did NOT increment
  const listAfter2Res = await fetch(`${API_BASE}/requests`, { headers });
  const listAfter2 = (await listAfter2Res.json()) as any;
  if (listAfter2.requests.length !== initialCount + 1) {
    throw new Error(`TEST 2 FAILED: Exact duplicate file created a new record! Count is ${listAfter2.requests.length}`);
  }
  console.log('✓ TEST 2 PASSED: Exact duplicate file was rejected from insertion and returned existing record!');

  // 4. TEST 3: CONTENT-LEVEL DEDUPLICATION (Same Vendor + Invoice #, different hash)
  console.log('\n--- TEST 3: CONTENT-LEVEL DEDUPLICATION (DIFFERENT FILE, SAME INVOICE #) ---');
  const create3Res = await fetch(`${API_BASE}/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Scanned re-send of Invoice',
      category: 'Cloud Infrastructure',
      amount: testAmount,
      currency: 'USD',
      applicant_name: testVendor,          // Same vendor
      invoice_number: testInvNumber,       // Same invoice #
      invoice_date: testDate,
      pdf_hash: `different_file_hash_${Date.now()}`, // Different file hash!
      pdf_filename: 'scan_copy.pdf',
    }),
  });
  const req3 = (await create3Res.json()) as any;
  console.log('Submission 3 Response:');
  console.log('  Status:', req3.status);
  console.log('  Duplicate flag:', req3.duplicate);
  console.log('  Duplicate Type:', req3.duplicate_type);
  console.log('  Returned Record ID:', req3.invoice_record_id);

  if (req3.status !== 'duplicate' || req3.duplicate_type !== 'same_invoice_different_file') {
    throw new Error('TEST 3 FAILED: Expected duplicate_type="same_invoice_different_file"');
  }
  console.log('✓ TEST 3 PASSED: Cross-file duplicate content correctly blocked!');

  // 5. TEST 4: DISTINCT INVOICE FROM SAME VENDOR (Different invoice # and amount)
  console.log('\n--- TEST 4: DISTINCT NEW INVOICE FROM SAME VENDOR ---');
  const distinctInvoiceNum = `INV-DISTINCT-${testRunId + 1}`;
  const distinctAmount = 7200.00;
  const create4Res = await fetch(`${API_BASE}/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Additional Storage Instances',
      category: 'Cloud Infrastructure',
      amount: distinctAmount,
      currency: 'USD',
      applicant_name: testVendor,         // Same vendor
      invoice_number: distinctInvoiceNum, // Distinct invoice #
      invoice_date: '2026-10-25',
      pdf_hash: `distinct_hash_${Date.now()}`,
      pdf_filename: 'storage_expansion.pdf',
    }),
  });
  const req4 = (await create4Res.json()) as any;
  console.log('Submission 4 Response:');
  console.log('  Status:', req4.status);
  console.log('  Duplicate flag:', req4.duplicate);
  console.log('  New Invoice Record ID:', req4.invoice_record_id);

  if (req4.status !== 'processed' || req4.duplicate !== false) {
    throw new Error('TEST 4 FAILED: Distinct invoice from same vendor should be processed as new record');
  }

  if (req4.invoice_record_id === req1.invoice_record_id) {
    throw new Error('TEST 4 FAILED: Distinct invoice must have a different invoice_record_id');
  }
  console.log('✓ TEST 4 PASSED: Distinct invoice from same vendor created independent record ID:', req4.invoice_record_id);

  // 6. TEST 5: ISOLATED INVOICE RECORD ENDPOINT
  console.log('\n--- TEST 5: ISOLATED INVOICE RECORD RETRIEVAL (GET /api/invoice/:id) ---');
  // Fetch Record 1 isolated
  const inv1Res = await fetch(`${API_BASE}/invoice/${req1.invoice_record_id}`, { headers });
  const inv1 = (await inv1Res.json()) as any;

  // Fetch Record 4 isolated
  const inv4Res = await fetch(`${API_BASE}/invoice/${req4.invoice_record_id}`, { headers });
  const inv4 = (await inv4Res.json()) as any;

  console.log('Record 1 Isolated Data:');
  console.log('  ID:', inv1.invoice_record_id);
  console.log('  Invoice #:', inv1.invoice_number);
  console.log('  Amount:', inv1.invoice_total);
  console.log('  Vendor:', inv1.vendor);

  console.log('Record 4 Isolated Data:');
  console.log('  ID:', inv4.invoice_record_id);
  console.log('  Invoice #:', inv4.invoice_number);
  console.log('  Amount:', inv4.invoice_total);
  console.log('  Vendor:', inv4.vendor);

  if (inv1.invoice_record_id !== req1.invoice_record_id || inv1.invoice_number !== testInvNumber) {
    throw new Error('TEST 5 FAILED: Record 1 returned incorrect or contaminated data');
  }

  if (inv4.invoice_record_id !== req4.invoice_record_id || inv4.invoice_number !== distinctInvoiceNum) {
    throw new Error('TEST 5 FAILED: Record 4 returned incorrect or contaminated data');
  }

  if (inv1.invoice_total === inv4.invoice_total || inv1.invoice_record_id === inv4.invoice_record_id) {
    throw new Error('TEST 5 FAILED: Invoices share state or data contamination!');
  }

  console.log('✓ TEST 5 PASSED: Both invoices return strictly isolated records from GET /api/invoice/:id!');

  console.log('\n=================================================================');
  console.log('    ✓ ALL 5 STRICT DEDUPLICATION & ISOLATION BENCHMARKS PASSED!   ');
  console.log('=================================================================\n');
}

runStrictDedupAndIsolationTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
