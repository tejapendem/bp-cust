sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("bp.cust.ui.controller.Admin", {
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
        },

        onConfigureApprovalLevels: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("ApprovalLevels");
        },

        onApprovalInbox: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("ApprovalInbox");
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
            var oModel = oContext.getModel();

            // 1. Mark request as approved locally
            oContext.setProperty("status", "approved");

            // 2. Submit the change to the backend via OData V4 batch
            oModel.submitBatch("$auto").then(function () {
                MessageToast.show("Request approved. User role updated.");
                this.onRefreshUsers();
            }.bind(this)).catch(function (oError) {
                // Revert local change on failure
                oContext.setProperty("status", "pending");
                sap.m.MessageBox.error("Failed to approve request: " + (oError.message || oError.response?.message));
            });
        },

        onRejectRequest: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oModel = oContext.getModel();

            oContext.setProperty("status", "rejected");

            oModel.submitBatch("$auto").then(function () {
                MessageToast.show("Request rejected.");
                this.onRefreshUsers();
            }.bind(this)).catch(function (oError) {
                oContext.setProperty("status", "pending");
                sap.m.MessageBox.error("Failed to reject request: " + (oError.message || oError.response?.message));
            });
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
