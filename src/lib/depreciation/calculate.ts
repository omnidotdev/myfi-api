import MACRS_RATES from "./macrsRates";

type DepreciationInput = {
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  macrsClass: string | null;
  acquisitionDate: string;
  targetYear: number;
  /** 1-12 */
  targetMonth: number;
};

/** Calculate monthly depreciation for an asset at a given target month */
const calculateMonthlyDepreciation = (input: DepreciationInput): number => {
  const {
    acquisitionCost,
    salvageValue,
    usefulLifeMonths,
    depreciationMethod,
    macrsClass,
    acquisitionDate,
    targetYear,
    targetMonth,
  } = input;

  const [acqYear, acqMonth] = acquisitionDate.split("-").map(Number);

  if (depreciationMethod === "macrs") {
    return calculateMacrs({
      acquisitionCost,
      macrsClass,
      acqYear,
      acqMonth,
      targetYear,
      targetMonth,
    });
  }

  return calculateStraightLine({
    acquisitionCost,
    salvageValue,
    usefulLifeMonths,
    acqYear,
    acqMonth,
    targetYear,
    targetMonth,
  });
};

const calculateStraightLine = (params: {
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  acqYear: number;
  acqMonth: number;
  targetYear: number;
  targetMonth: number;
}): number => {
  const {
    acquisitionCost,
    salvageValue,
    usefulLifeMonths,
    acqYear,
    acqMonth,
    targetYear,
    targetMonth,
  } = params;

  const depreciableAmount = acquisitionCost - salvageValue;

  if (depreciableAmount <= 0) return 0;

  const targetAbsolute = targetYear * 12 + targetMonth;
  const acqAbsolute = acqYear * 12 + acqMonth;

  // Before acquisition
  if (targetAbsolute < acqAbsolute) return 0;

  // After useful life expires
  const monthsElapsed = targetAbsolute - acqAbsolute;

  if (monthsElapsed >= usefulLifeMonths) return 0;

  return depreciableAmount / usefulLifeMonths;
};

const calculateMacrs = (params: {
  acquisitionCost: number;
  macrsClass: string | null;
  acqYear: number;
  acqMonth: number;
  targetYear: number;
  targetMonth: number;
}): number => {
  const {
    acquisitionCost,
    macrsClass,
    acqYear,
    acqMonth,
    targetYear,
    targetMonth,
  } = params;

  if (!macrsClass) return 0;

  const rates = MACRS_RATES[macrsClass];

  if (!rates) return 0;

  const yearIndex = targetYear - acqYear;

  if (yearIndex < 0 || yearIndex >= rates.length) return 0;

  // Before acquisition month in the acquisition year
  const targetAbsolute = targetYear * 12 + targetMonth;
  const acqAbsolute = acqYear * 12 + acqMonth;

  if (targetAbsolute < acqAbsolute) return 0;

  const annual = acquisitionCost * (rates[yearIndex] / 100);

  return annual / 12;
};

export { calculateMonthlyDepreciation };

export type { DepreciationInput };
