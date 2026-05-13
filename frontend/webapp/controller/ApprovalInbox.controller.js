sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter"
], function (Controller, JSONModel, MessageToast, MessageBox, Filter) {
    "use strict";

    return Controller.extend("bp.cust.ui.controller.ApprovalInbox", {
        onInit: function () {
            // Access control - only admins can access this page
            var oUserModel = this.getOwnerComponent().getModel("userModel");
            if (oUserModel) {
                var bIsAdmin = oUserModel.getProperty("/isAdmin");
                if (!bIsAdmin) {
                    sap.m.MessageBox.warning("You don't have permission to access this page.", {
                        onClose: function () {
                            this.getOwnerComponent().getRouter().navTo("Main");
                        }.bind(this)
                    });
                }
            }

            this.getView().setModel(new JSONModel({}), "selectedBP");
            this.getView().setModel(new JSONModel({}), "userInfo");
            this.getView().setModel(new JSONModel({}), "workflowData");
            this.getView().setModel(new JSONModel([]), "approvalList");

            // Get current user info and load their inbox
            this._loadUserInfo();
        },

        _loadUserInfo: function () {
            var oModel = this.getOwnerComponent().getModel();
            var that = this;

            // Use OData V4 deferred binding for function imports
            var oCtx = oModel.bindContext("/getUserInfo(...)");

            oCtx.execute().then(function () {
                var oData = oCtx.getBoundContext().getObject();
                that.getView().getModel("userInfo").setData(oData);
                console.log("Current user:", oData.email, "Role:", oData.role);

                // Load workflow items based on user role
                that._loadApprovalItems(oData.email, oData.role);
            }).catch(function (oError) {
                console.error("Failed to get user info:", oError);
                // Fallback: use default user info from App controller
                var oUserModel = that.getView().getModel("userModel");
                if (oUserModel) {
                    var oData = oUserModel.getData();
                    that.getView().getModel("userInfo").setData({
                        email: oData.email,
                        role: oData.role
                    });
                    that._loadApprovalItems(oData.email, oData.role);
                }
            });
        },

        _loadApprovalItems: function (sUserEmail, sRole) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel();
            var sStatus = this.getView().byId("approvalTabBar").getSelectedKey() || "pending";

            console.log("Loading items for:", sUserEmail, "role:", sRole, "status:", sStatus);

            // Fetch ApprovalWorkflows with businessPartner and logs expanded
            var oListBinding = oModel.bindList("/ApprovalWorkflows", null, null, [
                new Filter("status", "EQ", sStatus)
            ], {
                $expand: "businessPartner,logs"
            });

            oListBinding.requestContexts().then(function (aContexts) {
                var aItems = aContexts.map(function (oContext) {
                    return oContext.getObject();
                });
                console.log("Approval workflows found:", aItems.length);
                that._loadBPDetails(aItems);
            }).catch(function (oError) {
                console.error("Error loading workflows:", oError);
                MessageBox.error("Failed to load approval items");
            });
        },

        onFilterSelect: function () {
            var oUserInfo = this.getView().getModel("userInfo").getData();
            if (oUserInfo && oUserInfo.email) {
                this._loadApprovalItems(oUserInfo.email, oUserInfo.role);
            }
            this.getView().byId("detailContainer").setVisible(false);
        },

        _loadBPDetails: function (aWorkflows) {
            var oUserInfo = this.getView().getModel("userInfo").getData();
            var aResults = [];

            aWorkflows.forEach(function (oWorkflow) {
                var oBP = oWorkflow.businessPartner;
                if (oBP) {
                    aResults.push({
                        ID: oWorkflow.ID,
                        currentLevel: oWorkflow.currentLevel,
                        status: oWorkflow.status,
                        approverEmail: oWorkflow.approverEmail,
                        businessPartner_ID: oWorkflow.businessPartner_ID,
                        bpName: oBP.Name,
                        bpNumber: oBP.BusinessPartnerNumber,
                        bpType: oBP.BPType,
                        bpEmail: oBP.Email,
                        bpCategory: oBP.BusinessPartnerCategory,
                        bpGrouping: oBP.Grouping,
                        bpMobile: oBP.MobileNumber,
                        bpCountry: oBP.Country,
                        logs: oWorkflow.logs || []
                    });
                }
            });

            // Filter by approver if not admin and status is pending
            var sStatus = this.getView().byId("approvalTabBar").getSelectedKey() || "pending";
            if (oUserInfo.role !== 'admin' && sStatus === 'pending') {
                aResults = aResults.filter(function (item) {
                    return item.approverEmail === oUserInfo.email;
                });
            }

            this.getView().getModel("approvalList").setData(aResults);
            console.log("Final approval list:", aResults.length);
        },

        onBPSelect: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (!oSelectedItem) return;

            var oCtx = oSelectedItem.getBindingContext("approvalList");
            if (!oCtx) return;

            var oData = oCtx.getObject();

            this.getView().getModel("workflowData").setData(oData);

            var oBPData = {
                Name: oData.bpName,
                BusinessPartnerNumber: oData.bpNumber,
                BusinessPartnerCategory: oData.bpCategory || "",
                Grouping: oData.bpGrouping || "",
                Email: oData.bpEmail,
                MobileNumber: oData.bpMobile || "",
                Country: oData.bpCountry || ""
            };

            this.getView().getModel("selectedBP").setData(oBPData);
            this.getView().byId("detailContainer").setVisible(true);

            this._updateWorkflowProgress(oData);
        },

        _updateWorkflowProgress: function (oWorkflowData) {
            var oModel = this.getOwnerComponent().getModel();
            var that = this;
            
            // 1. Get all Approval Levels
            var oLevelsBinding = oModel.bindList("/ApprovalLevels", null, null, null, { $orderby: "level" });
            oLevelsBinding.requestContexts().then(function (aLevelContexts) {
                var aLevels = aLevelContexts.map(c => c.getObject());
                
                // 2. Get Logs from the workflow data
                var aLogs = oWorkflowData.logs || [];
                
                // 3. Map status for each level
                var aSteps = aLevels.map(function (oLevel) {
                    var oLog = aLogs.find(l => l.level === oLevel.level);
                    var sStatus = "Pending";
                    
                    if (oWorkflowData.status === 'approved') {
                        sStatus = "Approved";
                    } else if (oWorkflowData.status === 'rejected' && oLog && (oLog.action === 'reject' || oLog.action === 'rejected')) {
                        sStatus = "Rejected";
                    } else if (oLog && (oLog.action === 'approve' || oLog.action === 'approved')) {
                        sStatus = "Approved";
                    } else if (oWorkflowData.status === 'pending' && oWorkflowData.currentLevel === oLevel.level) {
                        sStatus = "Awaiting";
                    } else if (oWorkflowData.status === 'pending' && oLevel.level < oWorkflowData.currentLevel) {
                        sStatus = "Approved";
                    }
                    
                    return {
                        level: oLevel.level,
                        levelName: oLevel.levelName,
                        email: oLevel.email,
                        status: sStatus
                    };
                });
                
                that.getView().setModel(new JSONModel(aSteps), "progressData");
            });
        },


        onRefresh: function () {
            var oUserInfo = this.getView().getModel("userInfo").getData();
            if (oUserInfo && oUserInfo.email) {
                this._loadApprovalItems(oUserInfo.email, oUserInfo.role);
            }
            this.getView().byId("detailContainer").setVisible(false);
        },

        onApprove: function () {
            var oWorkflowData = this.getView().getModel("workflowData").getData();
            var oUserInfo = this.getView().getModel("userInfo").getData();
            var that = this;

            if (!oWorkflowData || !oWorkflowData.ID) {
                MessageBox.error("Please select a request first");
                return;
            }

            MessageBox.confirm("Are you sure you want to approve this Business Partner?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._processApproval(oWorkflowData.ID, oWorkflowData.businessPartner_ID, 'approve', oUserInfo.email);
                    }
                }
            });
        },

        onReject: function () {
            var oWorkflowData = this.getView().getModel("workflowData").getData();
            var oUserInfo = this.getView().getModel("userInfo").getData();
            var that = this;

            if (!oWorkflowData || !oWorkflowData.ID) {
                MessageBox.error("Please select a request first");
                return;
            }

            MessageBox.confirm("Are you sure you want to reject this request?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._processApproval(oWorkflowData.ID, oWorkflowData.businessPartner_ID, 'reject', oUserInfo.email);
                    }
                }
            });
        },

        _processApproval: function (sWorkflowID, sBPID, sAction, sApproverEmail) {
            var oModel = this.getOwnerComponent().getModel();
            var that = this;

            var oCtx = oModel.bindContext("/processApproval(...)");

            oCtx.setParameter("workflowID", sWorkflowID);
            oCtx.setParameter("action", sAction);
            oCtx.setParameter("approverEmail", sApproverEmail);

            oCtx.execute().then(function () {
                var sMsg = sAction === 'approve' ? "Approved successfully!" : "Request rejected";
                MessageToast.show(sMsg);
                that.onRefresh();
            }).catch(function (oError) {
                MessageBox.error("Action failed: " + oError.message);
            });
        }
    });
});