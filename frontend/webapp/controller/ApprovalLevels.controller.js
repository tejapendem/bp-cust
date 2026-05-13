sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History"
], function (Controller, MessageToast, MessageBox, History) {
    "use strict";

    return Controller.extend("bp.cust.ui.controller.ApprovalLevels", {
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
            // No need for explicit data loading as it's bound directly in the XML view
        },

        onRefresh: function () {
            this.byId("approvalTable").getBinding("items").refresh();
            MessageToast.show("Data refreshed from backend.");
        },

        onNavBack: function () {
            var oHistory = History.getInstance();
            if (oHistory.getPreviousHash() !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("Admin", {}, true);
            }
        },

        onAddLevel: function () {
            var oTable = this.byId("approvalTable");
            var oBinding = oTable.getBinding("items");
            var iCount = oBinding.getLength();

            oBinding.create({
                level: iCount + 1,
                levelName: "Level " + (iCount + 1),
                username: "New Approver",
                email: ""
            });

            MessageToast.show("New level added to queue (Unsaved).");
        },

        onDeleteLevel: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            oItem.getBindingContext().delete().then(function () {
                MessageToast.show("Level deleted from database.");
            });
        },

        onSave: function () {
            var oModel = this.getOwnerComponent().getModel();

            if (oModel.hasPendingChanges()) {
                sap.ui.core.BusyIndicator.show(0);
                oModel.submitBatch("$auto").then(function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.success("All changes have been saved to the backend.");
                }).catch(function (oErr) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("Failed to save changes: " + oErr.message);
                });
            } else {
                MessageToast.show("No changes to save.");
            }
        }
    });
});
