using bp.cust as cust from '../db/schema';

@path: '/service/bpcust'
service BusinessPartnerService {
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

    entity Users as projection on cust.Users;
    
    entity AccessRequests as projection on cust.AccessRequests;
    entity ApprovalLevels as projection on cust.ApprovalLevels;
    entity ApprovalWorkflows as projection on cust.ApprovalWorkflows;
    entity ApprovalLogs as projection on cust.ApprovalLogs;

    action sendOTP(mobileNumber: String) returns String;
    action verifyOTP(mobileNumber: String, otp: String) returns Boolean;
    action submitForApproval(bpID: UUID) returns String;
    action processApproval(workflowID: UUID, action: String, approverEmail: String) returns String;

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
    };
}

// Secure the main entities
annotate BusinessPartnerService.BusinessPartners with @(restrict: [
    { grant: '*', to: ['admin', 'Admin'] },
    { grant: 'READ', to: ['viewer'] }
]);

annotate BusinessPartnerService.BPSalesAreas with @(restrict: [
    { grant: '*', to: ['admin', 'Admin'] },
    { grant: 'READ', to: ['viewer'] }
]);

annotate BusinessPartnerService.BPCompanyCodes with @(restrict: [
    { grant: '*', to: ['admin', 'Admin'] },
    { grant: 'READ', to: ['viewer'] }
]);

annotate BusinessPartnerService.BPCreditSegments with @(restrict: [
    { grant: '*', to: ['admin', 'Admin'] },
    { grant: 'READ', to: ['viewer'] }
]);

// Secure the User Management and configuration entities
annotate BusinessPartnerService.Users with @(restrict: [
    { grant: '*', to: ['admin', 'Admin'] }
]);

annotate BusinessPartnerService.ApprovalLevels with @(restrict: [
    { grant: '*', to: ['admin', 'Admin'] }
]);

// Explicitly allow CREATE for all authenticated users, and READ for admins/owners
annotate BusinessPartnerService.AccessRequests with @(restrict: [
    { grant: 'CREATE', to: 'authenticated-user' },
    { grant: '*', to: ['admin', 'Admin'] }
]);

// Allow approvers to read items assigned to them
annotate BusinessPartnerService.ApprovalWorkflows with @(restrict: [
    { grant: 'READ', to: ['admin', 'Admin'] },
    { grant: 'READ', where: 'approverEmail = $user' }
]);

annotate BusinessPartnerService.ApprovalLogs with @(restrict: [
    { grant: '*', to: ['admin', 'Admin'] }
]);
