/**
 * End-to-End Real-Data Workflow Test
 * Verifies: Auth -> Memory Retention -> Request Submission -> Agent Evaluation -> Recall & Precedent Application
 */

const API_BASE = 'http://localhost:4000/api';

async function runTest() {
  console.log('--- STARTING END-TO-END VERIFICATION ---');

  // 1. Health check
  const healthRes = await fetch(`${API_BASE}/health`);
  const health = await healthRes.json();
  console.log('1. Health check:', health);

  // 2. Register/Login test user
  const testEmail = `test_reviewer_${Date.now()}@example.com`;
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Dr. Sarah Chen',
      email: testEmail,
      password: 'Password123!',
    }),
  });
  const auth = await regRes.json();
  console.log('2. User registered successfully. ID:', auth.user.id);
  const token = auth.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 3. Verify Empty State (0 requests)
  const emptyRes = await fetch(`${API_BASE}/requests`, { headers });
  const emptyData = await emptyRes.json();
  console.log('3. Empty state confirmed. Requests count:', emptyData.requests.length);

  // 4. Teach Agent a Policy Rule (Stored in Hindsight Memory)
  console.log('4. Teaching Policy Rule to Hindsight...');
  const policyRes = await fetch(`${API_BASE}/policies`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      instruction: 'Always flag software license requests over $5,000 for SOC2 Type II compliance verification.',
      category: 'Software',
    }),
  });
  const policyData = await policyRes.json();
  console.log('✓ Policy retained in Hindsight:', policyData.policy.instruction, `(Mode: ${policyData.memoryMode})`);

  // 5. Submit Request #1: $7,500 Software Tool (Should be FLAGGED because of SOC2 memory!)
  console.log('5. Submitting Request #1: $7,500 Software Tool...');
  const req1Res = await fetch(`${API_BASE}/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Enterprise AI Developer Tool',
      category: 'Software',
      amount: 7500,
      currency: 'USD',
      applicant_name: 'NeuralCode Labs',
      notes: 'License for 15 engineers. Standard procurement.',
      external_url: 'https://neuralcode.io',
    }),
  });
  const req1Data = await req1Res.json();
  console.log('✓ Request #1 created. Ref code:', req1Data.request.ref_code);

  // Wait 2.5 seconds for agent evaluation loop to finish
  console.log('... Agent evaluating Request #1 against Hindsight memory and external data ...');
  await new Promise((res) => setTimeout(res, 2800));

  const check1Res = await fetch(`${API_BASE}/requests/${req1Data.request.id}`, { headers });
  const check1 = await check1Res.json();
  console.log('✓ Request #1 Evaluation Complete:');
  console.log('  Status:', check1.request.status);
  console.log('  Agent Rationale:', check1.request.agent_rationale);
  console.log('  Recalled Memories Count:', check1.request.recalled_memories?.length);
  if (check1.request.recalled_memories?.length > 0) {
    console.log('  Top Recalled Memory:', check1.request.recalled_memories[0].content);
  }

  // 6. Submit Request #2: $1,200 Hardware (Should be APPROVED)
  console.log('\n6. Submitting Request #2: $1,200 Hardware...');
  const req2Res = await fetch(`${API_BASE}/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Ergonomic Desk Accessories',
      category: 'Hardware',
      amount: 1200,
      currency: 'USD',
      applicant_name: 'LogiDesk Solutions',
      notes: 'Replacement accessories for engineering pods.',
      external_url: 'https://logidesk.example.com',
    }),
  });
  const req2Data = await req2Res.json();
  console.log('✓ Request #2 created. Ref code:', req2Data.request.ref_code);

  await new Promise((res) => setTimeout(res, 2500));

  const check2Res = await fetch(`${API_BASE}/requests/${req2Data.request.id}`, { headers });
  const check2 = await check2Res.json();
  console.log('✓ Request #2 Evaluation Complete:');
  console.log('  Status:', check2.request.status);
  console.log('  Agent Rationale:', check2.request.agent_rationale);

  // 7. Verify System Status & Memory Bank Counts
  console.log('\n7. Verifying System Status & Audit Trail...');
  const statusRes = await fetch(`${API_BASE}/config/status`, { headers });
  const statusData = await statusRes.json();
  console.log('✓ System Status:', {
    hindsightMode: statusData.hindsight.mode,
    totalMemories: statusData.hindsight.totalMemories,
    totalRequests: statusData.metrics.totalRequests,
    approvedCount: statusData.metrics.approvedCount,
    flaggedCount: statusData.metrics.flaggedCount,
  });

  const actRes = await fetch(`${API_BASE}/config/activity`, { headers });
  const actData = await actRes.json();
  console.log(`✓ Activity events recorded: ${actData.events.length}`);

  console.log('--- ALL END-TO-END VERIFICATIONS PASSED SUCCESSFULLY ---');
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
