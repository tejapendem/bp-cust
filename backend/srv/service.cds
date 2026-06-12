using bp.cust as cust from '../db/schema';

@path: '/service/bpcust'
service BusinessPartnerService {
    @odata.orderby: { createdAt: desc }
    entity BusinessPartners as projection on cust.BusinessPartners;
    entity BPSalesAreas as projection on cust.BPSalesAreas;
    entity BPCompanyCodes as projection on cust.BPCompanyCodes;
    entity BPCreditSegments as projection on cust.BPCreditSegments;

    entity VH_Grouping as projection on cust.VH_Grouping;
    entity VH_Country as projection on cust.VH_Country;
    entity VH_Language as projection on cust.VH_Language;
    entity VH_MobileCountryCode as projection on cust.VH_MobileCountryCode;
    entity VH_TaxCategory as projection on cust.VH_TaxCategory;
    entity VH_SalesOrganization as projection on cust.VH_SalesOrganization;
    entity VH_DistributionChannel as projection on cust.VH_DistributionChannel;
    entity VH_Division as projection on cust.VH_Division;
    entity VH_CustomerGroup as projection on cust.VH_CustomerGroup;
    entity VH_AccountAssignmentGroup as projection on cust.VH_AccountAssignmentGroup;
    entity VH_TaxClassification as projection on cust.VH_TaxClassification;
    entity VH_CustomerData2 as projection on cust.VH_CustomerData2;
    entity VH_CompanyCode as projection on cust.VH_CompanyCode;
    entity VH_ReconciliationAccount as projection on cust.VH_ReconciliationAccount;
    entity VH_BPType as projection on cust.VH_BPType;
    entity VH_BusinessPartnerCategory as projection on cust.VH_BusinessPartnerCategory;

    // Credit Mgt VH
    entity VH_RiskClass as projection on cust.VH_RiskClass;
    entity VH_CheckRule as projection on cust.VH_CheckRule;
    entity VH_CreditGroup as projection on cust.VH_CreditGroup;
    entity VH_CreditSegment as projection on cust.VH_CreditSegment;
    entity VH_CreditLimitRule as projection on cust.VH_CreditLimitRule;

    entity VH_Region as projection on cust.VH_Region;
    entity VH_Title as projection on cust.VH_Title;
    entity VH_TaxStatus as projection on cust.VH_TaxStatus;

    entity VH_Currency as projection on cust.VH_Currency;
    entity VH_ExchangeRateType as projection on cust.VH_ExchangeRateType;
    entity VH_PricingProcedure as projection on cust.VH_PricingProcedure;
    entity VH_StatisticsGroup as projection on cust.VH_StatisticsGroup;
    entity VH_PaymentTerms as projection on cust.VH_PaymentTerms;
    entity VH_Incoterms as projection on cust.VH_Incoterms;
    entity VH_OutputTaxCategory as projection on cust.VH_OutputTaxCategory;

    entity Users as projection on cust.Users;
    
    entity AccessRequests as projection on cust.AccessRequests;
    entity ApprovalLevels as projection on cust.ApprovalLevels;
    entity ApprovalWorkflows as projection on cust.ApprovalWorkflows;
    entity ApprovalLogs as projection on cust.ApprovalLogs;
    entity SAPPushLogs as projection on cust.SAPPushLogs;

    action sendOTP(mobileNumber: String) returns String;
    action verifyOTP(mobileNumber: String, otp: String) returns Boolean;
    action deleteBusinessPartners(bpIDs: array of UUID) returns String;
    action submitForApproval(bpID: UUID) returns String;
    action processApproval(workflowID: UUID, action: String, approverEmail: String) returns String;
    action pushToSAP(bpID: UUID) returns {
        success: Boolean;
        bpNumber: String;
        logs: String;
    };
    action testDestination() returns String;
    action validateVATNumber(taxNumber: String, taxCategory: String) returns {
        isValid: Boolean;
        recordCount: Integer;
        message: String;
        legalName: String;
        businessName: String;
        contactNumber: String;
        contactEmail: String;
        address: String;
    };

    action validateTaxNumber(taxNumber: String, taxCategory: String) returns {
        isDuplicate: Boolean;
        message: String;
        name: String;
        streetHouseNo: String;
        city: String;
        mobile: String;
        registrationField: String;
        registrationValue: String;
        companyCode: String;
    };

    function searchCustomersByName(name: String) returns String;

    @(requires: 'authenticated-user')
    function getUserInfo() returns {
        email: String;
        name: String;
        role: String;
        isAdmin: Boolean;
    };

    @(requires: 'authenticated-user')
    function getAdminStats() returns {
        activeBPs: Integer;
        draftBPs: Integer;
        totalAdmins: Integer;
        totalViewers: Integer;
        pendingRequests: Integer;
        approvalLevelsCount: Integer;
        pendingWorkflows: Integer;
        approvedWorkflows: Integer;
        rejectedWorkflows: Integer;
    };
}

// Secure the main entities
annotate BusinessPartnerService.BusinessPartners with @(restrict: [
    { grant: '*', to: ['admin', 'Admin'] },
    { grant: ['READ', 'CREATE', 'UPDATE'], to: ['viewer', 'Viewer', 'authenticated-user'] }
]);

annotate BusinessPartnerService.BPSalesAreas with @(restrict: [
    { grant: '*', to: ['admin', 'Admin'] },
    { grant: ['READ', 'CREATE', 'UPDATE'], to: ['viewer', 'Viewer', 'authenticated-user'] }
]);

annotate BusinessPartnerService.BPCompanyCodes with @(restrict: [
    { grant: '*', to: ['admin', 'Admin'] },
    { grant: ['READ', 'CREATE', 'UPDATE'], to: ['viewer', 'Viewer', 'authenticated-user'] }
]);

annotate BusinessPartnerService.BPCreditSegments with @(restrict: [
    { grant: '*', to: ['admin', 'Admin'] },
    { grant: ['READ', 'CREATE', 'UPDATE'], to: ['viewer', 'Viewer', 'authenticated-user'] }
]);

// Secure the User Management and configuration entities
annotate BusinessPartnerService.Users with @(restrict: [
    { grant: ['READ'], to: ['admin', 'Admin', 'authenticated-user'] },
    { grant: '*', to: ['admin', 'Admin'] }
]);

annotate BusinessPartnerService.ApprovalLevels with @(restrict: [
    { grant: ['READ'], to: ['admin', 'Admin', 'authenticated-user'] },
    { grant: '*', to: ['admin', 'Admin'] }
]);

// Explicitly allow CREATE for all authenticated users, and READ for admins/owners
annotate BusinessPartnerService.AccessRequests with @(restrict: [
    { grant: 'CREATE', to: 'authenticated-user' },
    { grant: ['READ', 'UPDATE'], to: ['admin', 'Admin', 'authenticated-user'] },
    { grant: '*', to: ['admin', 'Admin'] }
]);

// Allow approvers to read items assigned to them
annotate BusinessPartnerService.ApprovalWorkflows with @(restrict: [
    { grant: 'READ', to: ['admin', 'Admin', 'authenticated-user'] },
    { grant: 'READ', where: 'approverEmail = $user' }
]);

annotate BusinessPartnerService.ApprovalLogs with @(restrict: [
    { grant: ['READ'], to: ['admin', 'Admin', 'authenticated-user'] },
    { grant: '*', to: ['admin', 'Admin'] }
]);
