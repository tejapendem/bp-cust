sap.ui.define([
    "bp/cust/ui/controller/BaseController",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History"
], function (BaseController, MessageToast, MessageBox, History) {
    "use strict";

    return BaseController.extend("bp.cust.ui.controller.ApprovalLevels", {
        onInit: function () {
            var oUserModel = this.getOwnerComponent().getModel("userModel");
            if (oUserModel) {
                var bIsAdmin = oUserModel.getProperty("/isAdmin");
                if (!bIsAdmin) {
                    MessageBox.warning("You don't have permission to access this page.", {
                        onClose: function () {
                            this.getOwnerComponent().getRouter().navTo("Main");
                        }.bind(this)
                    });
                }
            }
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
                username: "Approver" + (iCount + 1),
                email: ""
            });

            MessageToast.show("New level added (unsaved).");
        },

        onDeleteRowItem: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            MessageBox.confirm("Delete this approval level?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        oContext.delete().then(function () {
                            MessageToast.show("Level deleted.");
                        });
                    }
                }
            });
        },

        onEditRowItem: function (oEvent) {
            // Inputs are always editable inline; this focuses the first input in the row
            var oItem = oEvent.getSource().getParent().getParent();
            var aCells = oItem.getCells();
            if (aCells[1]) {
                aCells[1].focus();
            }
            MessageToast.show("Edit the fields inline, then click Save Changes.");
        },

        onSave: function () {
            var oModel = this.getOwnerComponent().getModel();
            if (oModel.hasPendingChanges()) {
                sap.ui.core.BusyIndicator.show(0);
                oModel.submitBatch("$auto").then(function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.success("All changes saved to the backend.");
                }).catch(function (oErr) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("Failed to save: " + oErr.message);
                });
            } else {
                MessageToast.show("No changes to save.");
            }
        }
    });
});
