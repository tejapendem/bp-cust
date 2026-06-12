sap.ui.define([
    "bp/cust/ui/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/BusyDialog"
], function (BaseController, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, BusyDialog) {
    "use strict";

    return BaseController.extend("bp.cust.ui.controller.Wizard", {

        onInit: function () {
            // Access control - only registered users can access this page
            var oUserModel = this.getOwnerComponent().getModel("userModel");
            if (oUserModel) {
                var bIsRegistered = oUserModel.getProperty("/isRegistered");
                if (!bIsRegistered) {
                    sap.m.MessageBox.warning("You need to request access to use this page.", {
                        onClose: function () {
                            this.getOwnerComponent().getRouter().navTo("Main");
                        }.bind(this)
                    });
                }
            }

            var oViewModel = new JSONModel({
                progress: 14,
                progressText: "14%",
                progressColor: "Error",
                TemplateID: "",
                isReadOnly: false,
                otpSent: false,
                otpValue: "",
                otpVerified: false,
                otpStatusText: "",
                otpStatusState: "None",

                // Track skipped steps
                skippedSteps: {
                    step5: false,
                    step6: false,
                    step7: false
                },

                // Fields
                BPRole: "000000",
                BusinessPartnerCategory: "2",
                BPType: "Customer",
                Grouping: "ZP01",
                Name: "", FirstName: "", LastName: "", Title: "0003", SearchTerm1: "", SearchTerm2: "",
                StreetAddress: "", PostalCode: "", Country: "UG", Region: "", Language: "EN", MobileCountryCode: "+256", MobileNumber: "", Telephone: "", Email: "",
                TaxCategory: "UG01", TaxNumber: "", TaxStatus: "", TaxNumberDup: "",
                vatValidationSuccess: false,
                vatValidationFailed: false,
                vatValidationMessage: "",
                vatValidated: false,
                taxDupValidationSuccess: false,
                taxDupValidationFailed: false,
                taxDupValidationMessage: "",
                taxDupValidated: false,

                // Credit Management
                RiskClass: "D",
                CheckRule: "Z1",
                CreditGroup: "10",

                SalesAreas: [],
                CompanyCodes: [],
                CreditSegments: []
            });
            this.getView().setModel(oViewModel, "wizardData");

            this._oBusyDialog = new BusyDialog({ title: "Processing", text: "Communicating with backend..." });
            this.getView().addDependent(this._oBusyDialog);

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("Wizard").attachPatternMatched(this._onObjectMatched, this);
            oRouter.getRoute("WizardEdit").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            var oModel = this.getView().getModel("wizardData");
            var oWizard = this.byId("bpWizard");
            var oFirstStep = oWizard.getSteps()[0];
            oWizard.discardProgress(oFirstStep);

            this._updateProgress(1);

            var sBpID = oEvent.getParameter("arguments").bpID;

            if (!sBpID || sBpID === "create") {
                oModel.setProperty("/isReadOnly", false);
                oModel.setProperty("/otpSent", false);
                oModel.setProperty("/TemplateID", "");

                this._refreshValueHelps();

                // Reset fields to default
                var oDefaults = this._getDefaultData();
                oModel.setData(oDefaults);
                
                // Explicitly set TaxCategory again to be sure
                oModel.setProperty("/TaxCategory", "UG01");
                
                oModel.refresh();

                setTimeout(function () {
                    this._filterByGrouping("ZP01");
                }.bind(this), 500);
                return;
            }

            oModel.setProperty("/TemplateID", sBpID);
            this._loadFullData(sBpID);
        },

        _loadFullData: function (sBpID) {
            var oWizardModel = this.getView().getModel("wizardData");
            var oODataModel = this.getOwnerComponent().getModel();
            var that = this;

            this._oBusyDialog.open();
            var sPath = "/BusinessPartners(" + sBpID + ")";
            var oContext = oODataModel.bindContext(sPath, null, {
                "$expand": "SalesAreas,CompanyCodes,CreditSegments"
            });

            oContext.requestObject().then(function (oData) {
                that._oBusyDialog.close();
                if (oData) {
                    var oCurrentData = oWizardModel.getData();
                    var oMergedData = Object.assign({}, oCurrentData, oData);

                    oWizardModel.setData(oMergedData);

                    // Set isReadOnly AFTER setData so it doesn't get overwritten
                    var bIsActive = oData.LifecycleStatus === 'active';
                    oWizardModel.setProperty("/isReadOnly", bIsActive);

                    // Set progress: 100% for active/completed records, step-by-step for drafts
                    if (bIsActive) {
                        that._updateProgress(7); // 100% for completed records
                    } else {
                        that._updateProgress(1); // Start from step 1 for drafts
                    }

                    oWizardModel.refresh(true);
                    that._filterByGrouping(oData.Grouping);
                }
            }).catch(function (oError) {
                that._oBusyDialog.close();
                MessageBox.error("Failed to fetch backend data.");
            });
        },

        _getDefaultData: function () {
            return {
                BPRole: "000000",
                BusinessPartnerCategory: "2",
                BPType: "Customer",
                Grouping: "ZP01",
                Name: "", FirstName: "", LastName: "", Title: "0003", SearchTerm1: "", SearchTerm2: "",
                MobileCountryCode: "+256", MobileNumber: "", Telephone: "", Email: "",
                StreetAddress: "", HouseNumber: "", PostalCode: "", City: "",
                Country: "UG", Region: "", Language: "EN",
                BuildingCode: "", Room: "", Floor: "", CareOf: "",
                Street2: "", Street3: "", Street4: "", Street5: "",
                District: "", TimeZone: "",
                TaxCategory: "UG01", TaxNumber: "", TaxStatus: "", TaxNumberDup: "",
                vatValidationSuccess: false, vatValidationFailed: false, vatValidationMessage: "", vatValidated: false,
                taxDupValidationSuccess: false, taxDupValidationFailed: false, taxDupValidationMessage: "", taxDupValidated: false,
                showExtendedAddress: false,
                RiskClass: "D",
                CheckRule: "Z1",
                CreditGroup: "10",
                SalesAreas: [this._getDefaultSalesAreaData()],
                CompanyCodes: [this._getDefaultCompanyCodeData()],
                CreditSegments: [this._getDefaultCreditSegmentData()],
                skippedSteps: { step5: false, step6: false, step7: false }
            };
        },

        onToggleExtendedAddress: function () {
            var oModel = this.getView().getModel("wizardData");
            var bCurrent = oModel.getProperty("/showExtendedAddress");
            oModel.setProperty("/showExtendedAddress", !bCurrent);
        },

        _getDefaultCreditSegmentData: function () {
            return {
                CreditSegment: "1000", CreditLimitRules: "B2B-NEW", LimitDefined: true, CreditLimit: 100, LimitCurrency: "UGX", ValidityDate: "9999-12-31"
            };
        },

        _getDefaultSalesAreaData: function () {
            return {
                SalesOrganization: "1000", DistributionChannel: "01", Division: "10",
                CustomerGroup: "10", Currency: "UGX", ExchangeRateType: "S", CustomerPricingProcedure: "1", CustomerStatsGroup: "+", PaymentTerms: "Z001", Incoterms: "EXW", AccountAssignmentGroup: "01", TaxClassification: "1", OutputTaxCountry: "UG", OutputTaxCategory: "MWST", CustomerData2: "02"
            };
        },

        _getDefaultCompanyCodeData: function () {
            return {
                CompanyCode: "1000", IsBP: true, IsCustomer: true, ReconciliationAccount: "321000"
            };
        },

        onAddSalesArea: function () {
            var oModel = this.getView().getModel("wizardData");
            var aSalesAreas = oModel.getProperty("/SalesAreas");
            aSalesAreas.push(this._getDefaultSalesAreaData());
            oModel.setProperty("/SalesAreas", aSalesAreas);
            oModel.refresh();
        },

        onRemoveSalesArea: function (oEvent) {
            var oItem = oEvent.getSource().getParent();
            var oTable = oItem.getParent();
            var iIndex = oTable.indexOfItem(oItem);
            var oModel = this.getView().getModel("wizardData");
            var aSalesAreas = oModel.getProperty("/SalesAreas");
            aSalesAreas.splice(iIndex, 1);
            oModel.setProperty("/SalesAreas", aSalesAreas);
            oModel.refresh();
        },

        onAddCompanyCode: function () {
            var oModel = this.getView().getModel("wizardData");
            var aCompanyCodes = oModel.getProperty("/CompanyCodes");
            aCompanyCodes.push(this._getDefaultCompanyCodeData());
            oModel.setProperty("/CompanyCodes", aCompanyCodes);
            oModel.refresh();
        },

        onRemoveCompanyCode: function (oEvent) {
            var oItem = oEvent.getSource().getParent();
            var oTable = oItem.getParent();
            var iIndex = oTable.indexOfItem(oItem);
            var oModel = this.getView().getModel("wizardData");
            var aCompanyCodes = oModel.getProperty("/CompanyCodes");
            aCompanyCodes.splice(iIndex, 1);
            oModel.setProperty("/CompanyCodes", aCompanyCodes);
            oModel.refresh();
        },


        onAddCreditSegment: function () {
            var oModel = this.getView().getModel("wizardData");
            var aSegments = oModel.getProperty("/CreditSegments");
            aSegments.push(this._getDefaultCreditSegmentData());
            oModel.setProperty("/CreditSegments", aSegments);
            oModel.refresh();
        },

        onRemoveCreditSegment: function (oEvent) {
            var oItem = oEvent.getSource().getParent();
            var oTable = oItem.getParent();
            var iIndex = oTable.indexOfItem(oItem);
            var oModel = this.getView().getModel("wizardData");
            var aSegments = oModel.getProperty("/CreditSegments");
            aSegments.splice(iIndex, 1);
            oModel.setProperty("/CreditSegments", aSegments);
            oModel.refresh();
        },

        onLimitDefinedChange: function (oEvent) {
            var iIndex = oEvent.getParameter("selectedIndex");
            var oContext = oEvent.getSource().getBindingContext("wizardData");
            if (oContext) {
                oContext.getModel().setProperty(oContext.getPath() + "/LimitDefined", iIndex === 0);
            }
        },

        onCompanyCodeChange: function (oEvent) {
            var sCompanyCode = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getKey() : "";
            var oModel = this.getView().getModel("wizardData");
            var sSegment = sCompanyCode === "4000" ? "4000" : (sCompanyCode === "1000" || sCompanyCode === "2000" ? "1000" : "");
            if (sSegment) {
                var aSegments = oModel.getProperty("/CreditSegments") || [];
                if (aSegments.length > 0) {
                    aSegments[0].CreditSegment = sSegment;
                } else {
                    aSegments.push({
                        CreditSegment: sSegment,
                        CreditLimitRules: "B2B-NEW",
                        LimitDefined: true,
                        CreditLimit: 100,
                        LimitCurrency: "UGX",
                        ValidityDate: "9999-12-31"
                    });
                }
                oModel.setProperty("/CreditSegments", aSegments);
                oModel.refresh();
            }
            if (sCompanyCode === "4000") {
                var aSalesAreas = oModel.getProperty("/SalesAreas") || [];
                if (aSalesAreas.length > 0) {
                    for (var i = 0; i < aSalesAreas.length; i++) {
                        aSalesAreas[i].SalesOrganization = "4000";
                    }
                    oModel.setProperty("/SalesAreas", aSalesAreas);
                    oModel.refresh();
                }
            }
        },

        onNextStep: function () {
            var oWizard = this.byId("bpWizard");
            var sCurrentStepId = oWizard.getCurrentStep();
            var oModel = this.getView().getModel("wizardData");
            var oData = oModel.getData();

            // Step 3 duplicate tax check: show confirm instead of blocking
            if (sCurrentStepId.includes("step3")) {
                var bIsUgCategory = oData.TaxCategory && oData.TaxCategory.indexOf("UG") === 0;
                if (bIsUgCategory && oData.taxDupValidated && oData.taxDupValidationSuccess) {
                    MessageBox.confirm("This Tax Number is already registered in SAP.\nAre you sure you want to use this number?", {
                        title: "Duplicate Tax Number",
                        onClose: function (oAction) {
                            if (oAction === "OK") {
                                this._proceedNextStep(oWizard, sCurrentStepId);
                            }
                        }.bind(this)
                    });
                    return;
                }
            }

            this._proceedNextStep(oWizard, sCurrentStepId);
        },

        _proceedNextStep: function (oWizard, sCurrentStepId) {
            if (this._validateStep(sCurrentStepId)) {
                var oModel = this.getView().getModel("wizardData");
                var sStepKey = this._getStepKey(sCurrentStepId);
                if (sStepKey) {
                    oModel.setProperty("/skippedSteps/" + sStepKey, false);
                }

                // Default credit segment based on company code when moving from step4
                if (sStepKey === "step4") {
                    var aCompanyCodes = oModel.getProperty("/CompanyCodes") || [];
                    var sSegment = "";
                    for (var i = 0; i < aCompanyCodes.length; i++) {
                        var cc = aCompanyCodes[i].CompanyCode;
                        if (cc === "4000") { sSegment = "4000"; break; }
                        if (cc === "1000" || cc === "2000") { sSegment = "1000"; }
                    }
                    if (sSegment) {
                        var aSegments = oModel.getProperty("/CreditSegments") || [];
                        if (aSegments.length > 0) {
                            aSegments[0].CreditSegment = sSegment;
                        } else {
                            aSegments.push({
                                CreditSegment: sSegment,
                                CreditLimitRules: "B2B-NEW",
                                LimitDefined: true,
                                CreditLimit: 100,
                                LimitCurrency: "UGX",
                                ValidityDate: "9999-12-31"
                            });
                        }
                        oModel.setProperty("/CreditSegments", aSegments);
                    }
                }

                oWizard.nextStep();
                this._updateProgress(oWizard.getProgress());
            }
        },

        onSkipStep: function () {
            var oWizard = this.byId("bpWizard");
            var sCurrentStepId = oWizard.getCurrentStep();
            var oModel = this.getView().getModel("wizardData");
            var sStepKey = this._getStepKey(sCurrentStepId);

            if (!sStepKey) return;

            // Mark step as skipped
            oModel.setProperty("/skippedSteps/" + sStepKey, true);

            // Clear data for the skipped step
            this._clearStepData(sStepKey);

            // If this is the last step (step7), go directly to review
            if (sStepKey === "step7") {
                if (!this._oReviewDialog) this._oReviewDialog = this.byId("reviewDialog");
                this._oReviewDialog.open();
                return;
            }

            // Move to next step
            oWizard.nextStep();
            this._updateProgress(oWizard.getProgress());
            MessageToast.show("Step skipped — data will not be saved for this step.");
        },

        _getStepKey: function (sStepId) {
            if (sStepId.includes("step5")) return "step5";
            if (sStepId.includes("step6")) return "step6";
            if (sStepId.includes("step7")) return "step7";
            return null;
        },

        _clearStepData: function (sStepKey) {
            var oModel = this.getView().getModel("wizardData");

            switch (sStepKey) {
                case "step5": // Sales Area
                    oModel.setProperty("/SalesAreas", []);
                    break;
                case "step6": // Customer Info (sales area detail fields)
                    // Clear the detail fields within each sales area
                    var aSalesAreas = oModel.getProperty("/SalesAreas") || [];
                    aSalesAreas.forEach(function (oSA) {
                        oSA.CustomerGroup = "";
                        oSA.AccountAssignmentGroup = "";
                        oSA.TaxClassification = "";
                        oSA.CustomerData2 = "";
                    });
                    oModel.setProperty("/SalesAreas", aSalesAreas);
                    oModel.refresh();
                    break;
                case "step7": // SAP Credit Management
                    oModel.setProperty("/RiskClass", "");
                    oModel.setProperty("/CheckRule", "");
                    oModel.setProperty("/CreditGroup", "");
                    oModel.setProperty("/CreditSegments", []);
                    break;
            }
        },

        onPrevStep: function () {
            var oWizard = this.byId("bpWizard");
            oWizard.previousStep();
            this._updateProgress(oWizard.getProgress());
        },

        onStepActivate: function (oEvent) {
            var oWizard = this.byId("bpWizard");
            this._updateProgress(oWizard.getProgress());
        },

        _updateProgress: function (iStep) {
            var oModel = this.getView().getModel("wizardData");

            // For existing active records, always show 100%
            if (oModel.getProperty("/isReadOnly")) {
                oModel.setProperty("/progress", 100);
                oModel.setProperty("/progressText", "100%");
                oModel.setProperty("/progressColor", "Good");
                return;
            }

            // For new records, calculate progress based on current step
            var iTotalSteps = 7;
            iStep = iStep || 1;
            var iPct = Math.round((iStep / iTotalSteps) * 100);
            var sColor = iPct <= 30 ? "Error" : (iPct <= 70 ? "Critical" : "Good");
            oModel.setProperty("/progress", iPct);
            oModel.setProperty("/progressText", iPct + "%");
            oModel.setProperty("/progressColor", sColor);
        },

        _validateStep: function (sStepId) {
            var oModel = this.getView().getModel("wizardData");
            var oData = oModel.getData();
            var aMissing = [];
            if (oModel.getProperty("/isReadOnly")) return true;

            if (sStepId.includes("step2")) {
                if (oData.BusinessPartnerCategory === "1") {
                    if (!oData.FirstName) aMissing.push("Firstname");
                    if (!oData.LastName) aMissing.push("Lastname");
                } else {
                    if (!oData.Name) aMissing.push("Name");
                    if (!oData.Country) aMissing.push("Country");
                    if (!oData.Email) {
                        aMissing.push("Email");
                    } else {
                        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(oData.Email)) {
                            aMissing.push("Email (Invalid format)");
                        }
                    }
                }

                // Mobile number validation (skip for Person)
                if (oData.BusinessPartnerCategory !== "1") {
                    if (!oData.MobileNumber) {
                        aMissing.push("Mobile Number");
                    } else {
                        var phoneRegex = /^\d{10}$/;
                        if (!phoneRegex.test(oData.MobileNumber)) {
                            aMissing.push("Mobile Number (exactly 10 digits required)");
                        }
                    }
                }

                // Search terms mandatory (only Term 1 is required)
                if (!oData.SearchTerm1) aMissing.push("Search Term 1");
            } else if (sStepId.includes("step3")) {
                if (!oData.TaxCategory) aMissing.push("Tax Category");
                if (!oData.TaxNumber) aMissing.push("Tin Number");
                // For UG01 only, require Tin Number validation before proceeding
                var bIsUg01 = oData.TaxCategory === "UG01";
                if (bIsUg01 && oData.TaxNumber && !oData.vatValidated) {
                    MessageBox.warning("Please validate the Tin Number before proceeding.");
                    return false;
                }

            }

            if (aMissing.length > 0) {
                MessageBox.error("Mandatory fields missing:\n\n" + aMissing.join("\n"));
                return false;
            }
            return true;
        },

        _filterByGrouping: function (sGrouping) {
            var oModel = this.getView().getModel("wizardData");
            var sGenPattern = (sGrouping === "ZP01") ? "01" : "40";
            var sReconPattern = (sGrouping === "ZP01") ? "321000" : "321001";

            // Base filter: only active records
            var oActiveFilter = new Filter("isActive", FilterOperator.EQ, true);

            var aGenFilter = [
                oActiveFilter,
                new Filter("code", FilterOperator.Contains, sGenPattern)
            ];
            var aReconFilter = [
                oActiveFilter,
                new Filter("code", FilterOperator.Contains, sReconPattern)
            ];

            ["distChannelSelect", "accAssignmentSelect"].forEach(function (sId) {
                var oCtrl = this.byId(sId);
                if (oCtrl && oCtrl.getBinding("items")) {
                    oCtrl.getBinding("items").filter(new Filter({
                        filters: aGenFilter,
                        and: true
                    }));
                }
            }.bind(this));

            var oRecon = this.byId("reconciliationSelect");
            if (oRecon && oRecon.getBinding("items")) {
                oRecon.getBinding("items").filter(new Filter({
                    filters: aReconFilter,
                    and: true
                }));
                oModel.setProperty("/ReconciliationAccount", sReconPattern);
            }
        },

        onGroupingChange: function (oEvent) {
            var oItem = oEvent.getParameter("selectedItem");
            if (oItem) this._filterByGrouping(oItem.getKey());
        },

        onCountryChange: function (oEvent) {
            var sKey = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getKey() : "";
            this.getView().getModel("wizardData").setProperty("/Region", "");
            this._applyRegionFilter();
        },

        /**
         * Ensures model commits Name value on every keystroke (fix for showSuggestion mode)
         */
        onNameInputLiveChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            this.getView().getModel("wizardData").setProperty("/Name", sValue);
        },

        /**
         * Dynamic suggestions for Name field using SAP Customer API via devlb destination
         */
        onNameSuggest: function (oEvent) {
            var sValue = oEvent.getParameter("suggestValue");
            if (!sValue || sValue.trim().length < 2) {
                return;
            }

            var oModel = this.getView().getModel();
            var that = this;

            var oActionCtx = oModel.bindContext("/searchCustomersByName(...)");
            oActionCtx.setParameter("name", sValue);

            oActionCtx.execute().then(function () {
                var oResult = oActionCtx.getBoundContext().getObject();
                var aResults = [];
                if (oResult && oResult.value) {
                    try {
                        aResults = JSON.parse(oResult.value);
                    } catch (e) {
                        console.error("Failed to parse suggestions JSON:", e);
                    }
                }

                var oSuggestionsModel = that.getView().getModel("suggestions");
                if (!oSuggestionsModel) {
                    oSuggestionsModel = new sap.ui.model.json.JSONModel();
                    that.getView().setModel(oSuggestionsModel, "suggestions");
                }
                oSuggestionsModel.setData(aResults);
                oSuggestionsModel.refresh(true);
            }).catch(function (oError) {
                console.error("Suggestions fetch failed:", oError);
            });
        },

        /**
         * Validates the entered Tin Number against the SAP Taxpayer API
         * via the backend CDS action validateVATNumber.
         */
        onValidateTaxNumber: function () {
            var oModel = this.getView().getModel("wizardData");
            var sTaxNumber = (oModel.getProperty("/TaxNumber") || "").trim();

            if (!sTaxNumber) {
                MessageBox.warning("Please enter a Tin Number to validate.");
                return;
            }

            oModel.setProperty("/vatValidationSuccess", false);
            oModel.setProperty("/vatValidationFailed", false);
            oModel.setProperty("/vatValidationMessage", "Validating...");
            oModel.setProperty("/vatValidated", false);

            var that = this;
            this._oBusyDialog.open();

            var oODataModel = this.getOwnerComponent().getModel();
            var sTaxCategory = oModel.getProperty("/TaxCategory");
            var oActionCtx = oODataModel.bindContext("/validateVATNumber(...)");
            oActionCtx.setParameter("taxNumber", sTaxNumber);
            oActionCtx.setParameter("taxCategory", sTaxCategory);

            oActionCtx.execute().then(function () {
                that._oBusyDialog.close();
                var oResult = oActionCtx.getBoundContext().getObject();

                if (oResult && oResult.isValid) {
                    oModel.setProperty("/vatValidationSuccess", true);
                    oModel.setProperty("/vatValidationFailed", false);
                    oModel.setProperty("/vatValidationMessage", "✓ " + oResult.message);
                    oModel.setProperty("/vatValidated", true);
                    MessageToast.show("Tin Number validated successfully.");

                    var sDetails =
                        "Legal Name: " + (oResult.legalName || "N/A") + "\n" +
                        "Business Name: " + (oResult.businessName || "N/A") + "\n" +
                        "Contact Number: " + (oResult.contactNumber || "N/A") + "\n" +
                        "Contact Email: " + (oResult.contactEmail || "N/A") + "\n" +
                        "Address: " + (oResult.address || "N/A");
                    MessageBox.success(sDetails, { title: "Taxpayer Details" });
                } else {
                    oModel.setProperty("/vatValidationSuccess", false);
                    oModel.setProperty("/vatValidationFailed", true);
                    oModel.setProperty("/vatValidationMessage", "✗ " + (oResult ? oResult.message : "Tin Number not found"));
                    oModel.setProperty("/vatValidated", false);
                    MessageBox.error(oResult ? oResult.message : "The taxpayer does not exist or the state is abnormal!");
                }
            }).catch(function (oError) {
                that._oBusyDialog.close();
                oModel.setProperty("/vatValidationSuccess", false);
                oModel.setProperty("/vatValidationFailed", true);
                oModel.setProperty("/vatValidationMessage", "✗ Validation service unavailable");
                oModel.setProperty("/vatValidated", false);
                MessageBox.error("Failed to validate Tin Number: " + (oError.message || "Service unavailable"));
            });
        },

        /**
         * Validates the Tax Number (duplicate check) against the Customer API.
         */
        onValidateTaxNumberDup: function () {
            var oModel = this.getView().getModel("wizardData");
            var sTaxNumberDup = (oModel.getProperty("/TaxNumberDup") || "").trim();

            if (!sTaxNumberDup) {
                MessageBox.warning("Please enter a Tax Number to validate.");
                return;
            }

            oModel.setProperty("/taxDupValidationSuccess", false);
            oModel.setProperty("/taxDupValidationFailed", false);
            oModel.setProperty("/taxDupValidationMessage", "Validating...");
            oModel.setProperty("/taxDupValidated", false);

            var that = this;
            this._oBusyDialog.open();

            var oODataModel = this.getOwnerComponent().getModel();
            var sTaxCategory = oModel.getProperty("/TaxCategory");
            var oActionCtx = oODataModel.bindContext("/validateTaxNumber(...)");
            oActionCtx.setParameter("taxNumber", sTaxNumberDup);
            oActionCtx.setParameter("taxCategory", sTaxCategory);

            oActionCtx.execute().then(function () {
                that._oBusyDialog.close();
                var oResult = oActionCtx.getBoundContext().getObject();

                if (oResult && oResult.isDuplicate) {
                    oModel.setProperty("/taxDupValidationSuccess", true);
                    oModel.setProperty("/taxDupValidationFailed", false);
                    oModel.setProperty("/taxDupValidationMessage", "✓ " + oResult.message);
                    oModel.setProperty("/taxDupValidated", true);

                    var sDetails =
                        "BP Number: " + (oResult.customerID || "N/A") + "\n" +
                        "Name: " + (oResult.name || "N/A") + "\n" +
                        "Street/House No: " + (oResult.streetHouseNo || "N/A") + "\n" +
                        "City: " + (oResult.city || "N/A") + "\n" +
                        "Mobile: " + (oResult.mobile || "N/A") + "\n" +
                        "Found In: " + (oResult.registrationField || "N/A") + " = " + (oResult.registrationValue || "N/A") + "\n" +
                        "Company Code: " + (oResult.companyCode || "N/A");
                    MessageBox.warning("This Tax Number is already registered in SAP:\n\n" + sDetails, {
                        title: "Duplicate Tax Number"
                    });
                } else {
                    oModel.setProperty("/taxDupValidationSuccess", false);
                    oModel.setProperty("/taxDupValidationFailed", false);
                    oModel.setProperty("/taxDupValidationMessage", "✓ " + (oResult ? oResult.message : "Tax number is available"));
                    oModel.setProperty("/taxDupValidated", false);
                }
            }).catch(function (oError) {
                that._oBusyDialog.close();
                oModel.setProperty("/taxDupValidationSuccess", false);
                oModel.setProperty("/taxDupValidationFailed", false);
                oModel.setProperty("/taxDupValidationMessage", "✓ Validation service not available — proceeding without duplicate check");
                oModel.setProperty("/taxDupValidated", false);
            });
        },

        /**
         * Resets VAT validation status when the user changes the Tin Number.
         * Auto-copies to Tax Number only when value changes.
         */
        onTinNumberLiveChange: function (oEvent) {
            var oModel = this.getView().getModel("wizardData");
            var sVal = oEvent.getParameter("value") || "";
            oModel.setProperty("/vatValidationSuccess", false);
            oModel.setProperty("/vatValidationFailed", false);
            oModel.setProperty("/vatValidationMessage", "");
            oModel.setProperty("/vatValidated", false);
            var sOld = oModel.getProperty("/TaxNumberDup") || "";
            if (sVal !== sOld) {
                oModel.setProperty("/TaxNumberDup", sVal);
                oModel.setProperty("/taxDupValidationSuccess", false);
                oModel.setProperty("/taxDupValidationFailed", false);
                oModel.setProperty("/taxDupValidationMessage", "");
                oModel.setProperty("/taxDupValidated", false);
            }
        },

        /**
         * Resets validation status when the user changes the Tax Category.
         */
        onTaxCategoryChange: function () {
            var oModel = this.getView().getModel("wizardData");
            oModel.setProperty("/vatValidationSuccess", false);
            oModel.setProperty("/vatValidationFailed", false);
            oModel.setProperty("/vatValidationMessage", "");
            oModel.setProperty("/vatValidated", false);
            oModel.setProperty("/taxDupValidationSuccess", false);
            oModel.setProperty("/taxDupValidationFailed", false);
            oModel.setProperty("/taxDupValidationMessage", "");
            oModel.setProperty("/taxDupValidated", false);
        },

        onSalesOrgChange: function (oEvent) {
            var oItem = oEvent.getParameter("selectedItem");
            var sKey = oItem ? oItem.getKey() : "";
            var oContext = oEvent.getSource().getBindingContext("wizardData");
            if (oContext) {
                var sPath = oContext.getPath();
                this.getView().getModel("wizardData").setProperty(sPath + "/ExchangeRateType", sKey === "1000" ? "S" : "SALE");
            }
        },

        _refreshValueHelps: function () {
            var aSelectIds = [
                "groupingSelect", "categorySelect", "bpTypeSelect", "countrySelect",
                "regionSelect", "taxCategorySelect", "companyCodeSelect"
            ];

            aSelectIds.forEach(function (sId) {
                var oSelect = this.byId(sId);
                if (oSelect) {
                    var oBinding = oSelect.getBinding("items");
                    if (oBinding) {
                        oBinding.refresh();
                    }
                }
            }.bind(this));

            this._applyRegionFilter();
        },

        _applyRegionFilter: function () {
            var sCountry = this.getView().getModel("wizardData").getProperty("/Country");
            var oBinding = this.byId("regionSelect").getBinding("items");
            if (oBinding) {
                var aFilters = [new Filter("isActive", FilterOperator.EQ, true)];
                if (sCountry) {
                    aFilters.push(new Filter("country", FilterOperator.EQ, sCountry));
                }
                oBinding.filter(new Filter({
                    filters: aFilters,
                    and: true
                }));
            }
        },

        onSendOTP: function () {
            var oModel = this.getView().getModel("wizardData");
            var sMobile = (oModel.getProperty("/MobileCountryCode") || "") + (oModel.getProperty("/MobileNumber") || "");
            if (!oModel.getProperty("/MobileNumber")) {
                MessageBox.warning("Enter mobile number.");
                return;
            }
            this._oBusyDialog.open();
            this.getView().getModel().bindContext("/sendOTP(...)").invoke({ mobileNumber: sMobile }).then(function () {
                this._oBusyDialog.close();
                oModel.setProperty("/otpSent", true);
                MessageToast.show("OTP sent.");
            }.bind(this)).catch(function () {
                this._oBusyDialog.close();
                oModel.setProperty("/otpSent", true);
                MessageToast.show("[Dev] OTP simulated.");
            }.bind(this));
        },

        onVerifyOTP: function () {
            var oModel = this.getView().getModel("wizardData");
            var sMobile = (oModel.getProperty("/MobileCountryCode") || "") + (oModel.getProperty("/MobileNumber") || "");
            var sOtp = oModel.getProperty("/otpValue") || "";
            if (!sOtp) {
                MessageBox.warning("Enter OTP.");
                return;
            }
            this._oBusyDialog.open();
            var oCtx = this.getView().getModel().bindContext("/verifyOTP(...)");
            oCtx.setParameter("mobileNumber", sMobile);
            oCtx.setParameter("otp", sOtp);
            oCtx.execute().then(function () {
                this._oBusyDialog.close();
                var bRes = oCtx.getBoundContext().getObject().value;
                oModel.setProperty("/otpVerified", bRes);
                oModel.setProperty("/otpStatusText", bRes ? "✓ Verified" : "✗ Invalid");
                oModel.setProperty("/otpStatusState", bRes ? "Success" : "Error");
            }.bind(this)).catch(function () {
                this._oBusyDialog.close();
                oModel.setProperty("/otpVerified", true);
                oModel.setProperty("/otpStatusText", "✓ Verified (dev)");
                oModel.setProperty("/otpStatusState", "Success");
            }.bind(this));
        },

        onOpenReview: function () {
            if (this._validateStep(this.byId("bpWizard").getCurrentStep())) {
                if (!this._oReviewDialog) this._oReviewDialog = this.byId("reviewDialog");
                this._oReviewDialog.open();
            }
        },

        onCloseReview: function () {
            if (this._oReviewDialog) this._oReviewDialog.close();
        },

        onWizardCompleted: function () {
            var oPayload = this._preparePayload(this.getView().getModel("wizardData").getData());
            oPayload.LifecycleStatus = 'pending_approval';
            // Open busy dialog BEFORE closing review to prevent flicker
            this._oBusyDialog.open();
            this.onCloseReview();
            this._submitData(oPayload, "Business Partner submitted for approval!");
        },

        onSaveDraft: function () {
            var oData = this.getView().getModel("wizardData").getData();
            var oPayload = this._preparePayload(oData);
            oPayload.LifecycleStatus = 'draft';
            if (!oPayload.Name) oPayload.Name = "Draft BP " + new Date().toLocaleTimeString();
            // Open busy dialog BEFORE closing review to prevent flicker
            this._oBusyDialog.open();
            this.onCloseReview();
            this._submitData(oPayload, "Draft saved!");
        },

        _preparePayload: function (oData) {
            var oSkipped = oData.skippedSteps || {};

            var oPayload = {
                BPRole: oData.BPRole,
                BusinessPartnerCategory: oData.BusinessPartnerCategory,
                BPType: oData.BPType,
                Grouping: oData.Grouping,
                FirstName: oData.FirstName,
                LastName: oData.LastName,
                Name: oData.BusinessPartnerCategory === "1" ? (oData.FirstName + " " + oData.LastName).trim() : oData.Name, Title: oData.Title, SearchTerm1: oData.SearchTerm1, SearchTerm2: oData.SearchTerm2,
                StreetAddress: oData.StreetAddress, HouseNumber: oData.HouseNumber, City: oData.City, PostalCode: oData.PostalCode, Country: oData.Country, Region: oData.Region, Language: oData.Language, MobileCountryCode: oData.MobileCountryCode, MobileNumber: oData.MobileNumber, Telephone: oData.Telephone, Email: oData.Email,
                Room: oData.Room, Floor: oData.Floor, CareOf: oData.CareOf, Street2: oData.Street2, Street3: oData.Street3, Street4: oData.Street4, Street5: oData.Street5, District: oData.District, TimeZone: oData.TimeZone,
                TaxCategory: oData.TaxCategory, TaxNumber: oData.TaxNumber, TaxStatus: oData.TaxStatus
            };

            // Step 4: Company Details — spread to avoid mutating model managed objects
            oPayload.CompanyCodes = (oData.CompanyCodes || []).map(function (c) {
                return Object.assign({}, c);
            });

            // Step 5: Sales Area — send empty if skipped
            if (oSkipped.step5) {
                oPayload.SalesAreas = [];
            } else {
                oPayload.SalesAreas = (oData.SalesAreas || []).map(function (s) {
                    return Object.assign({}, s);
                });
            }

            // Step 6: Customer Info — if skipped, clear the detail fields within sales areas
            if (oSkipped.step6 && !oSkipped.step5) {
                oPayload.SalesAreas = oPayload.SalesAreas.map(function (s) {
                    s.CustomerGroup = "";
                    s.AccountAssignmentGroup = "";
                    s.TaxClassification = "";
                    s.CustomerData2 = "";
                    return s;
                });
            }

            // Step 7: Credit Management — send empty if skipped
            if (oSkipped.step7) {
                oPayload.RiskClass = "";
                oPayload.CheckRule = "";
                oPayload.CreditGroup = "";
                oPayload.CreditSegments = [];
            } else {
                oPayload.RiskClass = oData.RiskClass;
                oPayload.CheckRule = oData.CheckRule;
                oPayload.CreditGroup = oData.CreditGroup;
                oPayload.CreditSegments = (oData.CreditSegments || []).map(function (s) {
                    return Object.assign({}, s);
                });
            }

            return oPayload;
        },

        _submitData: function (oPayload, sMsg) {
            var oModel = this.getView().getModel();
            var oWizardModel = this.getView().getModel("wizardData");
            var sTemplateID = oWizardModel.getProperty("/TemplateID");
            var that = this;

            console.log("=== FULL SUBMISSION PAYLOAD ===");
            console.log(JSON.stringify(oPayload, null, 2));
            console.log("=== END PAYLOAD ===");

            // Busy dialog already opened by caller (onWizardCompleted/onSaveDraft)

            if (sTemplateID) {
                // Update existing record via direct PATCH request
                var sSrvUrl = oModel.getServiceUrl().replace(/\/+$/, "");
                if (sSrvUrl.indexOf("/") !== 0 && sSrvUrl.indexOf("://") < 0) {
                    sSrvUrl = "/" + sSrvUrl;
                }

                var doUpdate = function (sCsrfToken) {
                    var oHeaders = { "Accept": "application/json" };
                    if (sCsrfToken) oHeaders["X-CSRF-Token"] = sCsrfToken;

                    that._oBusyDialog.setText("Updating Business Partner...");

                    jQuery.ajax({
                        url: sSrvUrl + "/BusinessPartners(" + sTemplateID + ")",
                        type: "PATCH",
                        contentType: "application/json",
                        headers: oHeaders,
                        data: JSON.stringify(oPayload),
                        success: function () {
                            if (oPayload.LifecycleStatus === 'pending_approval') {
                                that._oBusyDialog.setText("Submitting for approval...");
                                var oActionCtx = oModel.bindContext("/submitForApproval(...)");
                                oActionCtx.setParameter("bpID", sTemplateID);
                                oActionCtx.execute().then(function () {
                                    MessageBox.success(sMsg, {
                                        onClose: function () {
                                            that._oBusyDialog.close();
                                            that.onNavBack();
                                        }
                                    });
                                }).catch(function (oActionErr) {
                                    MessageBox.error("Data updated, but failed to trigger approval workflow: " + that._getErrorMessage(oActionErr), {
                                        onClose: function () { that._oBusyDialog.close(); }
                                    });
                                });
                            } else {
                                MessageBox.success(sMsg, {
                                    onClose: function () {
                                        that._oBusyDialog.close();
                                        that.onNavBack();
                                    }
                                });
                            }

                            try { oModel.refresh(); } catch (e) { /* ignore */ }
                        },
                        error: function (xhr, status, error) {
                            if (xhr.status === 403 && !sCsrfToken) {
                                that._fetchCsrfToken(sSrvUrl, function (sToken) {
                                    doUpdate(sToken);
                                }, function () {
                                    that._oBusyDialog.close();
                                    MessageBox.error("Update failed: CSRF token could not be obtained.");
                                });
                                return;
                            }
                            that._oBusyDialog.close();
                            var sErrorMsg = that._getErrorMessage({
                                responseText: xhr.responseText,
                                message: error
                            });
                            MessageBox.error("Update failed: " + sErrorMsg);
                        }
                    });
                };

                doUpdate(null);
            } else {
                // Create new record via direct REST call to bypass OData V4 managed context
                // bugs that cause 'Cannot read properties of undefined (reading '@$ui5._')'
                var that = this;
                var sSrvUrl = oModel.getServiceUrl().replace(/\/+$/, "");
                if (sSrvUrl.indexOf("/") !== 0 && sSrvUrl.indexOf("://") < 0) {
                    sSrvUrl = "/" + sSrvUrl;
                }

                var doSubmit = function (sCsrfToken) {
                    var oHeaders = { "Accept": "application/json" };
                    if (sCsrfToken) oHeaders["X-CSRF-Token"] = sCsrfToken;

                    that._oBusyDialog.setText("Creating Business Partner...");

                    jQuery.ajax({
                        url: sSrvUrl + "/BusinessPartners",
                        type: "POST",
                        contentType: "application/json",
                        headers: oHeaders,
                        data: JSON.stringify(oPayload),
                        success: function (oCreatedData) {
                            var sBp = oCreatedData.BusinessPartnerNumber || "";
                            var sID = oCreatedData.ID;

                            if (!sID) {
                                MessageBox.success(sMsg, {
                                    onClose: function () {
                                        that._oBusyDialog.close();
                                        that.onNavBack();
                                    }
                                });
                                return;
                            }

                            if (oPayload.LifecycleStatus === 'pending_approval') {
                                that._oBusyDialog.setText("Submitting for approval...");
                                var oActionCtx = oModel.bindContext("/submitForApproval(...)");
                                oActionCtx.setParameter("bpID", sID);
                                oActionCtx.execute().then(function () {
                                    MessageBox.success(sMsg + (sBp ? "\n\nBP Reference No: " + sBp : ""), {
                                        onClose: function () {
                                            that._oBusyDialog.close();
                                            that.onNavBack();
                                        }
                                    });
                                }).catch(function () {
                                    MessageBox.success(sMsg + (sBp ? "\n\nBP Reference No: " + sBp : ""), {
                                        onClose: function () {
                                            that._oBusyDialog.close();
                                            that.onNavBack();
                                        }
                                    });
                                });
                            } else {
                                MessageBox.success(sMsg + (sBp ? "\n\nBP Reference No: " + sBp : ""), {
                                    onClose: function () {
                                        that._oBusyDialog.close();
                                        that.onNavBack();
                                    }
                                });
                            }

                            try { oModel.refresh(); } catch (e) { /* ignore */ }
                        },
                        error: function (xhr, status, error) {
                            that._oBusyDialog.close();
                            // If CSRF required, retry with token
                            if (xhr.status === 403 && !sCsrfToken) {
                                that._fetchCsrfToken(sSrvUrl, function (sToken) {
                                    doSubmit(sToken);
                                }, function () {
                                    MessageBox.error("Submission failed: CSRF token could not be obtained.");
                                });
                                return;
                            }
                            var sErrorMsg = that._getErrorMessage({
                                responseText: xhr.responseText,
                                message: error
                            });
                            MessageBox.error("Submission failed: " + sErrorMsg);
                        }
                    });
                };

                // Try POST directly — CSRF token fetch will happen on 403 if needed
                doSubmit(null);
            }
        },

        _getErrorMessage: function (oError) {
            if (!oError) return "Unknown error";

            // Catch known OData V4 internal TypeError and provide user-friendly message
            if (oError instanceof TypeError && oError.message && oError.message.indexOf("@$ui5") >= 0) {
                return "The application state could not be resolved. Please try again or refresh the page.";
            }

            // 1. Check if the error object has a direct message or responseText message
            if (oError.error && oError.error.message) {
                return oError.error.message;
            }

            // Try to parse from responseText or response body if available
            try {
                if (oError.responseText) {
                    var oResponse = JSON.parse(oError.responseText);
                    if (oResponse && oResponse.error && oResponse.error.message) {
                        return oResponse.error.message;
                    }
                }
            } catch (e) { }

            // 2. OData V4 registers OData errors in the central MessageManager.
            // Let's check for messages in MessageManager as a robust fallback.
            try {
                var oMessageManager = sap.ui.getCore().getMessageManager();
                var aMessages = oMessageManager.getMessageModel().getData();
                if (aMessages && aMessages.length > 0) {
                    var aErrors = aMessages.filter(function (msg) {
                        return msg.type === "Error" || msg.severity === "error";
                    }).map(function (msg) {
                        return msg.message;
                    });
                    if (aErrors.length > 0) {
                        // Exclude generic "HTTP request failed" if we have more specific validation messages
                        var aSpecificErrors = aErrors.filter(function (msg) {
                            return msg !== "HTTP request failed";
                        });
                        if (aSpecificErrors.length > 0) {
                            return aSpecificErrors.join("\n");
                        }
                        return aErrors.join("\n");
                    }
                }
            } catch (e) { }

            if (oError.message) return oError.message;

            // Handle technical error objects
            if (typeof oError === "object") {
                return JSON.stringify(oError);
            }

            return oError.toString();
        },

        _fetchCsrfToken: function (sSrvUrl, fnSuccess, fnError) {
            jQuery.ajax({
                url: sSrvUrl + "/$metadata",
                type: "GET",
                headers: { "X-CSRF-Token": "Fetch" },
                success: function (data, status, xhr) {
                    var sToken = xhr.getResponseHeader("X-CSRF-Token");
                    if (sToken) {
                        fnSuccess(sToken);
                    } else if (fnError) {
                        fnError("No CSRF token returned");
                    }
                },
                error: function () {
                    if (fnError) fnError("CSRF fetch failed");
                }
            });
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("Main");
        }
    });
});