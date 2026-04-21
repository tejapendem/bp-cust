const fs = require('fs');

const data = {
  'bp.cust-VH_Grouping.csv': "code;name\nZP01;Domestic Customers\nZP05;Export Customers",
  'bp.cust-VH_Country.csv': "code;name\nUG;Uganda\nUY;Uruguay\nIN;India\nUS;United States",
  'bp.cust-VH_Language.csv': "code;name\nEN;English\nFR;French\nSW;Swahili",
  'bp.cust-VH_MobileCountryCode.csv': "code;name\n+91;India\n+256;Uganda\n+1;USA",
  'bp.cust-VH_TaxCategory.csv': "code;name\nKE_PASS;Kenya Passport ID\nKR_CORP;South Korea Corporate ID\nVAT_REG;VAT Registration Number\nMX_VAT;Mexico VAT Liability\nMY_GST;Malaysia GST Number\nNL_VAT;Netherlands VAT Registration\nNO_VAT;Norway VAT\nPH_TAX;Philippines Taxpayer ID\nPL_NIP;Poland NIP Number\nPT_VAT;Portugal VAT Registration\nRU_INN;Russia INN\nSE_VAT;Sweden VAT Registration\nSI_ORG;Slovenia Organization Registration\nSK_ICO;Slovakia ICO Number\nTH_ID;Thailand Personal ID\nUG_ID;Uganda National ID\nUG_TAX;Uganda Income Tax Registration No\nUG_PASS;Uganda Passport Number\nUS_SSN;USA Social Security Number\nVE_RIF;Venezuela RIF Number",
  'bp.cust-VH_SalesOrganization.csv': "code;name\n1000;Roofings Limited\n2000;Roofings Limited (Export)",
  'bp.cust-VH_DistributionChannel.csv': "code;name\n01;Domestic\n40;Export",
  'bp.cust-VH_Division.csv': "code;name\n10;Common Division",
  'bp.cust-VH_CustomerGroup.csv': "code;name\n10;Corporate\n20;Dealer / Wholesale\n30;Individual\n40;Retail\n50;Export Others\n55;Export Kenya\n56;Export Tanzania\n60;Sales / Transfer\n70;Internal Customer\n90;Legal Case",
  'bp.cust-VH_AccountAssignmentGroup.csv': "code;name\n01;Domestic Customers\n02;Export Customers",
  'bp.cust-VH_TaxClassification.csv': "code;name\n0;Tax Exempt\n1;Liable for Taxes\n2;Exempted Taxes",
  'bp.cust-VH_CustomerData2.csv': "code;name\n02;Other than Govt.",
  'bp.cust-VH_CompanyCode.csv': "code;name\n1000;1000\n2000;2000",
  'bp.cust-VH_ReconciliationAccount.csv': "code;name\n321000;Trade Debtors (Domestic)\n321001;Trade Debtors (Export)"
};

for (const [file, content] of Object.entries(data)) {
  fs.writeFileSync(`backend/db/data/${file}`, content);
}
console.log('CSV files generated successfully.');
