import { describe, expect, test } from "bun:test";

import { calculateSchedule } from "./calculateSchedule";

describe("calculateSchedule", () => {
  test("generates correct number of entries", () => {
    const schedule = calculateSchedule({
      principal: 12000,
      annualRate: 6,
      termMonths: 12,
      startDate: "2026-01-15",
      paymentDay: 15,
    });
    expect(schedule).toHaveLength(12);
  });

  test("first entry has correct date", () => {
    const schedule = calculateSchedule({
      principal: 12000,
      annualRate: 6,
      termMonths: 12,
      startDate: "2026-01-15",
      paymentDay: 15,
    });
    expect(schedule[0].dueDate).toBe("2026-02-15");
  });

  test("last entry balance is zero or near zero", () => {
    const schedule = calculateSchedule({
      principal: 12000,
      annualRate: 6,
      termMonths: 12,
      startDate: "2026-01-15",
      paymentDay: 15,
    });
    const last = schedule[schedule.length - 1];
    expect(Math.abs(last.balanceAfter)).toBeLessThan(0.01);
  });

  test("total interest plus principal equals total payments", () => {
    const schedule = calculateSchedule({
      principal: 120000,
      annualRate: 5.25,
      termMonths: 360,
      startDate: "2026-01-01",
      paymentDay: 1,
    });
    const totalPrincipal = schedule.reduce((s, e) => s + e.principalAmount, 0);
    const totalInterest = schedule.reduce((s, e) => s + e.interestAmount, 0);
    const totalPayments = schedule.reduce((s, e) => s + e.paymentAmount, 0);
    expect(
      Math.abs(totalPrincipal + totalInterest - totalPayments),
    ).toBeLessThan(0.01);
    expect(Math.abs(totalPrincipal - 120000)).toBeLessThan(0.02);
  });

  test("handles extra principal", () => {
    const schedule = calculateSchedule({
      principal: 12000,
      annualRate: 6,
      termMonths: 12,
      startDate: "2026-01-15",
      paymentDay: 15,
      extraPrincipal: 100,
    });
    expect(schedule.length).toBeLessThan(12);
    const last = schedule[schedule.length - 1];
    expect(Math.abs(last.balanceAfter)).toBeLessThan(0.01);
  });

  test("handles custom payment amount", () => {
    const schedule = calculateSchedule({
      principal: 12000,
      annualRate: 6,
      termMonths: 12,
      startDate: "2026-01-15",
      paymentDay: 15,
      paymentAmount: 1200,
    });
    expect(schedule[0].paymentAmount).toBe(1200);
  });

  test("handles zero interest rate", () => {
    const schedule = calculateSchedule({
      principal: 12000,
      annualRate: 0,
      termMonths: 12,
      startDate: "2026-01-01",
      paymentDay: 1,
    });
    expect(schedule).toHaveLength(12);
    expect(schedule[0].interestAmount).toBe(0);
    expect(schedule[0].principalAmount).toBe(1000);
    const last = schedule[schedule.length - 1];
    expect(Math.abs(last.balanceAfter)).toBeLessThan(0.01);
  });
});
