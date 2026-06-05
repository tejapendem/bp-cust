sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox) {
    "use strict";

    return Controller.extend("bp.cust.ui.controller.ApprovalData", {
        onInit: function () {
            var oUserModel = this.getOwnerComponent().getModel("userModel");
            if (oUserModel) {
                var bIsAdmin = oUserModel.getProperty("/isAdmin");
                if (!bIsAdmin) {
                    MessageBox.warning("You don't have permission to access this page.", {
                        onClose: function () {
                            this.getOwnerComponent().getRouter().navTo("Main");
                        }.bind(this)
                    });
                }
            }

            this.getView().setModel(new JSONModel({ total: 0, pushed: 0, pending: 0, failed: 0 }), "kpiModel");
            this.getView().setModel(new JSONModel([]), "approvedList");

            this.getOwnerComponent().getRouter().getRoute("ApprovalData").attachPatternMatched(this._onPatternMatched, this);
        },

        _onPatternMatched: function () {
            this._loadApprovedBPs();
        },

        _loadApprovedBPs: function () {
            var oModel = this.getOwnerComponent().getModel();
            var that = this;

            var oFilter = new Filter("LifecycleStatus", FilterOperator.EQ, "active");

            var oListBinding = oModel.bindList("/BusinessPartners", null, null, [oFilter], {
                $orderby: "createdAt desc"
            });

            oListBinding.requestContexts().then(function (aContexts) {
                var aItems = aContexts.map(function (oContext) {
                    return oContext.getObject();
                });
                that.getView().getModel("approvedList").setData(aItems);
                that._updateKPIs(aItems);
                console.log("Approved BPs loaded:", aItems.length);
            }).catch(function (oError) {
                console.error("Error loading approved BPs:", oError);
                MessageBox.error("Failed to load approved business partners");
            });
        },

        _updateKPIs: function (aItems) {
            var oKPI = { total: 0, pushed: 0, pending: 0, failed: 0 };
            oKPI.total = aItems.length;
            aItems.forEach(function (oItem) {
                var sStatus = oItem.SAPPushStatus || 'Not Pushed';
                if (sStatus === 'Pushed') oKPI.pushed++;
                else if (sStatus === 'Failed') oKPI.failed++;
                else oKPI.pending++;
            });
            this.getView().getModel("kpiModel").setData(oKPI);
        },

        onRefresh: function () {
            this._loadApprovedBPs();
        },

        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            var oModel = this.getOwnerComponent().getModel();
            var that = this;

            var aFilters = [
                new Filter("LifecycleStatus", FilterOperator.EQ, "active")
            ];

            if (sQuery) {
                var oNameFilter = new Filter("Name", FilterOperator.Contains, sQuery);
                var oIdFilter = new Filter("BusinessPartnerNumber", FilterOperator.Contains, sQuery);
                aFilters.push(new Filter([oNameFilter, oIdFilter], false));
            }

            var oListBinding = oModel.bindList("/BusinessPartners", null, null, aFilters, {
                $orderby: "createdAt desc"
            });

            oListBinding.requestContexts().then(function (aContexts) {
                var aItems = aContexts.map(function (oContext) {
                    return oContext.getObject();
                });
                that.getView().getModel("approvedList").setData(aItems);
                that._updateKPIs(aItems);
            }).catch(function (oError) {
                console.error("Error searching approved BPs:", oError);
            });
        },

        onPushToSAP: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("approvedList");
            if (!oCtx) return;

            var sID = oCtx.getProperty("ID");
            var sName = oCtx.getProperty("Name");
            var that = this;

            MessageBox.confirm("Push Business Partner \"" + sName + "\" to SAP?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._executePush(sID);
                    }
                }
            });
        },

        _executePush: function (sID) {
            var oModel = this.getOwnerComponent().getModel();
            var that = this;

            sap.ui.core.BusyIndicator.show(0);

            var oActionCtx = oModel.bindContext("/pushToSAP(...)");
            oActionCtx.setParameter("bpID", sID);

            oActionCtx.execute().then(function () {
                sap.ui.core.BusyIndicator.hide();
                var oBound = oActionCtx.getBoundContext().getObject();
                var oResult = oBound && oBound.value ? oBound.value : oBound;

                if (oResult && oResult.success) {
                    MessageBox.success("Pushed to SAP successfully!\nSAP ID: " + oResult.bpNumber);
                } else {
                    var sHttp = oResult && oResult.httpStatus ? "HTTP " + oResult.httpStatus + ": " : "";
                    var sErrMsg = oResult && oResult.logs ? sHttp + oResult.logs : "Unknown error";
                    MessageBox.error("Push failed.\n" + sErrMsg);
                }

                that._loadApprovedBPs();
            }).catch(function (oErr) {
                sap.ui.core.BusyIndicator.hide();
                console.log("Push error:", oErr);
                var sMsg = that._getErrorMessage(oErr) || "Unknown error";
                MessageBox.error("Push failed:\n" + sMsg);
                that._loadApprovedBPs();
            });
        },

        onShowPushLogs: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("approvedList");
            if (!oCtx) {
                console.error("No binding context found");
                return;
            }

            var oData = oCtx.getObject();
            var sName = oData.Name || "";
            var sStatus = oData.SAPPushStatus || "Not Pushed";
            var sLogs = oData.SAPPushLogs || "No logs available.";
            var that = this;

            if (!that._oLogDialog) {
                that._oStatusText = new sap.m.ObjectStatus({ inverted: true });
                that._oLogText = new sap.m.TextArea({ editable: false, rows: 20, width: "100%", height: "400px", wrapping: "Off" });

                that._oLogDialog = new sap.m.Dialog({
                    contentWidth: "700px",
                    contentHeight: "500px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new sap.m.VBox({
                            items: [that._oStatusText, that._oLogText]
                        })
                    ],
                    buttons: [
                        new sap.m.Button({
                            text: "Close",
                            press: function () {
                                that._oLogDialog.close();
                            }
                        })
                    ]
                });
            }

            that._oStatusText.setText(sStatus);
            that._oStatusText.setState(sStatus === "Pushed" ? "Success" : "Error");
            that._oLogText.setValue(sLogs);
            that._oLogDialog.setTitle("SAP Push Logs - " + sName);
            that._oLogDialog.open();
        },

        _getErrorMessage: function (oError) {
            if (!oError) return "Unknown error";
            if (oError.error && oError.error.message) return oError.error.message;
            try {
                if (oError.responseText) {
                    var oResponse = JSON.parse(oError.responseText);
                    if (oResponse && oResponse.error && oResponse.error.message) return oResponse.error.message;
                }
            } catch (e) {}
            try {
                var oMessageManager = sap.ui.getCore().getMessageManager();
                var aMessages = oMessageManager.getMessageModel().getData();
                if (aMessages && aMessages.length > 0) {
                    var aErrors = aMessages.filter(function (msg) {
                        return msg.type === "Error" || msg.severity === "error";
                    }).map(function (msg) {
                        return msg.message;
                    });
                    if (aErrors.length > 0) return aErrors.join("\n");
                }
            } catch (e) {}
            return oError.message || "Unknown error";
        },

        onItemPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oCtx = oItem.getBindingContext("approvedList");
            if (oCtx) {
                var sID = oCtx.getProperty("ID");
                this.getOwnerComponent().getRouter().navTo("WizardEdit", {
                    bpID: sID
                });
            }
        }
    });
});
