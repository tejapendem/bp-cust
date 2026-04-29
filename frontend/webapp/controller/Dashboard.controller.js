sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {
    "use strict";

    return Controller.extend("bp.cust.ui.controller.Dashboard", {

        onInit: function () {
            var oStatsModel = new JSONModel({
                activeBPs: 0,
                draftBPs: 0,
                totalAdmins: 0,
                totalViewers: 0,
                pendingRequests: 0
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
        }

    });
});
