using bp.cust as cust from '../db/schema';

@path: '/service/bpcust'
service BusinessPartnerService {
    entity BusinessPartners as projection on cust.BusinessPartners;

    @readonly entity VH_Grouping as projection on cust.VH_Grouping;
    @readonly entity VH_Country as projection on cust.VH_Country;
    @readonly entity VH_Language as projection on cust.VH_Language;
    @readonly entity VH_MobileCountryCode as projection on cust.VH_MobileCountryCode;
    @readonly entity VH_TaxCategory as projection on cust.VH_TaxCategory;
    @readonly entity VH_SalesOrganization as projection on cust.VH_SalesOrganization;
    @readonly entity VH_DistributionChannel as projection on cust.VH_DistributionChannel;
    @readonly entity VH_Division as projection on cust.VH_Division;
    @readonly entity VH_CustomerGroup as projection on cust.VH_CustomerGroup;
    @readonly entity VH_AccountAssignmentGroup as projection on cust.VH_AccountAssignmentGroup;
    @readonly entity VH_TaxClassification as projection on cust.VH_TaxClassification;
    @readonly entity VH_CustomerData2 as projection on cust.VH_CustomerData2;
    @readonly entity VH_CompanyCode as projection on cust.VH_CompanyCode;
    @readonly entity VH_ReconciliationAccount as projection on cust.VH_ReconciliationAccount;

    @readonly entity VH_Region as projection on cust.VH_Region;

    entity Users as projection on cust.Users;
    entity AccessRequests as projection on cust.AccessRequests;

    action sendOTP(mobileNumber: String) returns String;
    action verifyOTP(mobileNumber: String, otp: String) returns Boolean;
}
