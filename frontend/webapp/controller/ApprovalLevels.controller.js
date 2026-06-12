sap.ui.define([
    "bp/cust/ui/controller/BaseController",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History"
], function (BaseController, MessageToast, MessageBox, History) {
    "use strict";

    return BaseController.extend("bp.cust.ui.controller.ApprovalLevels", {

        formatEmailDisplay: function (sEmail) {
            if (!sEmail) return "";
            try {
                var aEmails = JSON.parse(sEmail);
                if (Array.isArray(aEmails) && aEmails.length > 0) {
                    return aEmails.join(", ");
                }
            } catch (_) {}
            if (typeof sEmail === "string" && sEmail.indexOf("@") > -1) return sEmail;
            return "";
        },

        formatEmailDisplayVisible: function (sEmail) {
            if (!sEmail) return false;
            try {
                var aEmails = JSON.parse(sEmail);
                return Array.isArray(aEmails) && aEmails.length > 0;
            } catch (_) {}
            return typeof sEmail === "string" && sEmail.indexOf("@") > -1;
        },

        formatEmailPlaceholderVisible: function (sEmail) {
            if (!sEmail) return true;
            try {
                var aEmails = JSON.parse(sEmail);
                return !(Array.isArray(aEmails) && aEmails.length > 0);
            } catch (_) {}
            return !(typeof sEmail === "string" && sEmail.indexOf("@") > -1);
        },

        onEmailSelectionChange: function (oEvent) {
            var oMulti = oEvent.getSource();
            var aItems = oMulti.getSelectedItems();
            var aEmails = aItems.map(function (oItem) {
                return oItem.getKey();
            }).filter(Boolean);
            var sJson = JSON.stringify(aEmails);
            var oCtx = oMulti.getBindingContext();
            if (oCtx) {
                oCtx.setProperty("email", sJson);
            }
        },

        _getRowControls: function (oRowItem) {
            var aCells = oRowItem.getCells();
            // Cell index 3 is the VBox containing display texts and MultiComboBox
            var oVBox = aCells[3];
            if (!oVBox) return null;
            var aChildren = oVBox.getItems();
            return {
                displayText: aChildren[0],      // saved emails Text
                placeholderText: aChildren[1],  // "No emails configured" Text
                multiCombo: aChildren[2]        // MultiComboBox
            };
        },

        _restoreComboForRow: function (oMulti, oCtx) {
            if (!oMulti || !oCtx) return;
            var sEmail = oCtx.getProperty("email");
            if (!sEmail) return;
            try {
                var aEmails = JSON.parse(sEmail);
                if (Array.isArray(aEmails) && aEmails.length > 0) {
                    oMulti.setSelectedKeys(aEmails);
                }
            } catch (_) {}
        },

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

            // After the new row renders, open its email combo automatically
            setTimeout(function () {
                var aItems = oTable.getItems();
                var oNewItem = aItems[aItems.length - 1];
                if (oNewItem) {
                    var oControls = this._getRowControls(oNewItem);
                    if (oControls) {
                        oControls.displayText.setVisible(false);
                        oControls.placeholderText.setVisible(false);
                        oControls.multiCombo.setVisible(true);
                    }
                }
            }.bind(this), 200);

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
            var oItem = oEvent.getSource().getParent().getParent();
            var oControls = this._getRowControls(oItem);
            if (oControls) {
                // Switch to edit mode: hide display texts, show MultiComboBox
                oControls.displayText.setVisible(false);
                oControls.placeholderText.setVisible(false);
                oControls.multiCombo.setVisible(true);
                // Pre-select already saved emails
                this._restoreComboForRow(oControls.multiCombo, oControls.multiCombo.getBindingContext());
                oControls.multiCombo.focus();
            }
        },

        onSave: function () {
            var oModel = this.getOwnerComponent().getModel();
            sap.ui.core.BusyIndicator.show(0);
            oModel.submitBatch("$auto").then(function () {
                sap.ui.core.BusyIndicator.hide();
                this._resetAllRowsToDisplayMode();
                MessageBox.success("All changes saved to the backend.");
            }.bind(this)).catch(function (oErr) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Failed to save: " + oErr.message);
            });
        },

        _resetAllRowsToDisplayMode: function () {
            var oTable = this.byId("approvalTable");
            if (!oTable) return;
            oTable.getItems().forEach(function (oRowItem) {
                var oControls = this._getRowControls(oRowItem);
                if (!oControls) return;
                var oCtx = oControls.multiCombo.getBindingContext();
                var sEmail = oCtx ? oCtx.getProperty("email") : "";
                var bHasEmails = false;
                try {
                    var aEmails = JSON.parse(sEmail);
                    bHasEmails = Array.isArray(aEmails) && aEmails.length > 0;
                } catch (_) {}
                oControls.multiCombo.setVisible(false);
                oControls.displayText.setVisible(bHasEmails);
                oControls.placeholderText.setVisible(!bHasEmails);
            }.bind(this));
        }
    });
});
