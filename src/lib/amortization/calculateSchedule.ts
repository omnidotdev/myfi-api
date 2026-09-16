interface ScheduleInput {
  principal: number;
  annualRate: number;
  termMonths: number;
  startDate: string;
  paymentDay: number;
  paymentAmount?: number | null;
  extraPrincipal?: number;
}

interface ScheduleEntry {
  sequenceNumber: number;
  dueDate: string;
  paymentAmount: number;
  principalAmount: number;
  interestAmount: number;
  extraPrincipal: number;
  balanceAfter: number;
}

/** Standard amortization: M = P * [r(1+r)^n] / [(1+r)^n - 1] */
const calculateMonthlyPayment = (
  principal: number,
  annualRate: number,
  termMonths: number,
): number => {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / termMonths;
  const factor = (1 + r) ** termMonths;
  return (principal * (r * factor)) / (factor - 1);
};

// Generate a full amortization schedule given loan parameters
const calculateSchedule = (input: ScheduleInput): ScheduleEntry[] => {
  const {
    principal,
    annualRate,
    termMonths,
    startDate,
    paymentDay,
    extraPrincipal = 0,
  } = input;

  const monthlyPayment =
    input.paymentAmount ??
    calculateMonthlyPayment(principal, annualRate, termMonths);
  const monthlyRate = annualRate / 100 / 12;

  const schedule: ScheduleEntry[] = [];
  let balance = principal;
  const start = new Date(startDate);

  for (let i = 1; i <= termMonths && balance > 0.005; i++) {
    const dueYear =
      start.getFullYear() + Math.floor((start.getMonth() + i) / 12);
    const dueMonth = (start.getMonth() + i) % 12;
    const dueDate = `${dueYear}-${String(dueMonth + 1).padStart(2, "0")}-${String(paymentDay).padStart(2, "0")}`;

    const interest = Math.round(balance * monthlyRate * 10000) / 10000;
    let principalPortion = monthlyPayment - interest;
    let extra = extraPrincipal;

    if (principalPortion + extra >= balance) {
      principalPortion = balance;
      extra = 0;
      balance = 0;
    } else {
      balance -= principalPortion + extra;
      if (balance < 0) {
        extra += balance;
        balance = 0;
      }
    }

    const actualPayment =
      balance === 0
        ? interest + principalPortion + extra
        : monthlyPayment + extra;

    schedule.push({
      sequenceNumber: i,
      dueDate,
      paymentAmount: Math.round(actualPayment * 10000) / 10000,
      principalAmount: Math.round(principalPortion * 10000) / 10000,
      interestAmount: Math.round(interest * 10000) / 10000,
      extraPrincipal: Math.round(extra * 10000) / 10000,
      balanceAfter: Math.round(balance * 10000) / 10000,
    });

    if (balance <= 0) break;
  }

  return schedule;
};

export { calculateSchedule };
export type { ScheduleEntry, ScheduleInput };
