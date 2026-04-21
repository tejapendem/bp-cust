// sap.ui.define([
//     "sap/ui/core/mvc/Controller",
//     "sap/ui/model/json/JSONModel",
//     "sap/ui/model/Filter",
//     "sap/ui/model/FilterOperator",
//     "sap/m/MessageToast",
//     "sap/m/MessageBox",
//     "sap/m/BusyDialog"
// ], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, BusyDialog) {
//     "use strict";

//     // Step labels aligned to backend schema sections
//     var aStepLabels = [
//         "Step 1 of 7 – General Data",
//         "Step 2 of 7 – Address & Communication",
//         "Step 3 of 7 – Identification (Tax)",
//         "Step 4 of 7 – Sales Area (FLCU01)",
//         "Step 5 of 7 – Sales & Billing",
//         "Step 6 of 7 – Company Code (FLCU00)",
//         "Step 7 of 7 – Account Management"
//     ];

//     return Controller.extend("bp.cust.ui.controller.Wizard", {

//         onInit: function () {
//             // Initialize wizard data model matching backend schema exactly
//             var oViewModel = new JSONModel({
//                 progress: 14.3,
//                 progressText: "14.3%",
//                 stepLabel: aStepLabels[0],
//                 TemplateID: "",

//                 // Step 1: General Data
//                 BPRole: "000000",
//                 BPType: "Organization",
//                 Grouping: "ZP01",

//                 // Step 2: Address & Communication
//                 Name: "",
//                 Title: "",
//                 StreetAddress: "",
//                 PostalCode: "",
//                 Country: "UG",
//                 Region: "",
//                 Language: "EN",
//                 MobileCountryCode: "+256",
//                 MobileNumber: "",
//                 Telephone: "",
//                 Email: "",

//                 // OTP state (not persisted to backend)
//                 otpSent: false,
//                 otpValue: "",
//                 otpVerified: false,
//                 otpStatusText: "",
//                 otpStatusState: "None",

//                 // Step 3: Identification
//                 TaxCategory: "",
//                 TaxNumber: "",
//                 TaxStatus: "",

//                 // Step 4: Sales Area (FLCU01)
//                 SalesOrganization: "1000",
//                 DistributionChannel: "01",
//                 Division: "10",

//                 // Step 5: Sales Data & Billing
//                 CustomerGroup: "10",
//                 Currency: "UGX",
//                 ExchangeRateType: "S",
//                 CustomerPricingProcedure: "1",
//                 CustomerStatsGroup: "+",
//                 PaymentTerms: "Z001",
//                 Incoterms: "EXW",
//                 AccountAssignmentGroup: "01",
//                 TaxClassification: "1",
//                 OutputTaxCountry: "UG",
//                 OutputTaxCategory: "MWST",
//                 CustomerData2: "02",

//                 // Step 6: Company Code (FLCU00)
//                 CompanyCode: "1000",
//                 IsBP: true,
//                 IsCustomer: true,

//                 // Step 7: Account Management
//                 ReconciliationAccount: "321000"
//             });
//             this.getView().setModel(oViewModel, "wizardData");

//             this._oBusyDialog = new BusyDialog({
//                 title: "Processing",
//                 text: "Communicating with backend..."
//             });
//             this.getView().addDependent(this._oBusyDialog);

//             // Attach route
//             this.getOwnerComponent().getRouter()
//                 .getRoute("Wizard")
//                 .attachPatternMatched(this._onObjectMatched, this);
//         },

//         // ─────────────────────────────────────────────
//         // ROUTING
//         // ─────────────────────────────────────────────
//         _onObjectMatched: function (oEvent) {
//             var sBpID = oEvent.getParameter("arguments").bpID;

//             // Reset wizard to step 1
//             var oWizard = this.byId("bpWizard");
//             var oFirstStep = oWizard.getSteps()[0];
//             oWizard.discardProgress(oFirstStep);

//             var oModel = this.getView().getModel("wizardData");
//             this._updateProgress(1);

