import type { AccountTemplate } from "./index";

const personalTemplate: AccountTemplate[] = [
  {
    name: "Assets",
    code: "1000",
    type: "asset",
    isPlaceholder: true,
    children: [
      { name: "Checking", code: "1010", type: "asset", subType: "bank" },
      { name: "Savings", code: "1020", type: "asset", subType: "bank" },
      { name: "Cash", code: "1030", type: "asset", subType: "cash" },
      {
        name: "Investments",
        code: "1100",
        type: "asset",
        isPlaceholder: true,
        children: [
          {
            name: "Brokerage",
            code: "1110",
            type: "asset",
            subType: "investment",
          },
          {
            name: "Retirement",
            code: "1120",
            type: "asset",
            subType: "investment",
          },
        ],
      },
      {
        name: "Crypto",
        code: "1200",
        type: "asset",
        isPlaceholder: true,
        children: [
          {
            name: "Bitcoin",
            code: "1210",
            type: "asset",
            subType: "crypto_wallet",
          },
          {
            name: "Ethereum",
            code: "1220",
            type: "asset",
            subType: "crypto_wallet",
          },
          {
            name: "Other Crypto",
            code: "1290",
            type: "asset",
            subType: "crypto_wallet",
          },
        ],
      },
      {
        name: "Real Estate",
        code: "1300",
        type: "asset",
        subType: "fixed_asset",
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
        name: "Credit Cards",
        code: "2010",
        type: "liability",
        subType: "credit_card",
      },
      {
        name: "Student Loans",
        code: "2020",
        type: "liability",
        subType: "loan",
      },
      {
        name: "Mortgage",
        code: "2030",
        type: "liability",
        subType: "mortgage",
      },
      { name: "Auto Loan", code: "2040", type: "liability", subType: "loan" },
    ],
  },
  {
    name: "Equity",
    code: "3000",
    type: "equity",
    isPlaceholder: true,
    children: [
      {
        name: "Net Worth",
        code: "3010",
        type: "equity",
        subType: "owners_equity",
      },
    ],
  },
  {
    name: "Income",
    code: "4000",
    type: "revenue",
    isPlaceholder: true,
    children: [
      {
        name: "Salary",
        code: "4010",
        type: "revenue",
        subType: "service_revenue",
      },
      {
        name: "Freelance Income",
        code: "4020",
        type: "revenue",
        subType: "service_revenue",
      },
      {
        name: "Investment Income",
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
        name: "Other Income",
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
        name: "Housing",
        code: "5010",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Transportation",
        code: "5020",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Food",
        code: "5030",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Utilities",
        code: "5040",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Insurance",
        code: "5050",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Healthcare",
        code: "5060",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Entertainment",
        code: "5070",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Shopping",
        code: "5080",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Subscriptions",
        code: "5090",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Education",
        code: "5100",
        type: "expense",
        subType: "operating_expense",
      },
      {
        name: "Crypto Losses",
        code: "5110",
        type: "expense",
        subType: "crypto_losses",
      },
      {
        name: "Taxes",
        code: "5200",
        type: "expense",
        subType: "tax_expense",
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

export default personalTemplate;
