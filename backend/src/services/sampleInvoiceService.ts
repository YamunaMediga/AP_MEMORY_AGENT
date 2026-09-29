import fs from 'fs';
import path from 'path';

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

export const sampleInvoices = {
  // DEMO STEP 1: First Interaction (Before Memory - Agent Flags Shipping Discrepancy)
  abcSuppliersInvoiceA: {
    id: 'sample_abc_a',
    name: 'Invoice_ABC_Suppliers_105000_Discrepancy.pdf',
    invoiceNumber: 'INV-ABC-1042',
    invoiceDate: '2026-09-28',
    applicantName: 'ABC Suppliers',
    amount: 105000,
    currency: 'USD',
    category: 'Supplies',
    poNumber: 'PO-8841',
    poAmount: 100000,
    shippingAmount: 5000,
    description: 'PO #PO-8841 for $100,000 + unapproved $5,000 shipping charge. First interaction: Demonstrates agent flagging discrepancy when no memory exists.',
    getPdfBuffer(): Buffer {
      return createSimplePdf([
        'COMMERCIAL INVOICE',
        '-------------------------------------------------------',
        'Vendor: ABC Suppliers',
        'Invoice Number: INV-ABC-1042',
        'Date of Transmission: 2026-09-28',
        'Purchase Order #: PO-8841',
        'Payment Terms: Net-30',
        'Category: Supplies',
        '-------------------------------------------------------',
        'Item: Industrial Machine Spares & Assemblies (100 units)',
        'PO Base Subtotal: USD 100,000.00',
        'Shipping & Handling: USD 5,000.00',
        'Tax: USD 0.00',
        '-------------------------------------------------------',
        'Total Amount Due: USD 105,000.00',
        '-------------------------------------------------------',
        'Remit payment to: ABC Suppliers Bank ACH #48920194',
        'Notice: Shipping charges calculated separately from PO.',
      ]);
    },
  },

  // DEMO STEP 2: Second Interaction (After Memory - Agent Recalls Prior Approval)
  abcSuppliersInvoiceB: {
    id: 'sample_abc_b',
    name: 'Invoice_ABC_Suppliers_84000_With_Memory.pdf',
    invoiceNumber: 'INV-ABC-1099',
    invoiceDate: '2026-10-05',
    applicantName: 'ABC Suppliers',
    amount: 84000,
    currency: 'USD',
    category: 'Supplies',
    poNumber: 'PO-8899',
    poAmount: 80000,
    shippingAmount: 4000,
    description: 'PO #PO-8899 for $80,000 + $4,000 shipping charge. Second interaction: Demonstrates agent recalling prior human approval of shipping charges and recommending approval!',
    getPdfBuffer(): Buffer {
      return createSimplePdf([
        'COMMERCIAL INVOICE',
        '-------------------------------------------------------',
        'Vendor: ABC Suppliers',
        'Invoice Number: INV-ABC-1099',
        'Date of Transmission: 2026-10-05',
        'Purchase Order #: PO-8899',
        'Payment Terms: Net-30',
        'Category: Supplies',
        '-------------------------------------------------------',
        'Item: Replacement Valves & Bearings (40 units)',
        'PO Base Subtotal: USD 80,000.00',
        'Shipping & Handling: USD 4,000.00',
        'Tax: USD 0.00',
        '-------------------------------------------------------',
        'Total Amount Due: USD 84,000.00',
        '-------------------------------------------------------',
        'Remit payment to: ABC Suppliers Bank ACH #48920194',
      ]);
    },
  },

  softwareInvoice: {
    id: 'sample_software',
    name: 'Invoice_NeuralCode_AI_7500.pdf',
    invoiceNumber: 'INV-2026-881',
    invoiceDate: '2026-09-28',
    applicantName: 'NeuralCode Systems Inc.',
    amount: 7500,
    currency: 'USD',
    category: 'Software',
    poNumber: 'PO-7500',
    poAmount: 7500,
    shippingAmount: 0,
    description: 'Enterprise AI Developer Suite Annual License for 15 engineers. Terms: Net-30.',
    getPdfBuffer(): Buffer {
      return createSimplePdf([
        'COMMERCIAL INVOICE',
        '-------------------------------------------------------',
        'Issuer / Vendor: NeuralCode Systems Inc.',
        'Invoice Number: INV-2026-881',
        'Date of Transmission: 2026-09-28',
        'Purchase Order #: PO-7500',
        'Payment Terms: Net-30',
        'Category: Software',
        'Description: Enterprise AI Developer Suite License (15 Seats)',
        '-------------------------------------------------------',
        'Subtotal: $7,500.00 USD',
        'Tax: $0.00 USD',
        'Total Amount Due: $7,500.00 USD',
        '-------------------------------------------------------',
        'Remit payment to: NeuralCode Treasury ACH #98421094',
      ]);
    },
  },

  hardwareInvoice: {
    id: 'sample_hardware',
    name: 'Invoice_ViewTech_Monitors_1200.pdf',
    invoiceNumber: 'INV-2026-302',
    invoiceDate: '2026-09-28',
    applicantName: 'ViewTech Displays LLC',
    amount: 1200,
    currency: 'USD',
    category: 'Hardware',
    poNumber: 'PO-1200',
    poAmount: 1200,
    shippingAmount: 0,
    description: 'Ergonomic 4K UltraHD Monitors for engineering workstations.',
    getPdfBuffer(): Buffer {
      return createSimplePdf([
        'PURCHASE INVOICE',
        '-------------------------------------------------------',
        'Vendor: ViewTech Displays LLC',
        'Invoice #: INV-2026-302',
        'Date of Transmission: 2026-09-28',
        'Purchase Order #: PO-1200',
        'Category: Hardware',
        'Line Items: 2x 32-inch 4K Ergonomic Workstation Displays',
        'Unit Price: $600.00',
        '-------------------------------------------------------',
        'Invoice Total: $1,200.00 USD',
        'Payment Terms: Due upon receipt',
        '-------------------------------------------------------',
        'Shipment Tracking: FEDEX-98210398',
      ]);
    },
  },

  duplicateInvoice: {
    id: 'sample_duplicate',
    name: 'Invoice_Duplicate_Submission_Test.pdf',
    invoiceNumber: 'INV-2026-881',
    invoiceDate: '2026-09-28',
    applicantName: 'NeuralCode Systems Inc.',
    amount: 7500,
    currency: 'USD',
    category: 'Software',
    poNumber: 'PO-7500',
    poAmount: 7500,
    shippingAmount: 0,
    description: 'Duplicate submission of INV-2026-881 to test AP deduplication engine.',
    getPdfBuffer(): Buffer {
      return sampleInvoices.softwareInvoice.getPdfBuffer();
    },
  },
};