//             if (!sBpID || sBpID === "create") {
//                 // New BP – reset OTP state
//                 oModel.setProperty("/otpSent", false);
//                 oModel.setProperty("/otpVerified", false);
//                 oModel.setProperty("/otpValue", "");
//                 oModel.setProperty("/TemplateID", "");
//                 return;
//             }

//             // Load existing record
//             oModel.setProperty("/TemplateID", sBpID);
//             this._loadFullData(sBpID);
//         },

//         _loadFullData: function (sBpID) {
//             var oView = this.getView();
//             var oWizardModel = oView.getModel("wizardData");
//             var that = this;

//             oView.bindElement({
//                 path: "/BusinessPartners(" + sBpID + ")",
//                 events: {
//                     dataRequested: function () { that._oBusyDialog.open(); },
//                     dataReceived: function (oData) {
//                         var oReceived = oData.getParameter("data");
//                         if (oReceived) {
//                             oWizardModel.setData(
//                                 Object.assign({}, oWizardModel.getData(), oReceived)
//                             );
//                         }
//                         that._oBusyDialog.close();
//                     }
//                 }
//             });
//         },

//         // ─────────────────────────────────────────────
//         // STEP NAVIGATION
//         // ─────────────────────────────────────────────
//         onNextStep: function () {
//             this.byId("bpWizard").nextStep();
//         },

//         onPrevStep: function () {
//             this.byId("bpWizard").previousStep();
//         },

//         onStepActivate: function (oEvent) {
//             var sStepId = oEvent.getParameter("id");
//             this._updateProgressByStepId(sStepId);
//         },

//         _updateProgressByStepId: function (sStepId) {
//             if (!sStepId) {
//                 sStepId = this.byId("bpWizard").getCurrentStep();
//             }
//             // Extract step number from "step1", "step2", etc.
//             var oMatch = sStepId ? sStepId.match(/step(\d+)$/) : null;
//             if (oMatch) {
//                 this._updateProgress(parseInt(oMatch[1]));
//             }
//         },

//         _updateProgress: function (iStep) {
//             var oModel = this.getView().getModel("wizardData");
//             var iTotalSteps = 7;
//             var fPct = Math.round((iStep / iTotalSteps) * 1000) / 10; // 1 decimal
//             oModel.setProperty("/progress", fPct);
//             oModel.setProperty("/progressText", fPct + "%");
//             oModel.setProperty("/stepLabel", aStepLabels[iStep - 1] || "");
//         },

//         // ─────────────────────────────────────────────
//         // COUNTRY → REGION FILTER
//         // ─────────────────────────────────────────────
//         onCountryChange: function (oEvent) {
//             var sCountryKey = oEvent.getParameter("selectedItem")
//                 ? oEvent.getParameter("selectedItem").getKey()
//                 : "";

//             // Reset Region when country changes
//             var oModel = this.getView().getModel("wizardData");
//             oModel.setProperty("/Region", "");

//             // Apply filter on Region select
//             var oRegionSelect = this.byId("regionSelect");
//             var oBinding = oRegionSelect.getBinding("items");
//             if (oBinding) {
//                 if (sCountryKey) {
//                     oBinding.filter([new Filter("country", FilterOperator.EQ, sCountryKey)]);
//                 } else {
//                     oBinding.filter([]);
//                 }
//             }
//         },

//         // ─────────────────────────────────────────────
//         // SALES ORG → EXCHANGE RATE TYPE (auto-set)
//         // Backend logic: SalesOrg 1000 → 'S', else 'SALE'
//         // ─────────────────────────────────────────────
//         onSalesOrgChange: function (oEvent) {
//             var sKey = oEvent.getParameter("selectedItem")
//                 ? oEvent.getParameter("selectedItem").getKey()
//                 : "";
//             var oModel = this.getView().getModel("wizardData");
//             oModel.setProperty("/ExchangeRateType", sKey === "1000" ? "S" : "SALE");
//         },

