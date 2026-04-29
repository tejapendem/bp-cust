namespace bp.cust;

using { cuid, managed } from '@sap/cds/common';

entity BusinessPartners : cuid, managed {
    BusinessPartnerNumber : String(10);
    
    // Step 1: General Data
    BPRole : String(10) default '000000';
    BPType : String(20) default 'Organization';
    Grouping : String(4); // ZP01, ZP05
    
    // Step 2: Address & Communication
    Name : String(100);
    Title : String(20);
    StreetAddress : String(200);
    PostalCode : String(20);
    Country : String(2);
    Region : String(3);
    Language : String(2);
    MobileCountryCode : String(5);
    MobileNumber : String(15);
    Telephone : String(15);
    Email : String(100);
    
    // Step 3: Identification
    TaxCategory : String(100);
    TaxNumber : String(50);
    TaxStatus : String(20);
    
    // Step 4: Sales Area (FLCU01)
    SalesOrganization : String(4);
    DistributionChannel : String(2);
    Division : String(2);
    
    // Step 5: Sales Data
    CustomerGroup : String(2);
    Currency : String(3) default 'UGX';
    ExchangeRateType : String(4);
    CustomerPricingProcedure : String(2) default '1';
    CustomerStatsGroup : String(1) default '+';
    
    // Billing Section
    PaymentTerms : String(4) default 'Z001';
    Incoterms : String(4) default 'EXW';
    AccountAssignmentGroup : String(2);
    
    // Tax Classification
    TaxClassification : String(1); // 0, 1, 2
    OutputTaxCountry : String(2) default 'UG';
    OutputTaxCategory : String(4) default 'MWST';
    
    // Additional Data
    CustomerData2 : String(2) default '02';
    
    // Step 6: Company Code Assignment (FLCU00)
    CompanyCode : String(4);
    IsBP : Boolean default true;
    IsCustomer : Boolean default true;
    
    // Step 7: Account Management
    ReconciliationAccount : String(6);
    LifecycleStatus : String(20) default 'active'; // 'active', 'draft'
}

// Value Helps
entity VH_Grouping { key code: String(4); name: String(50); isActive: Boolean default true; }
entity VH_Country { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_Language { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_MobileCountryCode { key code: String(5); name: String(50); isActive: Boolean default true; }
entity VH_TaxCategory { key code: String(50); name: String(100); isActive: Boolean default true; }
entity VH_SalesOrganization { key code: String(4); name: String(50); isActive: Boolean default true; }
entity VH_DistributionChannel { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_Division { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_CustomerGroup { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_AccountAssignmentGroup { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_TaxClassification { key code: String(1); name: String(50); isActive: Boolean default true; }
entity VH_CustomerData2 { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_CompanyCode { key code: String(4); name: String(50); isActive: Boolean default true; }
entity VH_ReconciliationAccount { key code: String(6); name: String(50); isActive: Boolean default true; }


entity VH_Region { 
    key code: String(3); 
    key country: String(2); 
    name: String(50); 
    isActive: Boolean default true;
}

entity Users : managed {
    key email : String(100);
    name      : String(100);
    role      : String(20); // 'admin', 'viewer'
    status    : String(20) default 'active'; // 'active', 'inactive'
}

entity AccessRequests : cuid, managed {
    userEmail     : String(100);
    userName      : String(100);
    requestedRole : String(20);
    reason        : String(500);
    status        : String(20) default 'pending'; // 'pending', 'approved', 'rejected'
}
