namespace bp.cust;

using { cuid, managed } from '@sap/cds/common';

entity BusinessPartners : cuid, managed {
    BusinessPartnerNumber : String(10);
    SAPBPNumber : String(10);
    
    // Step 1: General Data
    BPRole : String(10) default '000000';
    BusinessPartnerCategory : String(20); // Person, Organization
    BPType : String(20); // Customer, Vendor
    Grouping : String(4); // ZP01, ZP05
    
    // Step 2: Address & Communication
    Name : String(100);
    FirstName : String(50);
    LastName : String(50);
    Title : String(20) default '0003'; // Default '0003' for Company
    SearchTerm1 : String(20);
    SearchTerm2 : String(20);
    StreetAddress : String(200);
    HouseNumber : String(10);
    City : String(40);
    
    // Extended Address Fields
    BuildingCode : String(20);
    Room : String(10);
    Floor : String(10);
    CareOf : String(40);
    Street2 : String(60);
    Street3 : String(60);
    StreetSupplement : String(40);
    Street4 : String(60);
    Street5 : String(60);
    District : String(40);
    DifferentCity : String(40);
    TimeZone : String(10);
    TaxJurisdiction : String(20);
    TransportationZone : String(10);
    StructureGroup : String(10);
    PostalCode : String(20);
    Country : String(2);
    Region : String(3);
    Language : String(2);
    CorrespondenceLanguage : String(2);
    MobileCountryCode : String(5);
    MobileNumber : String(15);
    Telephone : String(15);
    Email : String(100);
    
    // Step 3: Identification
    TaxCategory : String(100);
    TaxNumber : String(50);
    TaxStatus : String(20);

    // Credit Management - Credit Profile
    RiskClass : String(20);
    CheckRule : String(20);
    CreditGroup : String(20);

    // Multi-Entry Compositions
    SalesAreas : Composition of many BPSalesAreas on SalesAreas.parent = $self;
    CompanyCodes : Composition of many BPCompanyCodes on CompanyCodes.parent = $self;
    CreditSegments : Composition of many BPCreditSegments on CreditSegments.parent = $self;

    LifecycleStatus : String(20) default 'active'; // 'active', 'draft'
    HasSalesAreas : Boolean default false;
    SAPBUPAPayload : LargeString;
    SAPCreditPayload : LargeString;
    SAPPushStatus : String(20) default 'Not Pushed'; // 'Not Pushed', 'Pushed', 'Failed'
    SAPPushLogs : LargeString;
}

entity BPSalesAreas : cuid {
    parent : Association to BusinessPartners;
    SalesOrganization : String(4);
    DistributionChannel : String(2);
    Division : String(2);
    
    // Step 5: Sales Data (repeats per Sales Area)
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
}

entity BPCompanyCodes : cuid {
    parent : Association to BusinessPartners;
    CompanyCode : String(4);
    IsBP : Boolean default true;
    IsCustomer : Boolean default true;
    
    // Step 7: Account Management (repeats per Company Code)
    ReconciliationAccount : String(6);
}

entity BPCreditSegments : cuid {
    parent : Association to BusinessPartners;
    CreditSegment : String(10);
    CreditLimitRules : String(20);
    LimitDefined : Boolean default true;
    CreditLimit : Decimal(15,2);
    LimitCurrency : String(3) default 'UGX';
    ValidityDate : Date;
}


// Value Helps
entity VH_Grouping { key code: String(4); name: String(50); isActive: Boolean default true; }
entity VH_Country { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_Language { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_MobileCountryCode { key code: String(5); name: String(50); isActive: Boolean default true; }
entity VH_TaxCategory { key code: String(50); name: String(100); isActive: Boolean default true; }
entity VH_SalesOrganization { key code: String(4); name: String(100); isActive: Boolean default true; }
entity VH_DistributionChannel { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_Division { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_CustomerGroup { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_AccountAssignmentGroup { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_TaxClassification { key code: String(1); name: String(50); isActive: Boolean default true; }
entity VH_CustomerData2 { key code: String(2); name: String(50); isActive: Boolean default true; }
entity VH_CompanyCode { key code: String(4); name: String(100); isActive: Boolean default true; }
entity VH_ReconciliationAccount { key code: String(6); name: String(50); isActive: Boolean default true; }
entity VH_BPType { key code: String(20); name: String(50); isActive: Boolean default true; }
entity VH_BusinessPartnerCategory { key code: String(20); name: String(50); isActive: Boolean default true; }

// New Credit Management VH
entity VH_RiskClass { key code: String(20); name: String(100); isActive: Boolean default true; }
entity VH_CheckRule { key code: String(20); name: String(100); isActive: Boolean default true; }
entity VH_CreditGroup { key code: String(20); name: String(100); isActive: Boolean default true; }
entity VH_CreditSegment { key code: String(10); name: String(100); isActive: Boolean default true; }
entity VH_CreditLimitRule { key code: String(20); name: String(100); isActive: Boolean default true; }

entity VH_Region { 
    key code: String(3); 
    key country: String(2); 
    name: String(50); 
    isActive: Boolean default true;
}

entity VH_Title { key code: String(20); name: String(50); isActive: Boolean default true; }
entity VH_TaxStatus { key code: String(20); name: String(50); isActive: Boolean default true; }

// Customer Info Value Help Tables
entity VH_Currency { key code: String(3); name: String(100); isActive: Boolean default true; }
entity VH_ExchangeRateType { key code: String(4); name: String(100); isActive: Boolean default true; }
entity VH_PricingProcedure { key code: String(2); name: String(100); isActive: Boolean default true; }
entity VH_StatisticsGroup { key code: String(2); name: String(100); isActive: Boolean default true; }
entity VH_PaymentTerms { key code: String(4); name: String(100); isActive: Boolean default true; }
entity VH_Incoterms { key code: String(4); name: String(100); isActive: Boolean default true; }
entity VH_OutputTaxCategory { key code: String(10); name: String(100); isActive: Boolean default true; }

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

entity ApprovalLevels : cuid, managed {
    level     : Integer;
    levelName : String(50);
    username  : String(100);
    email     : String(1000); // JSON array of approver emails: ["a@b.com", "c@d.com"]
}

entity ApprovalWorkflows : cuid, managed {
    businessPartner : Association to BusinessPartners;
    currentLevel    : Integer;
    status          : String(20); // 'pending', 'approved', 'rejected'
    approverEmail   : String(100);
    levelEmails     : LargeString; // JSON snapshot of {level: email} at submission time
    logs            : Composition of many ApprovalLogs on logs.parent = $self;
}

entity ApprovalLogs : cuid, managed {
    parent    : Association to ApprovalWorkflows;
    level     : Integer;
    approver  : String(100);
    action    : String(20); // 'approved', 'rejected', 'commented'
    comment   : String(500);
    timestamp : DateTime;
}

entity SAPPushLogs : cuid, managed {
    businessPartner : Association to BusinessPartners;
    status          : String(20); // 'Pushed', 'Failed'
    logs            : LargeString;
    timestamp       : DateTime;
}