//         // ─────────────────────────────────────────────
//         // OTP – Send
//         // Backend action: sendOTP(mobileNumber) returns String
//         // ─────────────────────────────────────────────
//         onSendOTP: function () {
//             var oModel = this.getView().getModel("wizardData");
//             var sMobileCode = oModel.getProperty("/MobileCountryCode") || "";
//             var sMobile = oModel.getProperty("/MobileNumber") || "";

//             if (!sMobile) {
//                 MessageBox.warning("Please enter a mobile number first.");
//                 return;
//             }

//             var sFullNumber = sMobileCode + sMobile;
//             var oODataModel = this.getView().getModel();
//             var that = this;

//             this._oBusyDialog.open();
//             oODataModel.bindContext("/sendOTP(...)").invoke({
//                 mobileNumber: sFullNumber
//             }).then(function () {
//                 that._oBusyDialog.close();
//                 oModel.setProperty("/otpSent", true);
//                 oModel.setProperty("/otpVerified", false);
//                 oModel.setProperty("/otpStatusText", "");
//                 MessageToast.show("OTP sent to " + sFullNumber);
//             }).catch(function (oError) {
//                 that._oBusyDialog.close();
//                 // CAP v4 action binding
//                 var oContext = oODataModel.bindContext("/sendOTP(...)");
//                 oContext.setParameter("mobileNumber", sFullNumber);
//                 oContext.execute().then(function () {
//                     oModel.setProperty("/otpSent", true);
//                     oModel.setProperty("/otpVerified", false);
//                     MessageToast.show("OTP sent to " + sFullNumber);
//                 }).catch(function () {
//                     // Fallback: simulate for dev
//                     oModel.setProperty("/otpSent", true);
//                     oModel.setProperty("/otpVerified", false);
//                     MessageToast.show("[Dev] OTP simulated for " + sFullNumber);
//                 });
//             });
//         },

//         // ─────────────────────────────────────────────
//         // OTP – Verify
//         // Backend action: verifyOTP(mobileNumber, otp) returns Boolean
//         // ─────────────────────────────────────────────
//         onVerifyOTP: function () {
//             var oModel = this.getView().getModel("wizardData");
//             var sMobileCode = oModel.getProperty("/MobileCountryCode") || "";
//             var sMobile = oModel.getProperty("/MobileNumber") || "";
//             var sOtp = oModel.getProperty("/otpValue") || "";
//             var sFullNumber = sMobileCode + sMobile;

//             if (!sOtp) {
//                 MessageBox.warning("Please enter the OTP you received.");
//                 return;
//             }

//             var oODataModel = this.getView().getModel();
//             var that = this;

//             this._oBusyDialog.open();
//             var oContext = oODataModel.bindContext("/verifyOTP(...)");
//             oContext.setParameter("mobileNumber", sFullNumber);
//             oContext.setParameter("otp", sOtp);
//             oContext.execute().then(function () {
//                 var bResult = oContext.getBoundContext().getObject().value;
//                 that._oBusyDialog.close();
//                 if (bResult) {
//                     oModel.setProperty("/otpVerified", true);
//                     oModel.setProperty("/otpStatusText", "✓ Verified");
//                     oModel.setProperty("/otpStatusState", "Success");
//                     MessageToast.show("Mobile number verified successfully!");
//                 } else {
//                     oModel.setProperty("/otpVerified", true);
//                     oModel.setProperty("/otpStatusText", "✗ Invalid OTP");
//                     oModel.setProperty("/otpStatusState", "Error");
//                     MessageBox.error("Invalid OTP. Please re-enter or request a new one.");
//                 }
//             }).catch(function () {
//                 that._oBusyDialog.close();
//                 // Dev fallback
//                 oModel.setProperty("/otpVerified", true);
//                 oModel.setProperty("/otpStatusText", "✓ Verified (dev)");
//                 oModel.setProperty("/otpStatusState", "Success");
//                 MessageToast.show("[Dev] OTP verified (simulated).");
//             });
//         },

//         // ─────────────────────────────────────────────
//         // REVIEW DIALOG
//         // ─────────────────────────────────────────────
//         onOpenReview: function () {
//             this._getReviewDialog().open();
//         },

