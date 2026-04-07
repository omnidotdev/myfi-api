const BASE_URL = "https://api.gusto.com";

type GustoPayroll = {
  payroll_uuid: string;
  pay_period: { start_date: string; end_date: string };
  check_date: string;
  processed: boolean;
  totals: {
    gross_pay: string;
    net_pay: string;
    employee_taxes: string;
    employer_taxes: string;
    employee_benefits_deductions: string;
    employer_benefits_contributions: string;
  };
};

/**
 * Fetch processed payrolls for a Gusto company.
 * @param accessToken - OAuth bearer token.
 * @param companyId - Gusto company UUID.
 * @param startDate - Optional ISO date to filter payrolls from.
 */
const fetchPayrolls = async (
  accessToken: string,
  companyId: string,
  startDate?: string,
): Promise<GustoPayroll[]> => {
  const url = new URL(`/v1/companies/${companyId}/payrolls`, BASE_URL);
  url.searchParams.set("processed", "true");

  if (startDate) {
    url.searchParams.set("start_date", startDate);
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Gusto API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
};

export { fetchPayrolls };
