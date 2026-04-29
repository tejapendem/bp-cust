sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (Controller, MessageBox, MessageToast, Fragment) {
    "use strict";

    return Controller.extend("bp.cust.ui.controller.ActivationQueue", {

        onInit: function () {
            this._currentVHEntity = "";
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("Main");
        },

        onToggleActive: function (oEvent) {
            var bActive = oEvent.getParameter("state");
            var oBindingContext = oEvent.getSource().getBindingContext();
            
            // The OData V4 model handles the PATCH automatically when we set the property
            // if the binding is in 'Auto' mode (which it is by default).
            // We just need to make sure we submit the batch if needed, but for simple property sets
            // in a list binding, it usually fires immediately if $$updateGroupId isn't set.
        },

        onAddVH: function (sEntity) {
            this._currentVHEntity = sEntity;
            this._isEditMode = false;
            var oView = this.getView();

            if (!this._pAddDialog) {
                this._pAddDialog = Fragment.load({
                    id: oView.getId(),
                    name: "bp.cust.ui.view.fragments.AddMasterData",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pAddDialog.then(function (oDialog) {
                oDialog.setTitle("Add Master Data");
                this.byId("newVHCode").setEditable(true);
                oDialog.open();
            }.bind(this));
        },

        onEditVH: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            this._currentContext = oContext;
            this._isEditMode = true;
            this._currentVHEntity = oContext.getPath().split("(")[0].substring(1); // Extract entity name
            
            var oView = this.getView();

            if (!this._pAddDialog) {
                this._pAddDialog = Fragment.load({
                    id: oView.getId(),
                    name: "bp.cust.ui.view.fragments.AddMasterData",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pAddDialog.then(function (oDialog) {
                oDialog.setTitle("Edit Master Data");
                this.byId("newVHCode").setValue(oContext.getProperty("code"));
                this.byId("newVHCode").setEditable(false); // Key should not be changed
                this.byId("newVHName").setValue(oContext.getProperty("name"));
                oDialog.open();
            }.bind(this));
        },

        onDeleteVH: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sCode = oContext.getProperty("code");
            var that = this;

            MessageBox.confirm("Are you sure you want to delete " + sCode + "?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        oContext.delete().then(function () {
                            MessageToast.show("Deleted " + sCode);
                        }).catch(function (oErr) {
                            MessageBox.error("Delete failed: " + oErr.message);
                        });
                    }
                }
            });
        },

        onCloseAddVH: function () {
            this.byId("addMasterDataDialog").close();
            this.byId("newVHCode").setValue("");
            this.byId("newVHName").setValue("");
        },

        onRefresh: function () {
            this.getView().getModel().refresh();
            MessageToast.show("Data refreshed");
        },

        onConfirmAddVH: function () {
            var sCode = this.byId("newVHCode").getValue();
            var sName = this.byId("newVHName").getValue();
            var oModel = this.getView().getModel();
            var that = this;

            if (!sCode || !sName) {
                MessageBox.error("Please provide both Code and Name.");
                return;
            }

            if (this._isEditMode) {
                this._currentContext.setProperty("name", sName);
                // OData V4 automatically handles the PATCH
                MessageToast.show("Updated " + sCode);
                this.onCloseAddVH();
            } else {
                var oListBinding = oModel.bindList("/" + this._currentVHEntity);
                var oContext = oListBinding.create({
                    code: sCode,
                    name: sName,
                    isActive: true
                });

                oContext.created().then(function() {
                    MessageToast.show("Successfully added " + sCode);
                    oModel.refresh();
                    that.onCloseAddVH();
                }).catch(function(oErr) {
                    MessageBox.error("Failed to add entry: " + (oErr.message || "Unknown error"));
                });
            }
        }

    });
});