//         onCloseReview: function () {
//             this._getReviewDialog().close();
//         },

//         _getReviewDialog: function () {
//             if (!this._oReviewDialog) {
//                 this._oReviewDialog = this.byId("reviewDialog");
//             }
//             return this._oReviewDialog;
//         },

//         // ─────────────────────────────────────────────
//         // SUBMIT
//         // Creates BusinessPartner record via OData POST
//         // Backend auto-sets: BusinessPartnerNumber, IsBP, IsCustomer,
//         // Currency, PaymentTerms, Incoterms, etc.
//         // ─────────────────────────────────────────────
//         onWizardCompleted: function () {
//             var oModel = this.getView().getModel("wizardData");
//             var oData = oModel.getData();

//             // Remove UI-only fields before posting
//             var oPayload = {
//                 BPRole: oData.BPRole,
//                 BPType: oData.BPType,
//                 Grouping: oData.Grouping,
//                 Name: oData.Name,
//                 Title: oData.Title,
//                 StreetAddress: oData.StreetAddress,
//                 PostalCode: oData.PostalCode,
//                 Country: oData.Country,
//                 Region: oData.Region,
//                 Language: oData.Language,
//                 MobileCountryCode: oData.MobileCountryCode,
//                 MobileNumber: oData.MobileNumber,
//                 Telephone: oData.Telephone,
//                 Email: oData.Email,
//                 TaxCategory: oData.TaxCategory,
//                 TaxNumber: oData.TaxNumber,
//                 TaxStatus: oData.TaxStatus,
//                 SalesOrganization: oData.SalesOrganization,
//                 DistributionChannel: oData.DistributionChannel,
//                 Division: oData.Division,
//                 CustomerGroup: oData.CustomerGroup,
//                 Currency: oData.Currency,
//                 ExchangeRateType: oData.ExchangeRateType,
//                 CustomerPricingProcedure: oData.CustomerPricingProcedure,
//                 CustomerStatsGroup: oData.CustomerStatsGroup,
//                 PaymentTerms: oData.PaymentTerms,
//                 Incoterms: oData.Incoterms,
//                 AccountAssignmentGroup: oData.AccountAssignmentGroup,
//                 TaxClassification: oData.TaxClassification,
//                 OutputTaxCountry: oData.OutputTaxCountry,
//                 OutputTaxCategory: oData.OutputTaxCategory,
//                 CustomerData2: oData.CustomerData2,
//                 CompanyCode: oData.CompanyCode,
//                 IsBP: true,
//                 IsCustomer: true,
//                 ReconciliationAccount: oData.ReconciliationAccount
//             };

//             var oODataModel = this.getView().getModel();
//             var oListBinding = oODataModel.bindList("/BusinessPartners");
//             var oContext = oListBinding.create(oPayload);
//             var that = this;

//             this._getReviewDialog().close();
//             this._oBusyDialog.open();

//             oContext.created().then(function () {
//                 that._oBusyDialog.close();
//                 var sBpNum = oContext.getObject().BusinessPartnerNumber;
//                 MessageBox.success("Business Partner created successfully!\n\nBP Number: " + sBpNum, {
//                     onClose: function () {
//                         that.onNavBack();
//                     }
//                 });
//             }).catch(function (oError) {
//                 that._oBusyDialog.close();
//                 var sMsg = oError && oError.message ? oError.message : "An error occurred during submission.";
//                 MessageBox.error("Failed to create Business Partner:\n" + sMsg);
//             });
//         },

