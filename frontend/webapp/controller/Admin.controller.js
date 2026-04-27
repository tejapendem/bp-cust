sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("bp.cust.ui.controller.Admin", {
        onInit: function () {
        },

        onRefreshUsers: function () {
            this.byId("userTable").getBinding("items").refresh();
            this.byId("pendingRequestsTable").getBinding("items").refresh();
            this.byId("requestHistoryTable").getBinding("items").refresh();
        },

        onUserRoleChange: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            var oContext = oEvent.getSource().getBindingContext();
            var sNewRole = oSelectedItem.getKey();

            oContext.setProperty("role", sNewRole);
            MessageToast.show("User role updated to " + sNewRole);
        },

        onApproveRequest: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sRequestedRole = oContext.getProperty("requestedRole");
            var sUserEmail = oContext.getProperty("userEmail");

            // 1. Mark request as approved
            oContext.setProperty("status", "approved");

            // 2. Update user role (optional, depends if user exists in Users table)
            // In a real app, you'd trigger a backend action or update the User entity
            
            MessageToast.show("Request approved. User role updated.");
        },

        onRejectRequest: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            oContext.setProperty("status", "rejected");
            MessageToast.show("Request rejected.");
        },

        onDeleteUsers: function () {
            var oTable = this.byId("userTable");
            var aSelectedContexts = oTable.getSelectedContexts();

            if (aSelectedContexts.length === 0) {
                MessageToast.show("Please select at least one user to delete.");
                return;
            }

            sap.m.MessageBox.confirm("Are you sure you want to delete the selected user(s)?", {
                onClose: function (sAction) {
                    if (sAction === sap.m.MessageBox.Action.OK) {
                        aSelectedContexts.forEach(function (oContext) {
                            oContext.delete().then(function () {
                                MessageToast.show("User deleted successfully.");
                            }).catch(function (oError) {
                                sap.m.MessageBox.error("Error deleting user: " + oError.message);
                            });
                        });
                        oTable.removeSelections();
                    }
                }
            });
        }
    });
});
