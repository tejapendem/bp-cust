sap.ui.define([
    "bp/cust/ui/controller/BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (BaseController, Filter, FilterOperator, Fragment, JSONModel, MessageBox, MessageToast) {
    "use strict";

    return BaseController.extend("bp.cust.ui.controller.Main", {
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
            this._bSortDescending = true;
        },

        _onMainMatched: function () {
            this.onRefresh();
            // Apply saved column visibility & sort settings
            setTimeout(function (that) {
                that._applyColumnSettings();
            }, 500, this);
        },

        onCreatepress: function () {
            this.getOwnerComponent().getRouter().navTo("Wizard");
        },

        // ─────────────────────────────────────────────
        // MULTI-FIELD FILTER LOGIC
        // ─────────────────────────────────────────────
        _getTokenKeys: function (sFilterId) {
            var oMI = this.byId(sFilterId);
            if (!oMI || !oMI.getTokens) return [];
            return oMI.getTokens().map(function (oTok) { return oTok.getKey(); });
        },

        _buildOrFilter: function (sPath, aValues, oOp) {
            var op = oOp || FilterOperator.EQ;
            var aF = aValues.map(function (v) { return new Filter(sPath, op, v); });
            if (aF.length === 1) return aF[0];
            return new Filter({ filters: aF, and: false });
        },

        onSearch: function () {
            var aStatus = this._getTokenKeys("filterStatus");
            var aGrouping = this._getTokenKeys("filterGrouping");
            var aCompanyCode = this._getTokenKeys("filterCompanyCode");
            var aSalesOrg = this._getTokenKeys("filterSalesOrg");
            var aBPNumber = this._getTokenKeys("filterBPNumber");
            var aName = this._getTokenKeys("filterName");
            var aCategory = this._getTokenKeys("filterCategory");

            var aFilters = [];

            if (aStatus.length) {
                aFilters.push(this._buildOrFilter("LifecycleStatus", aStatus));
            }
            if (aGrouping.length) {
                aFilters.push(this._buildOrFilter("Grouping", aGrouping));
            }
            if (aCompanyCode.length) {
                var aCC = aCompanyCode.map(function (code) {
                    return new Filter({
                        path: "CompanyCodes/any(d:d/CompanyCode eq '" + code + "')",
                        operator: FilterOperator.EQ,
                        value1: true
                    });
                });
                aFilters.push(aCC.length === 1 ? aCC[0] : new Filter({ filters: aCC, and: false }));
            }
            if (aSalesOrg.length) {
                var aSO = aSalesOrg.map(function (code) {
                    return new Filter({
                        path: "SalesAreas/any(d:d/SalesOrganization eq '" + code + "')",
                        operator: FilterOperator.EQ,
                        value1: true
                    });
                });
                aFilters.push(aSO.length === 1 ? aSO[0] : new Filter({ filters: aSO, and: false }));
            }
            if (aBPNumber.length) {
                aFilters.push(this._buildOrFilter("BusinessPartnerNumber", aBPNumber, FilterOperator.Contains));
            }
            if (aName.length) {
                aFilters.push(this._buildOrFilter("Name", aName, FilterOperator.Contains));
            }
            if (aCategory.length) {
                aFilters.push(this._buildOrFilter("BPType", aCategory));
            }

            var oTable = this.byId("bpTable");
            var oBinding = oTable.getBinding("items");

            if (aFilters.length > 0) {
                oBinding.filter(new Filter({ filters: aFilters, and: true }));
            } else {
                oBinding.filter([]);
            }
        },

        onClear: function () {
            ["filterStatus", "filterGrouping", "filterCompanyCode", "filterSalesOrg",
                "filterBPNumber", "filterName", "filterCategory"].forEach(function (sId) {
                var oMI = this.byId(sId);
                if (oMI) {
                    oMI.removeAllTokens();
                    oMI.setValue("");
                }
            }.bind(this));

            var oBinding = this.byId("bpTable").getBinding("items");
            if (oBinding) {
                oBinding.filter([]);
            }
        },

        // ─────────────────────────────────────────────
        // VALUE HELP DIALOGS (multi-select)
        // ─────────────────────────────────────────────
        _vhConfig: {
            status: {
                title: "Select Status",
                items: [
                    { key: "active", text: "Active" },
                    { key: "draft", text: "Draft" },
                    { key: "pending_approval", text: "Pending Approval" }
                ]
            },
            grouping: {
                title: "Select Grouping",
                items: [
                    { key: "ZP01", text: "ZP01" },
                    { key: "ZP05", text: "ZP05" }
                ]
            },
            category: {
                title: "Select Category",
                items: [
                    { key: "1", text: "Person" },
                    { key: "2", text: "Organization" }
                ]
            },
            companyCode: { title: "Select Company Code", entitySet: "/VH_CompanyCode" },
            salesOrg:    { title: "Select Sales Organization", entitySet: "/VH_SalesOrganization" },
            bpNumber:    { title: "Select Business Partner ID", entitySet: "/BusinessPartners", keyField: "BusinessPartnerNumber", textField: "Name" },
            name:        { title: "Select Name", entitySet: "/BusinessPartners", keyField: "Name", textField: "BusinessPartnerNumber" }
        },

        onOpenValueHelp: function (oEvent) {
            var oInput = oEvent.getSource();
            var sVhKey = oInput.data("vhKey");
            var oCfg = this._vhConfig[sVhKey];
            if (!oCfg) return;

            var that = this;
            this._vhCurrentInput = oInput;

            var oDialog = new sap.m.SelectDialog({
                title: oCfg.title,
                multiSelect: true,
                rememberSelections: false,
                search: function (oEv) {
                    var sQ = oEv.getParameter("value");
                    var aFilters = sQ ? [new Filter("text", FilterOperator.Contains, sQ)] : [];
                    oEv.getSource().getBinding("items").filter(aFilters);
                },
                confirm: function (oEv) {
                    var aSelected = oEv.getParameter("selectedItems") || [];
                    that._applyVhSelection(oInput, aSelected);
                    oDialog.destroy();
                },
                cancel: function () { oDialog.destroy(); }
            });

            // Build items
            if (oCfg.items) {
                // Static list
                var oModel = new sap.ui.model.json.JSONModel({ items: oCfg.items });
                oDialog.setModel(oModel);
                oDialog.bindAggregation("items", {
                    path: "/items",
                    template: new sap.m.StandardListItem({
                        title: "{text}",
                        description: "{key}"
                    })
                });
            } else if (oCfg.entitySet) {
                // OData backed
                var oODataModel = this.getOwnerComponent().getModel();
                oDialog.setModel(oODataModel);
                var sKey = oCfg.keyField || "code";
                var sText = oCfg.textField || "name";
                oDialog.bindAggregation("items", {
                    path: oCfg.entitySet,
                    parameters: oCfg.entitySet.indexOf("/VH_") === 0 ? { $filter: "isActive eq true" } : {},
                    template: new sap.m.StandardListItem({
                        title: "{" + sKey + "}",
                        description: "{" + sText + "}"
                    })
                });
            }

            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        _applyVhSelection: function (oInput, aSelectedItems) {
            // Replace tokens with the new selection
            oInput.removeAllTokens();
            aSelectedItems.forEach(function (oItem) {
                oInput.addToken(new sap.m.Token({
                    key: oItem.getTitle(),
                    text: oItem.getTitle() + (oItem.getDescription() ? " (" + oItem.getDescription() + ")" : "")
                }));
            });
        },

        // ─────────────────────────────────────────────
        // TYPE + ENTER → ADD TOKEN
        // ─────────────────────────────────────────────
        onMultiInputSubmit: function (oEvent) {
            var oInput = oEvent.getSource();
            var sValue = (oEvent.getParameter("value") || "").trim();
            if (!sValue) return;

            var sVhKey = oInput.data("vhKey");
            var oCfg = this._vhConfig[sVhKey];

            // For enum fields, try to match the typed text to a key (case-insensitive)
            // by either exact key match or by display text match.
            var sKey = sValue;
            var sDisplay = sValue;

            if (oCfg && oCfg.items) {
                var sLower = sValue.toLowerCase();
                var oMatch = oCfg.items.find(function (it) {
                    return it.key.toLowerCase() === sLower ||
                           it.text.toLowerCase() === sLower;
                });
                if (oMatch) {
                    sKey = oMatch.key;
                    sDisplay = oMatch.text;
                } else {
                    // No match for an enum field — show a brief warning and stop
                    sap.m.MessageToast.show("'" + sValue + "' is not a valid " + (oCfg.title || "value"));
                    oInput.setValue("");
                    return;
                }
            }

            // Avoid duplicate tokens
            var bExists = oInput.getTokens().some(function (t) { return t.getKey() === sKey; });
            if (!bExists) {
                oInput.addToken(new sap.m.Token({ key: sKey, text: sDisplay }));
            }

            oInput.setValue("");
            this.onSearch();
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

        onToggleSort: function () {
            this._bSortDescending = !this._bSortDescending;
            var oBtn = this.byId("mainSortBtn");
            oBtn.setIcon(this._bSortDescending ? "sap-icon://sort-descending" : "sap-icon://sort-ascending");
            oBtn.setTooltip(this._bSortDescending ? "Sort newest first" : "Sort oldest first");
            var oBinding = this.byId("bpTable").getBinding("items");
            if (oBinding) {
                oBinding.sort(new sap.ui.model.Sorter("createdAt", this._bSortDescending));
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
        },

        // ─────────────────────────────────────────────
        // COLUMN SETTINGS DIALOG
        // ─────────────────────────────────────────────
        _getColumnConfigs: function () {
            return [
                { key: "Details", label: "Business Partner Details", path: "Name", visible: true, sort: "none" },
                { key: "BPNumber", label: "BP Number", path: "BusinessPartnerNumber", visible: false, sort: "none" },
                { key: "SAPNumber", label: "SAP Number", path: "SAPBPNumber", visible: true, sort: "none" },
                { key: "Category", label: "Category", path: "BPType", visible: true, sort: "none" },
                { key: "Grouping", label: "Grouping", path: "Grouping", visible: true, sort: "none" },
                { key: "Status", label: "Status", path: "LifecycleStatus", visible: true, sort: "none" },
                { key: "CreatedAt", label: "Created At", path: "createdAt", visible: true, sort: "desc" },
                { key: "Country", label: "Country", path: "Country", visible: false, sort: "none" },
                { key: "Email", label: "Email", path: "Email", visible: false, sort: "none" },
                { key: "Roles", label: "Assigned Roles", path: "BPRole", visible: true, sort: "none" }
            ];
        },

        _loadColumnSettings: function () {
            var aDefaults = this._getColumnConfigs();
            try {
                var sSaved = localStorage.getItem("bp-cust-column-settings");
                if (sSaved) {
                    var aSaved = JSON.parse(sSaved);
                    var oMap = {};
                    aSaved.forEach(function (c) { oMap[c.key] = c; });
                    aDefaults.forEach(function (c) {
                        if (oMap[c.key]) {
                            c.visible = oMap[c.key].visible;
                            c.sort = oMap[c.key].sort;
                        }
                    });
                }
            } catch (e) {}
            return aDefaults;
        },

        _saveColumnSettings: function (aCols) {
            try {
                localStorage.setItem("bp-cust-column-settings", JSON.stringify(aCols));
            } catch (e) {}
        },

        _applyColumnSettings: function () {
            var aCols = this._loadColumnSettings();
            var oTable = this.byId("bpTable");
            if (!oTable) return;

            var aColKeys = ["Details", "SAPNumber", "Category", "Grouping", "Status", "CreatedAt", "Roles"];
            var aColumns = oTable.getColumns();

            aColKeys.forEach(function (sKey, i) {
                var cfg = null;
                aCols.forEach(function (c) { if (c.key === sKey) cfg = c; });
                if (cfg && aColumns[i]) {
                    aColumns[i].setVisible(cfg.visible !== false);
                }
            });

            var oBinding = oTable.getBinding("items");
            if (!oBinding) return;
            var sSortKey = null;
            var bDesc = false;
            for (var i = 0; i < aCols.length; i++) {
                if (aCols[i].sort && aCols[i].sort !== "none") {
                    sSortKey = aCols[i].path;
                    bDesc = aCols[i].sort === "desc";
                    break;
                }
            }
            if (sSortKey) {
                oBinding.sort(new sap.ui.model.Sorter(sSortKey, bDesc));
            }
        },

        onColumnSettings: function () {
            var that = this;
            var aCols = jQuery.extend(true, [], this._loadColumnSettings());

            if (!this._oColDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "bp.cust.ui.view.fragments.ColumnSettings",
                    controller: this
                }).then(function (oDialog) {
                    that._oColDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    that._openColDialog(aCols);
                });
            } else {
                this._openColDialog(aCols);
            }
        },

        _openColDialog: function (aCols) {
            var oModel = new sap.ui.model.json.JSONModel(aCols);
            this.getView().setModel(oModel, "colSettings");
            this._oColDialog.open();
        },

        onColSettingsOK: function () {
            var oModel = this.getView().getModel("colSettings");
            var aCols = oModel.getData();

            // Ensure only ONE column is the active sort: keep the first non-"none"
            // and reset the rest to "none".
            var bSeen = false;
            aCols.forEach(function (c) {
                if (c.sort && c.sort !== "none") {
                    if (bSeen) {
                        c.sort = "none";
                    } else {
                        bSeen = true;
                    }
                }
            });

            this._saveColumnSettings(aCols);
            this._applyColumnSettings();
            this._oColDialog.close();
        },

        onColSettingsCancel: function () {
            this._oColDialog.close();
        },

        formatDate: function (sValue) {
            if (!sValue) return "";
            var oDate = new Date(sValue);
            if (isNaN(oDate.getTime())) return sValue;
            return oDate.toLocaleString("en-GB", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit"
            });
        }
    });
});