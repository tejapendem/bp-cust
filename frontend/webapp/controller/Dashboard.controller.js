sap.ui.define([
    "bp/cust/ui/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (BaseController, JSONModel, MessageToast) {
    "use strict";

    return BaseController.extend("bp.cust.ui.controller.Dashboard", {

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

            var oStatsModel = new JSONModel({
                activeBPs: 0,
                draftBPs: 0,
                totalAdmins: 0,
                totalViewers: 0,
                approvalLevelsCount: 0,
                pendingWorkflows: 0,
                approvedWorkflows: 0,
                rejectedWorkflows: 0
            });
            this.getView().setModel(oStatsModel, "stats");

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("Dashboard").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function () {
            this.loadStats();
        },

        loadStats: function () {
            var oModel = this.getView().getModel();
            var oStatsModel = this.getView().getModel("stats");
            
            var oActionContext = oModel.bindContext("/getAdminStats(...)");
            
            oActionContext.execute().then(function () {
                var oData = oActionContext.getBoundContext().getObject();
                oStatsModel.setData(oData);
            }.bind(this)).catch(function (oError) {
                console.error("Failed to load admin stats", oError);
            });
        },

        onRefresh: function () {
            this.loadStats();
            MessageToast.show("Dashboard updated");
        },

        onNavToPartners: function () {
            this.getOwnerComponent().getRouter().navTo("Main");
        },

        onNavToUsers: function () {
            this.getOwnerComponent().getRouter().navTo("Admin");
        },

        onNavToQueue: function () {
            this.getOwnerComponent().getRouter().navTo("ActivationQueue");
        },

        onNavToApprovalLevels: function () {
            this.getOwnerComponent().getRouter().navTo("ApprovalLevels");
        },

        onNavToApprovalInbox: function () {
            this.getOwnerComponent().getRouter().navTo("ApprovalInbox");
        }

    });
});
