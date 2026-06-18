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
            var sTab = oBtn.data("tabKey");
            if (!sTab) return;

            this._stopPushPolling();
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
                        sapBPNumber: null,
                        sapPushStatus: null,
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
                var sUserLower = (sUserEmail || "").toLowerCase();
                aResults = aResults.filter(function (item) {
                    var aEmails = [];
                    try { aEmails = JSON.parse(item.approverEmail || "[]"); } catch (_) { aEmails = [item.approverEmail]; }
                    if (!Array.isArray(aEmails)) aEmails = [item.approverEmail];
                    return aEmails.some(function (e) { return (e || "").toLowerCase() === sUserLower; });
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

            this._stopPushPolling();

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

            // For approved items, immediately fetch SAP push status (stored outside CDS view)
            if (oData.status === "approved") {
                this._fetchAndShowSAPStatus(oData.ID);
            }
        },

        _fetchAndShowSAPStatus: function (sWorkflowID) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel();
            var oCtx = oModel.bindContext("/getWorkflowSAPStatus(...)");
            oCtx.setParameter("workflowID", sWorkflowID);
            oCtx.execute().then(function () {
                var oData = oCtx.getBoundContext().getObject();
                var oCurrentWF = that.getView().getModel("workflowData").getData();
                oCurrentWF.sapBPNumber = (oData && oData.sapBPNumber) || null;
                oCurrentWF.sapPushStatus = (oData && oData.sapPushStatus) || null;
                that.getView().getModel("workflowData").setData(oCurrentWF);
                // If still pushing, start polling
                if (oData && oData.sapPushStatus === "Pushing") {
                    that._startPushPolling(sWorkflowID);
                }
            }).catch(function () { /* silently ignore — SAP status is optional */ });
        },

        // Poll the workflow SAP push status via a dedicated function (bypasses the CDS view)
        _startPushPolling: function (sWorkflowID) {
            var that = this;
            this._pushPollInterval = setInterval(function () {
                var oModel = that.getOwnerComponent().getModel();
                var oCtx = oModel.bindContext("/getWorkflowSAPStatus(...)");
                oCtx.setParameter("workflowID", sWorkflowID);
                oCtx.execute().then(function () {
                    var oData = oCtx.getBoundContext().getObject();
                    if (oData && oData.sapPushStatus !== "Pushing") {
                        that._stopPushPolling();
                        var oCurrentWF = that.getView().getModel("workflowData").getData();
                        oCurrentWF.sapBPNumber = oData.sapBPNumber || null;
                        oCurrentWF.sapPushStatus = oData.sapPushStatus;
                        that.getView().getModel("workflowData").setData(oCurrentWF);
                        // Refresh list to update SAP BP No in master list
                        var oUserInfo = that.getView().getModel("userInfo").getData();
                        if (oUserInfo && oUserInfo.email) {
                            that._loadApprovalItems(oUserInfo.email, oUserInfo.role);
                        }
                    }
                }).catch(function () { that._stopPushPolling(); });
            }, 3000);
        },

        _stopPushPolling: function () {
            if (this._pushPollInterval) {
                clearInterval(this._pushPollInterval);
                this._pushPollInterval = null;
            }
            if (this._sapPushPollInterval) {
                clearInterval(this._sapPushPollInterval);
                this._sapPushPollInterval = null;
            }
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
            this._stopPushPolling();
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

                var sResult = "";
                try { sResult = oCtx.getBoundContext().getObject().value || ""; } catch (_) {}

                var bFinalApproval = sAction === "approve" && sResult.indexOf("fully approved") !== -1;

                if (bFinalApproval) {
                    // Final level approved — show SAP push progress dialog and poll for result
                    that._showSAPPushProgress(sWorkflowID);
                } else {
                    MessageToast.show(sAction === "approve" ? "Approved — moved to next level." : "Request rejected.");
                    that.onRefresh();
                }
            }).catch(function (oErr) {
                that._oBusyDialog.close();
                MessageBox.error("Action failed: " + oErr.message);
            });
        },

        _showSAPPushProgress: function (sWorkflowID) {
            var that = this;

            // Show a non-closable busy dialog while SAP push is in progress
            this._oBusyDialog.setText("Approved! Pushing Business Partner to SAP…\nPlease wait while the SAP BP Number is being generated.");
            this._oBusyDialog.open();

            // Update local model to show "Pushing" state in the detail panel
            var oCurrentWF = this.getView().getModel("workflowData").getData();
            oCurrentWF.status = "approved";
            oCurrentWF.sapPushStatus = "Pushing";
            oCurrentWF.sapBPNumber = null;
            this.getView().getModel("workflowData").setData(oCurrentWF);

            // Poll every 3 seconds for the SAP push result
            var iPollCount = 0;
            var iMaxPolls = 40; // 2 minutes max

            this._sapPushPollInterval = setInterval(function () {
                iPollCount++;
                var oModel = that.getOwnerComponent().getModel();
                var oCtx = oModel.bindContext("/getWorkflowSAPStatus(...)");
                oCtx.setParameter("workflowID", sWorkflowID);
                oCtx.execute().then(function () {
                    var oData = oCtx.getBoundContext().getObject();
                    var sPushStatus = oData && oData.sapPushStatus;

                    if (sPushStatus && sPushStatus !== "Pushing") {
                        clearInterval(that._sapPushPollInterval);
                        that._sapPushPollInterval = null;
                        that._oBusyDialog.close();

                        // Update the workflowData model with the result
                        var oWF = that.getView().getModel("workflowData").getData();
                        oWF.sapBPNumber = oData.sapBPNumber || null;
                        oWF.sapPushStatus = sPushStatus;
                        that.getView().getModel("workflowData").setData(oWF);

                        if (sPushStatus === "Pushed") {
                            var sSAPNumber = oData.sapBPNumber || "—";
                            MessageBox.success(
                                "Business Partner successfully created in SAP!\n\nSAP BP Number: " + sSAPNumber,
                                {
                                    title: "SAP Push Successful",
                                    onClose: function () {
                                        that.onRefresh();
                                    }
                                }
                            );
                        } else {
                            MessageBox.error(
                                "The Business Partner was approved but the SAP push failed.\n\nYou can retry the push from the Approval Data page.",
                                {
                                    title: "SAP Push Failed",
                                    onClose: function () {
                                        that.onRefresh();
                                    }
                                }
                            );
                        }
                    } else if (iPollCount >= iMaxPolls) {
                        // Timeout after 2 minutes
                        clearInterval(that._sapPushPollInterval);
                        that._sapPushPollInterval = null;
                        that._oBusyDialog.close();
                        MessageBox.warning(
                            "SAP push is taking longer than expected. The push is still running in the background.\n\nCheck the Approval Data page for the SAP BP Number once it completes.",
                            {
                                title: "SAP Push In Progress",
                                onClose: function () { that.onRefresh(); }
                            }
                        );
                    }
                }).catch(function () {
                    // Ignore poll errors — keep trying
                });
            }, 3000);
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
