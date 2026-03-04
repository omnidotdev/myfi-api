import type { AccountTemplate } from "./index";

// LLC template is similar to sole proprietor but with member equity instead of owner's equity
const llcTemplate: AccountTemplate[] = [
  {
    name: "Assets",
    code: "1000",
    type: "asset",
    isPlaceholder: true,
    children: [
      {
        name: "Operating Account",
        code: "1010",
        type: "asset",
        subType: "bank",
      },
      {
        name: "Savings Account",
        code: "1020",
        type: "asset",
        subType: "bank",
      },
      {
        name: "Accounts Receivable",
        code: "1100",
        type: "asset",
        subType: "accounts_receivable",
      },
      {
        name: "Inventory",
        code: "1200",
        type: "asset",
        subType: "inventory",
      },
      {
        name: "Crypto",
        code: "1300",
        type: "asset",
        isPlaceholder: true,
        children: [
          {
            name: "Bitcoin",
            code: "1310",
            type: "asset",
            subType: "crypto_wallet",
          },
          {
            name: "Ethereum",
            code: "1320",
            type: "asset",
            subType: "crypto_wallet",
          },
          {
            name: "Other Crypto",
            code: "1390",
            type: "asset",
            subType: "crypto_wallet",
          },
        ],
      },
      {
        name: "Equipment",
        code: "1400",
        type: "asset",
        subType: "fixed_asset",
      },
      {
        name: "Other Assets",
        code: "1900",
        type: "asset",
        subType: "other_asset",
      },
    ],
  },
  {
    name: "Liabilities",
    code: "2000",
    type: "liability",
    isPlaceholder: true,
    children: [
      {
        name: "Accounts Payable",
        code: "2010",
        type: "liability",
        subType: "accounts_payable",
      },
      {
        name: "Credit Cards",
        code: "2020",
        type: "liability",
        subType: "credit_card",
      },
      {
        name: "Business Loan",
        code: "2030",
        type: "liability",
        subType: "loan",
      },
      {
        name: "Line of Credit",
        code: "2040",
        type: "liability",
        subType: "loan",
      },
      {
        name: "Tax Payable",
        code: "2050",
        type: "liability",
        subType: "other_liability",
      },
    ],
  },
  {
    name: "Equity",
    code: "3000",
    type: "equity",
    isPlaceholder: true,
    children: [
      {
        name: "Member Contributions",
        code: "3010",
        type: "equity",
        subType: "owners_equity",
      },
      {
        name: "Member Distributions",
        code: "3020",
        type: "equity",
        subType: "other_equity",
      },
      {
        name: "Retained Earnings",
        code: "3030",
        type: "equity",
        subType: "retained_earnings",
      },
    ],
  },
  {
    name: "Revenue",
    code: "4000",
    type: "revenue",
    isPlaceholder: true,
    children: [
      {
        name: "Sales Revenue",
        code: "4010",
        type: "revenue",
        subType: "sales",
      },
      {
        name: "Service Revenue",
        code: "4020",
        type: "revenue",
        subType: "service_revenue",
      },
      {
        name: "Interest Income",
        code: "4030",
        type: "revenue",
        subType: "interest_income",
      },
      {
        name: "Crypto Gains",
        code: "4040",
        type: "revenue",
        subType: "crypto_gains",
      },
      {
        name: "Other Revenue",
        code: "4090",
        type: "revenue",
        subType: "other_revenue",
      },
    ],
  },
  {
    name: "Expenses",
    code: "5000",
    type: "expense",
    isPlaceholder: true,
    children: [
      {
        name: "Cost of Goods Sold",
        code: "5010",
        type: "expense",
        subType: "cost_of_goods",
      },
      {
        name: "Advertising & Marketing",
        code: "5020",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Office Supplies",
        code: "5030",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Software & Tools",
        code: "5040",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Professional Services",
        code: "5050",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Travel",
        code: "5060",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Meals & Entertainment",
        code: "5070",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Insurance",
        code: "5080",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Rent & Lease",
        code: "5090",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Utilities",
        code: "5100",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Payroll",
        code: "5110",
        type: "expense",
        subType: "payroll",
      },
      {
        name: "Payroll Taxes",
        code: "5120",
        type: "expense",
        subType: "payroll",
      },
      {
        name: "Benefits",
        code: "5130",
        type: "expense",
        subType: "payroll",
      },
      {
        name: "Crypto Losses",
        code: "5140",
        type: "expense",
        subType: "crypto_losses",
      },
      {
        name: "Taxes & Licenses",
        code: "5200",
        type: "expense",
        subType: "tax_expense",
      },
      {
        name: "Depreciation",
        code: "5300",
        type: "expense",
        subType: "other_expense",
      },
      {
        name: "Bank Fees",
        code: "5400",
        type: "expense",
        subType: "other_expense",
      },
      {
        name: "Other Expenses",
        code: "5900",
        type: "expense",
        subType: "other_expense",
      },
    ],
  },
];

export default llcTemplate;
