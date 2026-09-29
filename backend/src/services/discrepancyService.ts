export interface DiscrepancyResult {
  hasDiscrepancy: boolean;
  type: 'shipping_unmatched' | 'po_amount_variance' | 'tax_variance' | 'rate_surge' | 'terms_deviation' | 'missing_po' | 'none';
  title: string;
  amount: number;
  currency: string;
  details: string;
  poNumber?: string;
  poAmount?: number;
  shippingAmount?: number;
}

const KNOWN_PURCHASE_ORDERS: Record<string, { poNumber: string; vendor: string; amount: number; shippingAllowed: boolean }> = {
  'PO-8841': { poNumber: 'PO-8841', vendor: 'ABC Suppliers', amount: 100000, shippingAllowed: false },
  'PO-8899': { poNumber: 'PO-8899', vendor: 'ABC Suppliers', amount: 80000, shippingAllowed: false },
  'PO-7500': { poNumber: 'PO-7500', vendor: 'NeuralCode Systems Inc.', amount: 7500, shippingAllowed: true },
};

class DiscrepancyService {
  /**
   * Evaluates invoice parameters against purchase orders and vendor patterns
   */
  public detectDiscrepancies(params: {
    amount: number;
    currency: string;
    rawText?: string;
    notes?: string;
    applicantName: string;
    poNumber?: string;
    poAmount?: number;
  }): DiscrepancyResult {
    const { amount, currency, rawText = '', notes = '', applicantName } = params;
    const combined = `${rawText} ${notes}`;

    // 1. Extract PO Number & PO Amount if not explicitly passed
    let poNumber = params.poNumber;
    let poAmount = params.poAmount;

    if (!poNumber) {
      const poMatch = combined.match(/(?:Purchase\s*Order|PO|P\.O\.)\s*(?:#|No|Number)?\s*[:.-]?\s*([A-Za-z0-9-_]{3,20})/i);
      if (poMatch && poMatch[1] && !/^(?:NUMBER|DATE|TERMS|AMOUNT)$/i.test(poMatch[1])) {
        poNumber = poMatch[1].trim();
      }
    }

    // Lookup known PO baseline
    if (poNumber) {
      const upper = poNumber.toUpperCase();
      const known = KNOWN_PURCHASE_ORDERS[upper] || Object.values(KNOWN_PURCHASE_ORDERS).find(p => upper.includes(p.poNumber));
      if (known && (poAmount === undefined || poAmount === null || poAmount <= 0)) {
        poAmount = known.amount;
      }
    }

    if (poAmount === undefined || poAmount === null || poAmount <= 0) {
      const poAmtMatch = combined.match(/(?:PO\s*Amount|PO\s*Total|Authorized\s*PO|PO\s*Base(?:\s*Subtotal)?|Base\s*Subtotal)\s*[:.-]?\s*(?:[A-Za-z]{3}|[$₹€£])?\s*([\d,]+\.?\d*)/i);
      if (poAmtMatch && poAmtMatch[1]) {
        poAmount = parseFloat(poAmtMatch[1].replace(/,/g, ''));
      }
    }

    // 2. Extract Shipping / Freight Charges
    let shippingAmount = 0;
    const shipMatch = combined.match(/(?:Shipping(?:\s*&\s*Handling)?|Freight|Delivery\s*Fee|Postage)\s*[:.-]?\s*(?:[A-Za-z]{3}|[$₹€£])?\s*([\d,]+\.?\d*)/i);
    if (shipMatch && shipMatch[1]) {
      shippingAmount = parseFloat(shipMatch[1].replace(/,/g, ''));
    }

    // 3. Evaluate Discrepancies
    // A. Shipping charge discrepancy against PO
    if (poNumber && poAmount !== undefined && poAmount > 0) {
      const diff = Math.round((amount - poAmount) * 100) / 100;
      if (diff > 0) {
        if (shippingAmount > 0 && Math.abs(diff - shippingAmount) < 2) {
          return {
            hasDiscrepancy: true,
            type: 'shipping_unmatched',
            title: `Shipping Fee Discrepancy (${currency} ${Number(diff || 0).toLocaleString()})`,
            amount: diff,
            currency,
            details: `Invoice total (${currency} ${Number(amount || 0).toLocaleString()}) exceeds Purchase Order #${poNumber} (${currency} ${Number(poAmount || 0).toLocaleString()}) due to an unapproved shipping charge of ${currency} ${Number(shippingAmount || 0).toLocaleString()}.`,
            poNumber,
            poAmount,
            shippingAmount,
          };
        } else {
          return {
            hasDiscrepancy: true,
            type: 'po_amount_variance',
            title: `PO Amount Variance (${currency} ${Number(diff || 0).toLocaleString()})`,
            amount: diff,
            currency,
            details: `Invoice total of ${currency} ${Number(amount || 0).toLocaleString()} exceeds authorized PO #${poNumber} (${currency} ${Number(poAmount || 0).toLocaleString()}) by ${currency} ${Number(diff || 0).toLocaleString()}.`,
            poNumber,
            poAmount,
          };
        }
      }
    }

    // B. Shipping charge present without PO amendment
    if (shippingAmount > 0 && shippingAmount >= 50) {
      return {
        hasDiscrepancy: true,
        type: 'shipping_unmatched',
        title: `Unapproved Shipping Charge (${currency} ${Number(shippingAmount || 0).toLocaleString()})`,
        amount: shippingAmount,
        currency,
        details: `Invoice includes ${currency} ${Number(shippingAmount || 0).toLocaleString()} shipping charge that was not authorized in procurement baseline.`,
        poNumber,
        poAmount,
        shippingAmount,
      };
    }

    // C. Missing PO for significant amount (> $1,500 / ₹50,000)
    if (!poNumber && amount > 1500) {
      return {
        hasDiscrepancy: true,
        type: 'missing_po',
        title: 'Missing Purchase Order',
        amount: 0,
        currency,
        details: `No Purchase Order (PO) reference detected for invoice exceeding standard non-PO authorization threshold.`,
      };
    }

    // No discrepancy detected
    return {
      hasDiscrepancy: false,
      type: 'none',
      title: 'No Discrepancies Detected',
      amount: 0,
      currency,
      details: poNumber 
        ? `Invoice matches authorized Purchase Order #${poNumber} (${currency} ${Number(poAmount || amount || 0).toLocaleString()}) with zero variance.`
        : 'Invoice complies with standard procurement thresholds.',
      poNumber,
      poAmount,
      shippingAmount,
    };
  }
}

export const discrepancyService = new DiscrepancyService();
