/**
 * Delaware Franchise Tax worksheet for domestic corporations.
 *
 * Delaware lets a corporation pay the LESSER of two calculations, so this
 * computes both and recommends the cheaper one (what you would actually file).
 * All figures are whole US dollars, which is how the Division of Corporations
 * assesses the tax.
 */

const AUTHORIZED_SHARES_MINIMUM = 175;
const ASSUMED_PAR_MINIMUM = 400;
const FRANCHISE_TAX_MAXIMUM = 200_000;
const ASSUMED_PAR_RATE_PER_MILLION = 400;
const ANNUAL_REPORT_FEE = 50;

type DelawareFranchiseTaxInput = {
  /** Total shares the certificate of incorporation authorizes. */
  authorizedShares: number;
  /** Shares actually issued and outstanding. */
  issuedShares: number;
  /** Total gross assets (US dollars), per the federal return Schedule L. */
  totalGrossAssets: number;
  /** Stated par value per share (US dollars); 0 for no-par stock. */
  parValuePerShare: number;
};

type DelawareFranchiseTaxResult = {
  authorizedSharesMethod: { tax: number };
  assumedParValueCapitalMethod: {
    assumedParPerShare: number;
    assumedParValueCapital: number;
    tax: number;
  };
  recommendedMethod: "authorized_shares" | "assumed_par_value_capital";
  franchiseTax: number;
  annualReportFee: number;
  totalDue: number;
};

/** Authorized Shares Method: tiered on the number of authorized shares. */
const authorizedSharesTax = (authorizedShares: number): number => {
  if (authorizedShares <= 5000) return AUTHORIZED_SHARES_MINIMUM;
  if (authorizedShares <= 10_000) return 250;
  const additionalBlocks = Math.ceil((authorizedShares - 10_000) / 10_000);
  const tax = 250 + additionalBlocks * 85;
  return Math.min(tax, FRANCHISE_TAX_MAXIMUM);
};

/**
 * Assumed Par Value Capital Method. Assumed par is gross assets divided by
 * issued shares; the effective par per share is the greater of the assumed par
 * and the stated par. Capital is that rate applied to all authorized shares, and
 * the tax is $400 per $1,000,000 of capital (or part thereof).
 */
const assumedParValueCapitalTax = (
  input: DelawareFranchiseTaxInput,
): DelawareFranchiseTaxResult["assumedParValueCapitalMethod"] => {
  const { authorizedShares, issuedShares, totalGrossAssets, parValuePerShare } =
    input;
  const assumedParPerShare =
    issuedShares > 0 ? totalGrossAssets / issuedShares : 0;
  const effectiveParPerShare = Math.max(assumedParPerShare, parValuePerShare);
  const assumedParValueCapital = Math.round(
    effectiveParPerShare * authorizedShares,
  );
  const millions = Math.ceil(assumedParValueCapital / 1_000_000);
  const tax = Math.min(
    Math.max(millions * ASSUMED_PAR_RATE_PER_MILLION, ASSUMED_PAR_MINIMUM),
    FRANCHISE_TAX_MAXIMUM,
  );
  return { assumedParPerShare, assumedParValueCapital, tax };
};

const calculateDelawareFranchiseTax = (
  input: DelawareFranchiseTaxInput,
): DelawareFranchiseTaxResult => {
  const authorizedSharesMethod = {
    tax: authorizedSharesTax(input.authorizedShares),
  };
  const assumedParValueCapitalMethod = assumedParValueCapitalTax(input);

  const recommendedMethod =
    assumedParValueCapitalMethod.tax < authorizedSharesMethod.tax
      ? "assumed_par_value_capital"
      : "authorized_shares";
  const franchiseTax = Math.min(
    authorizedSharesMethod.tax,
    assumedParValueCapitalMethod.tax,
  );

  return {
    authorizedSharesMethod,
    assumedParValueCapitalMethod,
    recommendedMethod,
    franchiseTax,
    annualReportFee: ANNUAL_REPORT_FEE,
    totalDue: franchiseTax + ANNUAL_REPORT_FEE,
  };
};

export default calculateDelawareFranchiseTax;
