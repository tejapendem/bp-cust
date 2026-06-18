sap.ui.define([
    "bp/cust/ui/controller/BaseController",
    "sap/m/MessageToast"
], function (BaseController, MessageToast) {
    "use strict";

    return BaseController.extend("bp.cust.ui.controller.Admin", {
        onInit: function () {
            var oUserModel = this.getOwnerComponent().getModel("userModel");
            if (oUserModel && !oUserModel.getProperty("/isAdmin")) {
                sap.m.MessageBox.warning("You don't have permission to access this page.", {
                    onClose: function () {
                        this.getOwnerComponent().getRouter().navTo("Main");
                    }.bind(this)
                });
            }
        },

        onConfigureApprovalLevels: function () {
            this.getOwnerComponent().getRouter().navTo("ApprovalLevels");
        },

        onApprovalInbox: function () {
            this.getOwnerComponent().getRouter().navTo("ApprovalInbox");
        },

        onRefreshUsers: function () {
            this.byId("userTable").getBinding("items").refresh();
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
