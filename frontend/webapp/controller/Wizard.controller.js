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
                
                // Fields
                BPRole: "000000", BPType: "Organization", Grouping: "ZP01",
                Name: "", Title: "", StreetAddress: "", PostalCode: "", Country: "UG", Region: "", Language: "EN", MobileCountryCode: "+256", MobileNumber: "", Telephone: "", Email: "",
                TaxCategory: "", TaxNumber: "", TaxStatus: "",
                SalesOrganization: "1000", DistributionChannel: "01", Division: "10",
                CustomerGroup: "10", Currency: "UGX", ExchangeRateType: "S", CustomerPricingProcedure: "1", CustomerStatsGroup: "+", PaymentTerms: "Z001", Incoterms: "EXW", AccountAssignmentGroup: "01", TaxClassification: "1", OutputTaxCountry: "UG", OutputTaxCategory: "MWST", CustomerData2: "02",
                CompanyCode: "1000", IsBP: true, IsCustomer: true,
                ReconciliationAccount: "321000"
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
            var oContext = oODataModel.bindContext(sPath);

            oContext.requestObject().then(function (oData) {
                that._oBusyDialog.close();
                if (oData) {
                    var oCurrentData = oWizardModel.getData();
                    var oMergedData = Object.assign({}, oCurrentData, oData);
                    
                    oWizardModel.setData(oMergedData);
                    
                    // Set isReadOnly AFTER setData so it doesn't get overwritten
                    var bIsActive = oData.LifecycleStatus === 'active';
                    oWizardModel.setProperty("/isReadOnly", bIsActive);
                    
                    oWizardModel.refresh(true);
                    that._filterByGrouping(oData.Grouping);
                }
            }).catch(function (oError) {
                that._oBusyDialog.close();
                MessageBox.error("Failed to fetch backend data.");
            });
        },

        _getDefaultData: function() {
            return {
                BPRole: "000000", BPType: "Organization", Grouping: "ZP01",
                Name: "", Title: "", StreetAddress: "", PostalCode: "", Country: "UG", Region: "", Language: "EN", MobileCountryCode: "+256", MobileNumber: "", Telephone: "", Email: "",
                TaxCategory: "", TaxNumber: "", TaxStatus: "",
                SalesOrganization: "1000", DistributionChannel: "01", Division: "10",
                CustomerGroup: "10", Currency: "UGX", ExchangeRateType: "S", CustomerPricingProcedure: "1", CustomerStatsGroup: "+", PaymentTerms: "Z001", Incoterms: "EXW", AccountAssignmentGroup: "01", TaxClassification: "1", OutputTaxCountry: "UG", OutputTaxCategory: "MWST", CustomerData2: "02",
                CompanyCode: "1000", IsBP: true, IsCustomer: true,
                ReconciliationAccount: "321000"
            };
        },

        onNextStep: function () {
            var oWizard = this.byId("bpWizard");
            var sCurrentStepId = oWizard.getCurrentStep();
            if (this._validateStep(sCurrentStepId)) {
                oWizard.nextStep();
                this._updateProgress(oWizard.getProgress());
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
                if (!oData.Name) aMissing.push("Name");
                if (!oData.Country) aMissing.push("Country");
                if (!oData.Email) aMissing.push("Email");
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
            var aGenFilter = [new Filter("code", FilterOperator.Contains, sGenPattern)];
            var aReconFilter = [new Filter("code", FilterOperator.Contains, sReconPattern)];

            ["distChannelSelect", "accAssignmentSelect"].forEach(function(sId) {
                var oCtrl = this.byId(sId);
                if (oCtrl && oCtrl.getBinding("items")) oCtrl.getBinding("items").filter(aGenFilter);
            }.bind(this));

            var oRecon = this.byId("reconciliationSelect");
            if (oRecon && oRecon.getBinding("items")) {
                oRecon.getBinding("items").filter(aReconFilter);
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
            if (oBinding) oBinding.filter(sKey ? [new Filter("country", FilterOperator.EQ, sKey)] : []);
        },

        onSalesOrgChange: function (oEvent) {
            var sKey = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getKey() : "";
            this.getView().getModel("wizardData").setProperty("/ExchangeRateType", sKey === "1000" ? "S" : "SALE");
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
            return {
                BPRole: oData.BPRole, BPType: oData.BPType, Grouping: oData.Grouping,
                Name: oData.Name, Title: oData.Title, StreetAddress: oData.StreetAddress, PostalCode: oData.PostalCode, Country: oData.Country, Region: oData.Region, Language: oData.Language, MobileCountryCode: oData.MobileCountryCode, MobileNumber: oData.MobileNumber, Telephone: oData.Telephone, Email: oData.Email,
                TaxCategory: oData.TaxCategory, TaxNumber: oData.TaxNumber, TaxStatus: oData.TaxStatus,
                SalesOrganization: oData.SalesOrganization, DistributionChannel: oData.DistributionChannel, Division: oData.Division,
                CustomerGroup: oData.CustomerGroup, Currency: oData.Currency, ExchangeRateType: oData.ExchangeRateType, CustomerPricingProcedure: oData.CustomerPricingProcedure, CustomerStatsGroup: oData.CustomerStatsGroup, PaymentTerms: oData.PaymentTerms, Incoterms: oData.Incoterms, AccountAssignmentGroup: oData.AccountAssignmentGroup, TaxClassification: oData.TaxClassification, OutputTaxCountry: oData.OutputTaxCountry, OutputTaxCategory: oData.OutputTaxCategory, CustomerData2: oData.CustomerData2,
                CompanyCode: oData.CompanyCode, IsBP: true, IsCustomer: true, ReconciliationAccount: oData.ReconciliationAccount
            };
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
                Object.keys(oPayload).forEach(function(sKey) {
                    oContext.setProperty(sKey, oPayload[sKey]);
                });

                // Wait for the model to submit the changes automatically (via $auto group)
                // In V4, we can check for pending changes or just request side effects to be sure it's done.
                oModel.submitBatch("$auto").then(function() {
                    that._oBusyDialog.close();
                    MessageBox.success(sMsg, { 
                        onClose: function () { 
                            that.onNavBack(); 
                        } 
                    });
                }).catch(function(oErr) {
                    that._oBusyDialog.close();
                    var sError = that._getErrorMessage(oErr);
                    MessageBox.error(sError || "Error updating draft.");
                });
            } else {
                // Create new record (POST)
                var oList = oModel.bindList("/BusinessPartners");
                var oCtx = oList.create(oPayload);
                oCtx.created().then(function () {
                    that._oBusyDialog.close();
                    var sBp = oCtx.getObject().BusinessPartnerNumber;
                    MessageBox.success(sMsg + (sBp ? "\n\nBP: " + sBp : ""), { 
                        onClose: function () { 
                            that.onNavBack(); 
                        } 
                    });
                }).catch(function (oErr) {
                    that._oBusyDialog.close();
                    var sError = that._getErrorMessage(oErr);
                    MessageBox.error(sError || "Error occurred.");
                });
            }
        },

        _getErrorMessage: function(oError) {
            if (!oError) return "Unknown error";
            if (oError.message) return oError.message;
            
            // For OData V4 errors, the message might be buried
            try {
                var oResponse = JSON.parse(oError.responseText);
                if (oResponse && oResponse.error && oResponse.error.message) {
                    return oResponse.error.message;
                }
            } catch (e) {}
            
            return oError.toString();
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("Main");
        }
    });
});