//         // ─────────────────────────────────────────────
//         // NAVIGATION
//         // ─────────────────────────────────────────────
//         onNavBack: function () {
//             this.getOwnerComponent().getRouter().navTo("Main");
//         }
//     });
// });

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/BusyDialog"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, BusyDialog) {
    "use strict";

    return Controller.extend("bp.cust.ui.controller.Wizard", {

        onInit: function () {
            var oViewModel = new JSONModel({
                progress: 14, // Exact integer percentage (1/7 = 14%)
                progressText: "14%",
                TemplateID: "",

                // Step 1: General Data
                BPRole: "000000", BPType: "Organization", Grouping: "ZP01",
                // Step 2: Address & Communication
                Name: "", Title: "", StreetAddress: "", PostalCode: "", Country: "UG", Region: "", Language: "EN", MobileCountryCode: "+256", MobileNumber: "", Telephone: "", Email: "",
                // OTP state
                otpSent: false, otpValue: "", otpVerified: false, otpStatusText: "", otpStatusState: "None",
                // Step 3: Identification
                TaxCategory: "", TaxNumber: "", TaxStatus: "",
                // Step 4: Sales Area
                SalesOrganization: "1000", DistributionChannel: "01", Division: "10",
                // Step 5: Sales Data & Billing
                CustomerGroup: "10", Currency: "UGX", ExchangeRateType: "S", CustomerPricingProcedure: "1", CustomerStatsGroup: "+", PaymentTerms: "Z001", Incoterms: "EXW", AccountAssignmentGroup: "01", TaxClassification: "1", OutputTaxCountry: "UG", OutputTaxCategory: "MWST", CustomerData2: "02",
                // Step 6: Company Code
                CompanyCode: "1000", IsBP: true, IsCustomer: true,
                // Step 7: Account Management
                ReconciliationAccount: "321000"
            });
            this.getView().setModel(oViewModel, "wizardData");

            this._oBusyDialog = new BusyDialog({ title: "Processing", text: "Communicating with backend..." });
            this.getView().addDependent(this._oBusyDialog);

            this.getOwnerComponent().getRouter().getRoute("Wizard").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            var oWizard = this.byId("bpWizard");
            var oFirstStep = oWizard.getSteps()[0];
            oWizard.discardProgress(oFirstStep); // Reset wizard UI

            this._updateProgress(1); // Reset percentage to Step 1

            var sBpID = oEvent.getParameter("arguments").bpID;
            if (!sBpID || sBpID === "create") {
                this.getView().getModel("wizardData").setProperty("/otpSent", false);
                return;
            }
            this._loadFullData(sBpID);
        },

        _loadFullData: function (sBpID) {
            var oWizardModel = this.getView().getModel("wizardData");

            // 1. CRITICAL FIX: Get the model from the Owner Component to guarantee it exists during routing
            var oODataModel = this.getOwnerComponent().getModel();
            var that = this;

            this._oBusyDialog.open();

            // 2. Bind directly to the UUID path (OData V4 does not use quotes around UUIDs)
            var sPath = "/BusinessPartners(" + sBpID + ")";
            var oContext = oODataModel.bindContext(sPath);

            // 3. CRITICAL FIX: requestObject("") forces OData V4 to fetch ALL properties for this record
            oContext.requestObject("").then(function (oData) {
                that._oBusyDialog.close();

                if (oData) {
                    // Merge backend data with local UI state (preserves OTP fields, etc.)
                    var oCurrentData = oWizardModel.getData();
                    var oMergedData = Object.assign({}, oCurrentData, oData);

                    oWizardModel.setData(oMergedData);

                    // 4. CRITICAL FIX: Force the UI to instantly re-render with the new data
                    oWizardModel.refresh(true);

                } else {
                    MessageBox.error("No data returned for this Business Partner.");
                }
            }).catch(function (oError) {
                that._oBusyDialog.close();
                MessageBox.error("Failed to fetch backend data.");
                console.error("OData Fetch Error:", oError);
            });
        },

        // ─────────────────────────────────────────────
        // WIZARD NAVIGATION & EXACT PERCENTAGE
        // ─────────────────────────────────────────────
        onNextStep: function () {
            this.byId("bpWizard").nextStep();
        },

        onPrevStep: function () {
            this.byId("bpWizard").previousStep();
        },

        onStepActivate: function (oEvent) {
            var sStepId = oEvent.getParameter("id");
            var iStep = 1;

            if (sStepId.includes("step1")) iStep = 1;
            else if (sStepId.includes("step2")) iStep = 2;
            else if (sStepId.includes("step3")) iStep = 3;
            else if (sStepId.includes("step4")) iStep = 4;
            else if (sStepId.includes("step5")) iStep = 5;
            else if (sStepId.includes("step6")) iStep = 6;
            else if (sStepId.includes("step7")) iStep = 7;

            this._updateProgress(iStep);
        },

        _updateProgress: function (iStep) {
            var oModel = this.getView().getModel("wizardData");
            var iTotalSteps = 7;
            var iPct = Math.round((iStep / iTotalSteps) * 100);

            oModel.setProperty("/progress", iPct);
            oModel.setProperty("/progressText", iPct + "%");
        },

        // ─────────────────────────────────────────────
        // VALUE HELP LOGIC
        // ─────────────────────────────────────────────
        onCountryChange: function (oEvent) {
            var sCountryKey = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getKey() : "";
            var oModel = this.getView().getModel("wizardData");
            oModel.setProperty("/Region", "");

            var oRegionSelect = this.byId("regionSelect");
            var oBinding = oRegionSelect.getBinding("items");
            if (oBinding) {
                if (sCountryKey) {
                    oBinding.filter([new Filter("country", FilterOperator.EQ, sCountryKey)]);
                } else {
                    oBinding.filter([]);
                }
            }
        },

        onSalesOrgChange: function (oEvent) {
            var sKey = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getKey() : "";
            var oModel = this.getView().getModel("wizardData");
            oModel.setProperty("/ExchangeRateType", sKey === "1000" ? "S" : "SALE");
        },

        // ─────────────────────────────────────────────
        // OTP LOGIC
        // ─────────────────────────────────────────────
        onSendOTP: function () {
            var oModel = this.getView().getModel("wizardData");
            var sMobileCode = oModel.getProperty("/MobileCountryCode") || "";
            var sMobile = oModel.getProperty("/MobileNumber") || "";

            if (!sMobile) {
                MessageBox.warning("Please enter a mobile number first.");
                return;
            }

            var sFullNumber = sMobileCode + sMobile;
            var oODataModel = this.getView().getModel();
            var that = this;

            this._oBusyDialog.open();
            oODataModel.bindContext("/sendOTP(...)").invoke({
                mobileNumber: sFullNumber
            }).then(function () {
                that._oBusyDialog.close();
                oModel.setProperty("/otpSent", true);
                oModel.setProperty("/otpVerified", false);
                oModel.setProperty("/otpStatusText", "");
                MessageToast.show("OTP sent to " + sFullNumber);
            }).catch(function (oError) {
                that._oBusyDialog.close();
                var oContext = oODataModel.bindContext("/sendOTP(...)");
                oContext.setParameter("mobileNumber", sFullNumber);
                oContext.execute().then(function () {
                    oModel.setProperty("/otpSent", true);
                    oModel.setProperty("/otpVerified", false);
                    MessageToast.show("OTP sent to " + sFullNumber);
                }).catch(function () {
                    oModel.setProperty("/otpSent", true);
                    oModel.setProperty("/otpVerified", false);
                    MessageToast.show("[Dev] OTP simulated for " + sFullNumber);
                });
            });
        },

        onVerifyOTP: function () {
            var oModel = this.getView().getModel("wizardData");
            var sMobileCode = oModel.getProperty("/MobileCountryCode") || "";
            var sMobile = oModel.getProperty("/MobileNumber") || "";
            var sOtp = oModel.getProperty("/otpValue") || "";
            var sFullNumber = sMobileCode + sMobile;

            if (!sOtp) {
                MessageBox.warning("Please enter the OTP you received.");
                return;
            }

            var oODataModel = this.getView().getModel();
            var that = this;

            this._oBusyDialog.open();
            var oContext = oODataModel.bindContext("/verifyOTP(...)");
            oContext.setParameter("mobileNumber", sFullNumber);
            oContext.setParameter("otp", sOtp);
            oContext.execute().then(function () {
                var bResult = oContext.getBoundContext().getObject().value;
                that._oBusyDialog.close();
                if (bResult) {
                    oModel.setProperty("/otpVerified", true);
                    oModel.setProperty("/otpStatusText", "✓ Verified");
                    oModel.setProperty("/otpStatusState", "Success");
                    MessageToast.show("Mobile number verified successfully!");
                } else {
                    oModel.setProperty("/otpVerified", true);
                    oModel.setProperty("/otpStatusText", "✗ Invalid OTP");
                    oModel.setProperty("/otpStatusState", "Error");
                    MessageBox.error("Invalid OTP. Please re-enter or request a new one.");
                }
            }).catch(function () {
                that._oBusyDialog.close();
                oModel.setProperty("/otpVerified", true);
                oModel.setProperty("/otpStatusText", "✓ Verified (dev)");
                oModel.setProperty("/otpStatusState", "Success");
                MessageToast.show("[Dev] OTP verified (simulated).");
            });
        },

        // ─────────────────────────────────────────────
        // REVIEW DIALOG & SUBMISSION LOGIC
        // ─────────────────────────────────────────────
        onOpenReview: function () {
            if (!this._oReviewDialog) {
                this._oReviewDialog = this.byId("reviewDialog");
            }
            this._oReviewDialog.open();
        },

        onCloseReview: function () {
            if (this._oReviewDialog) {
                this._oReviewDialog.close();
            }
        },

        onWizardCompleted: function () {
            var oModel = this.getView().getModel("wizardData");
            var oData = oModel.getData();

            var oPayload = {
                BPRole: oData.BPRole,
                BPType: oData.BPType,
                Grouping: oData.Grouping,
                Name: oData.Name,
                Title: oData.Title,
                StreetAddress: oData.StreetAddress,
                PostalCode: oData.PostalCode,
                Country: oData.Country,
                Region: oData.Region,
                Language: oData.Language,
                MobileCountryCode: oData.MobileCountryCode,
                MobileNumber: oData.MobileNumber,
                Telephone: oData.Telephone,
                Email: oData.Email,
                TaxCategory: oData.TaxCategory,
                TaxNumber: oData.TaxNumber,
                TaxStatus: oData.TaxStatus,
                SalesOrganization: oData.SalesOrganization,
                DistributionChannel: oData.DistributionChannel,
                Division: oData.Division,
                CustomerGroup: oData.CustomerGroup,
                Currency: oData.Currency,
                ExchangeRateType: oData.ExchangeRateType,
                CustomerPricingProcedure: oData.CustomerPricingProcedure,
                CustomerStatsGroup: oData.CustomerStatsGroup,
                PaymentTerms: oData.PaymentTerms,
                Incoterms: oData.Incoterms,
                AccountAssignmentGroup: oData.AccountAssignmentGroup,
                TaxClassification: oData.TaxClassification,
                OutputTaxCountry: oData.OutputTaxCountry,
                OutputTaxCategory: oData.OutputTaxCategory,
                CustomerData2: oData.CustomerData2,
                CompanyCode: oData.CompanyCode,
                IsBP: true,
                IsCustomer: true,
                ReconciliationAccount: oData.ReconciliationAccount
            };

            var oODataModel = this.getView().getModel();
            var oListBinding = oODataModel.bindList("/BusinessPartners");
            var oContext = oListBinding.create(oPayload);
            var that = this;

            this.onCloseReview();
            this._oBusyDialog.open();

            oContext.created().then(function () {
                that._oBusyDialog.close();
                var sBpNum = oContext.getObject().BusinessPartnerNumber;
                MessageBox.success("Business Partner created successfully!\n\nBP Number: " + sBpNum, {
                    onClose: function () {
                        that.onNavBack();
                    }
                });
            }).catch(function (oError) {
                that._oBusyDialog.close();
                var sMsg = oError && oError.message ? oError.message : "An error occurred during submission.";
                MessageBox.error("Failed to create Business Partner:\n" + sMsg);
            });
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("Main");
        }
    });
});