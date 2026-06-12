sap.ui.define([
    "bp/cust/ui/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/BusyDialog",
    "sap/ui/model/Filter"
], function (BaseController, JSONModel, MessageToast, MessageBox, BusyDialog, Filter) {
    "use strict";

    return BaseController.extend("bp.cust.ui.controller.ApprovalInbox", {

        onInit: function () {
            var oUserModel = this.getOwnerComponent().getModel("userModel");
            if (oUserModel && !oUserModel.getProperty("/isAdmin")) {
                MessageBox.warning("You don't have permission to access this page.", {
                    onClose: function () {
                        this.getOwnerComponent().getRouter().navTo("Main");
                    }.bind(this)
                });
            }

            this._oBusyDialog = new BusyDialog({ title: "Processing", text: "Please wait…" });
            this.getView().addDependent(this._oBusyDialog);

            this.getView().setModel(new JSONModel({}), "selectedBP");
            this.getView().setModel(new JSONModel({}), "userInfo");
            this.getView().setModel(new JSONModel({}), "workflowData");
            this.getView().setModel(new JSONModel([]), "approvalList");
            this.getView().setModel(new JSONModel([]), "progressData");

            this._sActiveTab = "pending";  // track current tab
            this._bSortDescending = true;

            this.getOwnerComponent().getRouter()
                .getRoute("ApprovalInbox")
                .attachPatternMatched(this._onPatternMatched, this);

            this._loadUserInfo();
        },

        _onPatternMatched: function () {
            this._loadUserInfo();
        },

        // ── Tab switching ────────────────────────────────────────────────
        onTabPress: function (oEvent) {
            var oBtn = oEvent.getSource();
            // Read the tab key directly from a custom data attribute set on each button
            var sTab = oBtn.data("tabKey");
            if (!sTab) return;

            this._setActiveTab(sTab);
            this._sActiveTab = sTab;

            this.getView().byId("detailContainer").setVisible(false);
            this.getView().byId("emptyState").setVisible(true);
            this.byId("approvalSearch").setValue("");

            var oUserInfo = this.getView().getModel("userInfo").getData();
            if (oUserInfo && oUserInfo.email) {
                this._loadApprovalItems(oUserInfo.email, oUserInfo.role);
            }
        },

        _setActiveTab: function (sTab) {
            var oView = this.getView();
            ["tabPending", "tabApproved", "tabRejected"].forEach(function (sId) {
                var oBtn = oView.byId(sId);
                if (oBtn) oBtn.removeStyleClass("aibTabActive");
            });
            var sActiveId = "tab" + sTab.charAt(0).toUpperCase() + sTab.slice(1);
            var oActive = oView.byId(sActiveId);
            if (oActive) oActive.addStyleClass("aibTabActive");
        },

        // ── Data loading ─────────────────────────────────────────────────
        _loadUserInfo: function () {
            var oModel = this.getOwnerComponent().getModel();
            var that = this;
            var oCtx = oModel.bindContext("/getUserInfo(...)");
            oCtx.execute().then(function () {
                var oData = oCtx.getBoundContext().getObject();
                that.getView().getModel("userInfo").setData(oData);
                that._loadApprovalItems(oData.email, oData.role);
            }).catch(function () {
                var oUserModel = that.getView().getModel("userModel");
                if (oUserModel) {
                    var oData = oUserModel.getData();
                    that.getView().getModel("userInfo").setData({ email: oData.email, role: oData.role });
                    that._loadApprovalItems(oData.email, oData.role);
                }
            });
        },

        _loadApprovalItems: function (sUserEmail, sRole) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel();
            var sStatus = this._sActiveTab || "pending";
            var sOrder = this._bSortDescending ? "createdAt desc" : "createdAt asc";

            var oListBinding = oModel.bindList("/ApprovalWorkflows", null, null, [
                new Filter("status", "EQ", sStatus)
            ], {
                $expand: "businessPartner,logs",
                $orderby: sOrder
            });

            oListBinding.requestContexts().then(function (aContexts) {
                var aItems = aContexts.map(function (oCtx) { return oCtx.getObject(); });
                that._buildList(aItems, sUserEmail, sRole, sStatus);
            }).catch(function (oErr) {
                console.error("Error loading workflows:", oErr);
                MessageBox.error("Failed to load approval items.");
            });
        },

        _buildList: function (aWorkflows, sUserEmail, sRole, sStatus) {
            var aResults = aWorkflows.reduce(function (acc, wf) {
                var bp = wf.businessPartner;
                if (bp) {
                    acc.push({
                        ID: wf.ID,
                        currentLevel: wf.currentLevel,
                        status: wf.status,
                        approverEmail: wf.approverEmail,
                        levelEmails: wf.levelEmails,
                        businessPartner_ID: wf.businessPartner_ID,
                        bpName: bp.Name,
                        bpNumber: bp.BusinessPartnerNumber,
                        bpCategory: bp.BusinessPartnerCategory,
                        bpGrouping: bp.Grouping,
                        bpEmail: bp.Email,
                        bpMobile: bp.MobileNumber,
                        bpCountry: bp.Country,
                        bpStreet: bp.StreetAddress,
                        bpHouseNumber: bp.HouseNumber,
                        bpTaxCategory: bp.TaxCategory,
                        bpTaxNumber: bp.TaxNumber,
                        logs: wf.logs || []
                    });
                }
                return acc;
            }, []);

            // Non-admins only see their own pending items
            if (sRole !== "admin" && sStatus === "pending") {
                aResults = aResults.filter(function (item) {
                    var aEmails = [];
                    try { aEmails = JSON.parse(item.approverEmail || "[]"); } catch (_) { aEmails = [item.approverEmail]; }
                    if (!Array.isArray(aEmails)) aEmails = [item.approverEmail];
                    return aEmails.indexOf(sUserEmail) !== -1;
                });
            }

            this.getView().getModel("approvalList").setData(aResults);
            this._aAllApprovalItems = aResults;
        },

        onSearch: function (oEvent) {
            var sQuery = (oEvent.getParameter("query") || oEvent.getParameter("value") || "").toLowerCase();
            var aAll = this._aAllApprovalItems || [];
            var aFiltered = sQuery
                ? aAll.filter(function (item) {
                    return (item.bpName || "").toLowerCase().includes(sQuery) ||
                           (item.bpNumber || "").toLowerCase().includes(sQuery);
                })
                : aAll;
            this.getView().getModel("approvalList").setData(aFiltered);
        },

        onToggleSort: function () {
            this._bSortDescending = !this._bSortDescending;
            var oBtn = this.byId("sortBtn");
            oBtn.setIcon(this._bSortDescending ? "sap-icon://sort-descending" : "sap-icon://sort-ascending");
            oBtn.setTooltip(this._bSortDescending ? "Newest first" : "Oldest first");
            var oUserInfo = this.getView().getModel("userInfo").getData();
            if (oUserInfo && oUserInfo.email) {
                this._loadApprovalItems(oUserInfo.email, oUserInfo.role);
            }
        },

        // ── Item selection ───────────────────────────────────────────────
        onBPSelect: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            if (!oItem) return;
            var oCtx = oItem.getBindingContext("approvalList");
            if (!oCtx) return;
            var oData = oCtx.getObject();

            // Replace the whole model so all bindings (including visible=) re-evaluate
            this.getView().setModel(new JSONModel(oData), "workflowData");

            this.getView().getModel("selectedBP").setData({
                Name: oData.bpName,
                BusinessPartnerNumber: oData.bpNumber,
                BusinessPartnerCategory: oData.bpCategory || "",
                Grouping: oData.bpGrouping || "",
                Email: oData.bpEmail || "",
                MobileNumber: oData.bpMobile || "",
                Country: oData.bpCountry || "",
                StreetAddress: oData.bpStreet || "",
                HouseNumber: oData.bpHouseNumber || "",
                TaxCategory: oData.bpTaxCategory || "",
                TaxNumber: oData.bpTaxNumber || ""
            });

            this.getView().byId("detailContainer").setVisible(true);
            this.getView().byId("emptyState").setVisible(false);
            this._updateWorkflowProgress(oData);
        },

        _updateWorkflowProgress: function (oWorkflowData) {
            var oModel = this.getOwnerComponent().getModel();
            var that = this;
            var oLevelEmails = {};
            try { oLevelEmails = JSON.parse(oWorkflowData.levelEmails || "{}"); } catch (_) {}

            oModel.bindList("/ApprovalLevels", null, null, null, { $orderby: "level" })
                .requestContexts()
                .then(function (aCtxs) {
                    var aLevels = aCtxs.map(function (c) { return c.getObject(); });
                    var aLogs = oWorkflowData.logs || [];

                    var aSteps = aLevels.map(function (lvl) {
                        var oLog = aLogs.find(function (l) { return l.level === lvl.level; });
                        var sStatus = "Pending";
                        if (oWorkflowData.status === "approved") {
                            sStatus = "Approved";
                        } else if (oWorkflowData.status === "rejected" && oLog && oLog.action === "rejected") {
                            sStatus = "Rejected";
                        } else if (oLog && oLog.action === "approved") {
                            sStatus = "Approved";
                        } else if (oWorkflowData.status === "pending" && oWorkflowData.currentLevel === lvl.level) {
                            sStatus = "Awaiting";
                        } else if (oWorkflowData.status === "pending" && lvl.level < oWorkflowData.currentLevel) {
                            sStatus = "Approved";
                        }
                        var sEmail = oLevelEmails[lvl.level] || lvl.email;
                        if (sEmail) {
                            try {
                                var aParsed = JSON.parse(sEmail);
                                if (Array.isArray(aParsed)) {
                                    sEmail = aParsed.join(", ");
                                }
                            } catch (_) {}
                        }
                        var sApprovedBy = "";
                        if ((sStatus === "Approved" || sStatus === "Rejected") && oLog && oLog.approver) {
                            sApprovedBy = oLog.approver;
                        }
                        return {
                            level: lvl.level,
                            levelName: lvl.levelName,
                            email: sEmail,
                            approvedBy: sApprovedBy,
                            status: sStatus
                        };
                    });

                    that.getView().setModel(new JSONModel(aSteps), "progressData");
                });
        },

        // ── Actions ──────────────────────────────────────────────────────
        onRefresh: function () {
            var oUserInfo = this.getView().getModel("userInfo").getData();
            if (oUserInfo && oUserInfo.email) {
                this._loadApprovalItems(oUserInfo.email, oUserInfo.role);
            }
            this.getView().byId("detailContainer").setVisible(false);
            this.getView().byId("emptyState").setVisible(true);
        },

        onApprove: function () {
            var oWF = this.getView().getModel("workflowData").getData();
            var oUser = this.getView().getModel("userInfo").getData();
            if (!oWF || !oWF.ID) { MessageBox.error("Please select a request first."); return; }
            if (oWF.status !== "pending") { MessageBox.warning("This request is no longer pending."); return; }
            var that = this;
            MessageBox.confirm("Are you sure you want to approve this Business Partner?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._processApproval(oWF.ID, "approve", oUser.email);
                    }
                }
            });
        },

        onReject: function () {
            var oWF = this.getView().getModel("workflowData").getData();
            var oUser = this.getView().getModel("userInfo").getData();
            if (!oWF || !oWF.ID) { MessageBox.error("Please select a request first."); return; }
            if (oWF.status !== "pending") { MessageBox.warning("This request is no longer pending."); return; }
            var that = this;
            MessageBox.confirm("Are you sure you want to reject this request?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._processApproval(oWF.ID, "reject", oUser.email);
                    }
                }
            });
        },

        _processApproval: function (sWorkflowID, sAction, sApproverEmail) {
            var oModel = this.getOwnerComponent().getModel();
            var that = this;
            this._oBusyDialog.setText(sAction === "approve" ? "Approving Business Partner…" : "Rejecting request…");
            this._oBusyDialog.open();

            var oCtx = oModel.bindContext("/processApproval(...)");
            oCtx.setParameter("workflowID", sWorkflowID);
            oCtx.setParameter("action", sAction);
            oCtx.setParameter("approverEmail", sApproverEmail);

            oCtx.execute().then(function () {
                that._oBusyDialog.close();
                MessageToast.show(sAction === "approve" ? "Approved successfully!" : "Request rejected.");
                that.onRefresh();
            }).catch(function (oErr) {
                that._oBusyDialog.close();
                MessageBox.error("Action failed: " + oErr.message);
            });
        },

        _updateMailOptions: function () {
            var oWF = this.getView().getModel("workflowData").getData();
            if (!oWF || !oWF.ID) return [];
            var aEmails = [];
            try {
                var parsed = JSON.parse(oWF.levelEmails || "{}");
                Object.keys(parsed).forEach(function (k) {
                    var v = parsed[k];
                    if (Array.isArray(v)) {
                        v.forEach(function (e) { if (e) aEmails.push(e); });
                    } else if (v) {
                        aEmails.push(v);
                    }
                });
            } catch (_) {
                if (oWF.approverEmail) aEmails.push(oWF.approverEmail);
            }
            return aEmails.filter(function (e, i, a) { return a.indexOf(e) === i; });
        },

        onOpenMailPopover: function (oEvent) {
            var oView = this.getView();
            var oFragment = oView.byId("mailPopover");
            if (!oFragment) {
                sap.ui.xmlfragment("bp.cust.ui.fragment.MailPopover", this);
                oFragment = oView.byId("mailPopover");
                oView.addDependent(oFragment);
            }
            var aEmails = this._updateMailOptions();
            oFragment.setModel(new JSONModel({ emails: aEmails }), "mailData");
            oFragment.openBy(oEvent.getSource());
        },

        onSendMail: function () {
            var oFragment = this.getView().byId("mailPopover");
            var oData = oFragment.getModel("mailData").getData();
            var aSelected = (oData.selectedEmails || []).filter(Boolean);
            if (aSelected.length === 0) {
                MessageToast.show("Please select at least one recipient.");
                return;
            }
            var oWF = this.getView().getModel("workflowData").getData();
            var oModel = this.getOwnerComponent().getModel();
            var that = this;
            this._oBusyDialog.setText("Sending email…");
            this._oBusyDialog.open();
            var oCtx = oModel.bindContext("/sendEmail(...)");
            oCtx.setParameter("to", aSelected.join(","));
            oCtx.setParameter("workflowID", oWF.ID);
            oCtx.execute().then(function () {
                that._oBusyDialog.close();
                MessageToast.show("Email sent.");
                oFragment.close();
            }).catch(function (oErr) {
                that._oBusyDialog.close();
                MessageBox.error("Failed to send email: " + oErr.message);
            });
        }
    });
});
