using bp.cust as cust from '../db/schema';

@path: '/service/bpcust'
service BusinessPartnerService {
    entity BusinessPartners as projection on cust.BusinessPartners;

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

    entity VH_Region as projection on cust.VH_Region;

    entity Users as projection on cust.Users;
    entity AccessRequests as projection on cust.AccessRequests;

    action sendOTP(mobileNumber: String) returns String;
    action verifyOTP(mobileNumber: String, otp: String) returns Boolean;

    function getUserInfo() returns {
        email: String;
        name: String;
        role: String;
        isAdmin: Boolean;
    };

    function getAdminStats() returns {
        activeBPs: Integer;
        draftBPs: Integer;
        totalAdmins: Integer;
        totalViewers: Integer;
        pendingRequests: Integer;
    };
}
