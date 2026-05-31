// sap.ui.define([
//     "sap/ui/core/mvc/Controller",
//     "sap/ui/model/Filter",
//     "sap/ui/model/FilterOperator"
// ], function (Controller, Filter, FilterOperator) {

//     "use strict";
//     return Controller.extend("bp.cust.ui.controller.Main", {
//         onCreatepress: function () {
//             this.getOwnerComponent().getRouter().navTo("Wizard");
//         },
//         onSearch: function (oEvent) {
//             var sQuery = oEvent.getParameter("query");
//             var oTable = this.byId("bpTable");
//             var oBinding = oTable.getBinding("items");

//             if (sQuery) {
//                 var aFilters = [
//                     new Filter("Name", FilterOperator.Contains, sQuery),
//                     new Filter("BusinessPartnerNumber", FilterOperator.Contains, sQuery)
//                 ];
//                 oBinding.filter(new Filter({
//                     filters: aFilters,
//                     and: false
//                 }));
//             } else {
//                 oBinding.filter([]);
//             }
//         },
//         onClear: function () {
//             this.byId("filterID").setValue("");
//             this.byId("filterCategory").setValue("");
//             this.byId("filterName").setValue("");
//             this.byId("filterGrouping").setSelectedKey("");
//             this.byId("filterGrouping").setValue("");
//             var oBinding = this.byId("bpTable").getBinding("items");
//             if (oBinding) {
//                 oBinding.filter([]);
//             }
//         },
//         onItemPress: function (oEvent) {
//             // Optional: View details

//         }
//     });
// });


sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, Fragment, JSONModel, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("bp.cust.ui.controller.Main", {
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

            this.getOwnerComponent().getRouter().getRoute("Main").attachPatternMatched(this._onMainMatched, this);
        },

        _onMainMatched: function () {
            this.onRefresh();
        },

        onCreatepress: function () {
            this.getOwnerComponent().getRouter().navTo("Wizard");
        },

        // ─────────────────────────────────────────────
        // MULTI-FIELD FILTER LOGIC
        // ─────────────────────────────────────────────
        onSearch: function () {
            // 1. Get values from the individual FilterBar inputs
            var sCompanyCode = this.byId("filterCompanyCode").getValue();
            var sSalesArea = this.byId("filterSalesArea").getValue();
            var sBPRole = this.byId("filterBPRole").getValue();
            var sGrouping = this.byId("filterGrouping").getSelectedKey(); // Using getSelectedKey for dropdown

            var aFilters = [];

            // 2. Add filters only if the user typed/selected something
            if (sCompanyCode) {
                aFilters.push(new Filter("CompanyCode", FilterOperator.Contains, sCompanyCode));
            }
            if (sSalesArea) {
                aFilters.push(new Filter("SalesOrganization", FilterOperator.Contains, sSalesArea));
            }
            if (sBPRole) {
                aFilters.push(new Filter("BPRole", FilterOperator.Contains, sBPRole));
            }
            if (sGrouping) {
                // Using EQ (Equals) because the dropdown values match the backend exactly
                aFilters.push(new Filter("Grouping", FilterOperator.EQ, sGrouping));
            }

            // 3. Apply to table binding
            var oTable = this.byId("bpTable");
            var oBinding = oTable.getBinding("items");

            if (aFilters.length > 0) {
                // Combine all filters with AND logic
                oBinding.filter(new Filter({
                    filters: aFilters,
                    and: true
                }));
            } else {
                oBinding.filter([]); // Show all if search is empty
            }
        },

        onClear: function () {
            // 1. Clear all inputs visually
            this.byId("filterCompanyCode").setValue("");
            this.byId("filterSalesArea").setValue("");
            this.byId("filterBPRole").setValue("");
            this.byId("filterGrouping").setSelectedKey(""); // Reset dropdown

            // 2. Clear the table binding to show all records
            var oBinding = this.byId("bpTable").getBinding("items");
            if (oBinding) {
                oBinding.filter([]);
            }
        },

        onItemPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oBindingContext = oItem.getBindingContext();

            if (oBindingContext) {
                // Safely extract the UUID directly from the OData context
                var sId = oBindingContext.getProperty("ID");

                this.getOwnerComponent().getRouter().navTo("WizardEdit", {
                    bpID: sId
                });
            }
        },

        onRefresh: function () {
            var oBinding = this.byId("bpTable").getBinding("items");
            if (oBinding) {
                oBinding.refresh();
            }
        },

        onDeleteSelected: function () {
            var oTable = this.byId("bpTable");
            var aSelected = oTable.getSelectedItems();
            if (!aSelected || aSelected.length === 0) {
                MessageToast.show("Select BPs to delete.");
                return;
            }

            var aIDs = aSelected.map(function (oItem) {
                return oItem.getBindingContext().getProperty("ID");
            });

            var that = this;
            MessageBox.confirm("Delete " + aIDs.length + " selected Business Partner(s)?\nOnly draft and pending_approval BPs will be deleted.", {
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) return;

                    sap.ui.core.BusyIndicator.show(0);
                    var oModel = that.getView().getModel();
                    var oCtx = oModel.bindContext("/deleteBusinessPartners(...)");
                    oCtx.setParameter("bpIDs", aIDs);
                    oCtx.execute().then(function () {
                        sap.ui.core.BusyIndicator.hide();
                        var oResult = oCtx.getBoundContext().getObject();
                        var sMsg = oResult && oResult.value ? oResult.value : "Deleted.";
                        MessageToast.show(sMsg);
                        that.onRefresh();
                    }).catch(function (oErr) {
                        sap.ui.core.BusyIndicator.hide();
                        var sMsg = oErr.message || "Delete failed.";
                        MessageBox.error("Error: " + sMsg);
                        that.onRefresh();
                    });
                }
            });
        },

        onPushToSAPPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext();
            if (!oContext) return;

            var sId = oContext.getProperty("ID");
            var sName = oContext.getProperty("Name");
            var sBUPAPayload = oContext.getProperty("SAPBUPAPayload");
            var sCreditPayload = oContext.getProperty("SAPCreditPayload");
            var sPushStatus = oContext.getProperty("SAPPushStatus");
            var sPushLogs = oContext.getProperty("SAPPushLogs");

            // Format JSON payloads nicely for presentation if they exist
            try {
                if (sBUPAPayload) sBUPAPayload = JSON.stringify(JSON.parse(sBUPAPayload), null, 4);
            } catch(e) {}
            try {
                if (sCreditPayload) sCreditPayload = JSON.stringify(JSON.parse(sCreditPayload), null, 4);
            } catch(e) {}

            var oPushData = {
                ID: sId,
                Name: sName,
                SAPBUPAPayload: sBUPAPayload || "{}",
                SAPCreditPayload: sCreditPayload || "{}",
                SAPPushStatus: sPushStatus || "Not Pushed",
                SAPPushLogs: sPushLogs || ""
            };

            var oPushModel = new JSONModel(oPushData);
            this.getView().setModel(oPushModel, "sapPushModel");

            var oView = this.getView();
            if (!this._pPushDialog) {
                this._pPushDialog = Fragment.load({
                    id: oView.getId(),
                    name: "bp.cust.ui.view.fragments.SAPPushDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pPushDialog.then(function (oDialog) {
                oDialog.open();
                // Select first tab by default on open
                var oTabBar = this.byId("pushTabBar");
                if (oTabBar) {
                    var aItems = oTabBar.getItems();
                    if (aItems && aItems.length > 0) {
                        oTabBar.setSelectedItem(aItems[0]);
                    }
                }
            }.bind(this));
        },

        onConfirmPushToSAP: function () {
            var oPushModel = this.getView().getModel("sapPushModel");
            if (!oPushModel) return;

            var sId = oPushModel.getProperty("/ID");
            var oModel = this.getView().getModel();

            // Clear old logs visually during push
            oPushModel.setProperty("/SAPPushLogs", "Processing...\nInitiating backend SAP integration service...");
            oPushModel.setProperty("/SAPPushStatus", "Pushing");

            // Switch to Logs Tab in the IconTabBar so user sees the progress!
            var oTabBar = this.byId("pushTabBar");
            if (oTabBar) {
                var aItems = oTabBar.getItems();
                if (aItems && aItems.length >= 3) {
                    oTabBar.setSelectedItem(aItems[2]); // Select Logs Tab
                }
            }

            sap.ui.core.BusyIndicator.show(0);

            var oActionCtx = oModel.bindContext("/pushToSAP(...)");
            oActionCtx.setParameter("bpID", sId);

            var that = this;
            oActionCtx.execute().then(function () {
                sap.ui.core.BusyIndicator.hide();
                var oResult = oActionCtx.getBoundContext().getObject().value;
                
                if (oResult && oResult.success) {
                    MessageBox.success("Integration executed successfully!\nBusiness Partner has been synchronized with the SAP Backend.\n\nSAP ID Assigned: " + oResult.bpNumber);
                    oPushModel.setProperty("/SAPPushStatus", "Pushed");
                } else {
                    var sErrMsg = (oResult && oResult.logs) ? "Check the logs tab for detailed system integration error messages." : "An error occurred during SAP integration push.";
                    MessageBox.error("SAP Backend Push Failed.\n\n" + sErrMsg);
                    oPushModel.setProperty("/SAPPushStatus", "Failed");
                }

                if (oResult && oResult.logs) {
                    oPushModel.setProperty("/SAPPushLogs", oResult.logs);
                }

                that.onRefresh();
            }).catch(function (oErr) {
                sap.ui.core.BusyIndicator.hide();
                var sMessage = oErr.message || "Unknown communication error";
                MessageBox.error("Network or Action Execution Error:\n\n" + sMessage);
                oPushModel.setProperty("/SAPPushStatus", "Failed");
                oPushModel.setProperty("/SAPPushLogs", "Network Error:\n" + sMessage);
                that.onRefresh();
            });
        },

        onClosePushDialog: function () {
            if (this.byId("sapPushDialog")) {
                this.byId("sapPushDialog").close();
            }
        }
    });
});