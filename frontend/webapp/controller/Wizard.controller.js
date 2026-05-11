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
                    step4: false,
                    step5: false,
                    step6: false,
                    step7: false
                },

                // Fields
                BPRole: "000000",
                BusinessPartnerCategory: "Organization",
                BPType: "Customer",
                Grouping: "ZP01",
                Name: "", FirstName: "", LastName: "", Title: "0003", SearchTerm1: "", SearchTerm2: "",
                StreetAddress: "", PostalCode: "", Country: "UG", Region: "", Language: "EN", MobileCountryCode: "+256", MobileNumber: "", Telephone: "", Email: "",
                TaxCategory: "", TaxNumber: "", TaxStatus: "",

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
                oModel.setData(Object.assign(oModel.getData(), this._getDefaultData()));
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
                "$expand": "SalesAreas,CompanyCodes"
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
                BusinessPartnerCategory: "Organization",
                BPType: "Customer",
                Grouping: "ZP01",
                Name: "", FirstName: "", LastName: "", Title: "0003", SearchTerm1: "", SearchTerm2: "",
                TaxCategory: "", TaxNumber: "", TaxStatus: "",
                RiskClass: "D",
                CheckRule: "Z1",
                CreditGroup: "10",
                SalesAreas: [this._getDefaultSalesAreaData()],
                CompanyCodes: [this._getDefaultCompanyCodeData()],
                CreditSegments: [this._getDefaultCreditSegmentData()],
                skippedSteps: { step4: false, step5: false, step6: false, step7: false }
            };
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

        onNextStep: function () {
            var oWizard = this.byId("bpWizard");
            var sCurrentStepId = oWizard.getCurrentStep();
            if (this._validateStep(sCurrentStepId)) {
                // Un-skip the step when user explicitly clicks Next (data should be saved)
                var oModel = this.getView().getModel("wizardData");
                var sStepKey = this._getStepKey(sCurrentStepId);
                if (sStepKey) {
                    oModel.setProperty("/skippedSteps/" + sStepKey, false);
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
            if (sStepId.includes("step4")) return "step4";
            if (sStepId.includes("step5")) return "step5";
            if (sStepId.includes("step6")) return "step6";
            if (sStepId.includes("step7")) return "step7";
            return null;
        },

        _clearStepData: function (sStepKey) {
            var oModel = this.getView().getModel("wizardData");

            switch (sStepKey) {
                case "step4": // Company Details
                    oModel.setProperty("/CompanyCodes", []);
                    break;
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
                if (oData.BusinessPartnerCategory === "Person") {
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
            } else if (sStepId.includes("step3")) {
                if (!oData.TaxCategory) aMissing.push("Tax Category");
                if (!oData.TaxNumber) aMissing.push("Tax Number");
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
            var oBinding = this.byId("regionSelect").getBinding("items");
            if (oBinding) {
                var aFilters = [new Filter("isActive", FilterOperator.EQ, true)];
                if (sKey) {
                    aFilters.push(new Filter("country", FilterOperator.EQ, sKey));
                }
                oBinding.filter(new Filter({
                    filters: aFilters,
                    and: true
                }));
            }
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

            // Also refresh table-based selects in Steps 4 and 6
            // Note: Since these are in tables, their internal Selects will be refreshed if the table items are refreshed,
            // but here we just want to ensure the metadata/data for the VH entities is fresh.
            // In V4, refreshing the binding of one control usually refreshes others sharing the same collection path 
            // if they are in the same model and use the same parameters.
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
            oPayload.LifecycleStatus = 'active';
            this.onCloseReview();
            this._submitData(oPayload, "Business Partner created!");
        },

        onSaveDraft: function () {
            var oData = this.getView().getModel("wizardData").getData();
            var oPayload = this._preparePayload(oData);
            oPayload.LifecycleStatus = 'draft';
            if (!oPayload.Name) oPayload.Name = "Draft BP " + new Date().toLocaleTimeString();
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
                Name: oData.BusinessPartnerCategory === "Person" ? (oData.FirstName + " " + oData.LastName).trim() : oData.Name, Title: oData.Title, SearchTerm1: oData.SearchTerm1, SearchTerm2: oData.SearchTerm2,
                StreetAddress: oData.StreetAddress, PostalCode: oData.PostalCode, Country: oData.Country, Region: oData.Region, Language: oData.Language, MobileCountryCode: oData.MobileCountryCode, MobileNumber: oData.MobileNumber, Telephone: oData.Telephone, Email: oData.Email,
                TaxCategory: oData.TaxCategory, TaxNumber: oData.TaxNumber, TaxStatus: oData.TaxStatus
            };

            // Step 4: Company Details — send empty if skipped
            if (oSkipped.step4) {
                oPayload.CompanyCodes = [];
            } else {
                oPayload.CompanyCodes = (oData.CompanyCodes || []).map(function (c) { delete c.parent; return c; });
            }

            // Step 5: Sales Area — send empty if skipped
            if (oSkipped.step5) {
                oPayload.SalesAreas = [];
            } else {
                oPayload.SalesAreas = (oData.SalesAreas || []).map(function (s) { delete s.parent; return s; });
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
                oPayload.CreditSegments = (oData.CreditSegments || []).map(function (s) { delete s.parent; return s; });
            }

            return oPayload;
        },

        _submitData: function (oPayload, sMsg) {
            var oModel = this.getView().getModel();
            var oWizardModel = this.getView().getModel("wizardData");
            var sTemplateID = oWizardModel.getProperty("/TemplateID");
            var that = this;

            this._oBusyDialog.open();

            if (sTemplateID) {
                // Update existing record (PATCH)
                var sPath = "/BusinessPartners(" + sTemplateID + ")";
                var oContext = oModel.bindContext(sPath).getBoundContext();

                // Set properties individually to ensure PATCH is triggered correctly
                Object.keys(oPayload).forEach(function (sKey) {
                    oContext.setProperty(sKey, oPayload[sKey]);
                });

                // Wait for the model to submit the changes automatically (via $auto group)
                // In V4, we can check for pending changes or just request side effects to be sure it's done.
                oModel.submitBatch("$auto").then(function () {
                    that._oBusyDialog.close();
                    MessageBox.success(sMsg, {
                        onClose: function () {
                            that.onNavBack();
                        }
                    });
                }).catch(function (oErr) {
                    that._oBusyDialog.close();
                    var sError = that._getErrorMessage(oErr);
                    MessageBox.error("Update failed: " + sError);
                });
            } else {
                // Create new record (POST)
                var oList = oModel.bindList("/BusinessPartners");
                var oCtx = oList.create(oPayload);
                oCtx.created().then(function () {
                    that._oBusyDialog.close();
                    var sBp = oCtx.getObject().BusinessPartnerNumber;
                    MessageBox.success(sMsg + (sBp ? "\n\nBP Reference No: " + sBp : ""), {
                        onClose: function () {
                            that.onNavBack();
                        }
                    });
                }).catch(function (oErr) {
                    that._oBusyDialog.close();
                    var sError = that._getErrorMessage(oErr);
                    MessageBox.error("Submission failed: " + sError);
                });
            }
        },

        _getErrorMessage: function (oError) {
            if (!oError) return "Unknown error";

            // OData V4 errors often have getMessage or are in a specific structure
            if (oError.getBoundContext && oError.getBoundContext()) {
                var oMsgModel = this.getView().getModel("messages");
                // Usually V4 errors are also in the MessageManager
            }

            if (oError.message) return oError.message;

            // Try to parse from responseText if available
            try {
                if (oError.responseText) {
                    var oResponse = JSON.parse(oError.responseText);
                    if (oResponse && oResponse.error && oResponse.error.message) {
                        return oResponse.error.message;
                    }
                }
            } catch (e) { }

            // Handle technical error objects
            if (typeof oError === "object") {
                return JSON.stringify(oError);
            }

            return oError.toString();
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("Main");
        }
    });
});