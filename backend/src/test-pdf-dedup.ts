/**
 * Test PDF Invoice Parsing and Deduplication Detection Engine
 */

const API_BASE = 'http://localhost:4000/api';

async function runPdfDedupTest() {
  console.log('=== STARTING PDF EXTRACTION & DEDUPLICATION TEST ===');

  // 1. Authenticate as demo reviewer
  const loginRes = await fetch(`${API_BASE}/auth/quick-login`, { method: 'POST' });
  const auth = (await loginRes.json()) as any;
  const token = auth.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('1. Authenticated as:', auth.user.name);

  // 2. Fetch Sample Invoices
  const samplesRes = await fetch(`${API_BASE}/requests/sample-invoices`, { headers });
  const samplesData = (await samplesRes.json()) as any;
  console.log(`2. Retrieved ${samplesData.samples.length} sample invoices:`);
  for (const s of samplesData.samples) {
    console.log(`   - ${s.name} (${s.invoiceNumber}, $${s.amount} ${s.category})`);
  }

  const sample1 = samplesData.samples.find((s: any) => s.id === 'sample_software');
  const sample2 = samplesData.samples.find((s: any) => s.id === 'sample_hardware');

  // 3. Test PDF Text & Invoice Extraction on Sample 1
  console.log('\n3. Parsing PDF buffer for Sample 1 (NeuralCode AI License)...');
  const parse1Res = await fetch(`${API_BASE}/requests/parse-pdf`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pdf_base64: sample1.pdf_base64,
      filename: sample1.name,
    }),
  });
  const parse1Data = (await parse1Res.json()) as any;
  console.log('✓ Extracted Invoice Fields from PDF:');
  console.log('  Invoice Number:', parse1Data.parsed.invoiceNumber);
  console.log('  Date of Transmission:', parse1Data.parsed.invoiceDate);
  console.log('  Amount:', `$${parse1Data.parsed.amount} ${parse1Data.parsed.currency}`);
  console.log('  Applicant / Vendor:', parse1Data.parsed.applicantName);
  console.log('  Category:', parse1Data.parsed.category);
  console.log('  Initial Duplicate Status:', parse1Data.duplicateCheck.isDuplicate ? 'DUPLICATE' : 'UNIQUE (Clear)');

  // 4. Submit Request #1
  console.log('\n4. Submitting Request #1 from extracted PDF...');
  const create1Res = await fetch(`${API_BASE}/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: parse1Data.parsed.title,
      category: parse1Data.parsed.category,
      amount: parse1Data.parsed.amount,
      currency: parse1Data.parsed.currency,
      applicant_name: parse1Data.parsed.applicantName,
      notes: parse1Data.parsed.notes,
      invoice_number: parse1Data.parsed.invoiceNumber,
      invoice_date: parse1Data.parsed.invoiceDate,
      pdf_hash: parse1Data.parsed.pdfHash,
      pdf_filename: sample1.name,
      raw_extracted_text: parse1Data.parsed.rawText,
    }),
  });
  const req1 = (await create1Res.json()) as any;
  console.log(`✓ Request #1 created with Ref: ${req1.request.ref_code}`);

  // Wait 1.5s for agent
  await new Promise(r => setTimeout(r, 1800));

  // 5. Test Duplicate Detection by parsing Sample 1 PDF again!
  console.log('\n5. Uploading the EXACT SAME PDF a second time (Duplicate Prevention Test)...');
  const parseDupRes = await fetch(`${API_BASE}/requests/parse-pdf`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pdf_base64: sample1.pdf_base64,
      filename: sample1.name,
    }),
  });
  const parseDupData = (await parseDupRes.json()) as any;
  console.log('✓ Duplicate Detection Evaluation:');
  console.log('  isDuplicate:', parseDupData.duplicateCheck.isDuplicate);
  console.log('  Reason:', parseDupData.duplicateCheck.reason);
  console.log('  Original Ref Code:', parseDupData.duplicateCheck.originalRefCode);
  console.log('  Match Type:', parseDupData.duplicateCheck.matchType);

  if (!parseDupData.duplicateCheck.isDuplicate) {
    throw new Error('FAILED: System should have detected duplicate invoice!');
  }

  // 6. Submit the Duplicate Request to verify Agent blocks it
  console.log('\n6. Submitting the duplicate request to verify Agent Guard...');
  const createDupRes = await fetch(`${API_BASE}/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: parseDupData.parsed.title,
      category: parseDupData.parsed.category,
      amount: parseDupData.parsed.amount,
      currency: parseDupData.parsed.currency,
      applicant_name: parseDupData.parsed.applicantName,
      notes: parseDupData.parsed.notes,
      invoice_number: parseDupData.parsed.invoiceNumber,
      invoice_date: parseDupData.parsed.invoiceDate,
      pdf_hash: parseDupData.parsed.pdfHash,
      pdf_filename: sample1.name,
      raw_extracted_text: parseDupData.parsed.rawText,
    }),
  });
  const reqDup = (await createDupRes.json()) as any;
  console.log(`✓ Duplicate submitted with Ref: ${reqDup.request.ref_code}`);

  await new Promise(r => setTimeout(r, 1800));

  const checkDupRes = await fetch(`${API_BASE}/requests/${reqDup.request.id}`, { headers });
  const checkDup = (await checkDupRes.json()) as any;
  console.log('✓ Duplicate Request Agent Evaluation Result:');
  console.log('  Status:', checkDup.request.status);
  console.log('  is_duplicate:', checkDup.request.is_duplicate);
  console.log('  duplicate_of_ref:', checkDup.request.duplicate_of_ref);
  console.log('  Rationale:', checkDup.request.agent_rationale);

  if (checkDup.request.is_duplicate !== 1) {
    throw new Error('FAILED: Request was not flagged as duplicate in database!');
  }

  // 7. Parse & Submit Sample 2 (Hardware - Unique)
  console.log('\n7. Parsing and submitting Sample 2 (Hardware - Unique)...');
  const parse2Res = await fetch(`${API_BASE}/requests/parse-pdf`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pdf_base64: sample2.pdf_base64,
      filename: sample2.name,
    }),
  });
  const parse2Data = (await parse2Res.json()) as any;
  console.log('  Extracted:', parse2Data.parsed.invoiceNumber, parse2Data.parsed.applicantName, `$${parse2Data.parsed.amount}`);
  console.log('  Duplicate check:', parse2Data.duplicateCheck.isDuplicate ? 'DUPLICATE' : 'UNIQUE (Allowed)');

  console.log('\n=== ALL PDF EXTRACTION & DEDUPLICATION TESTS PASSED SUCCESSFULLY! ===');
}

runPdfDedupTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
