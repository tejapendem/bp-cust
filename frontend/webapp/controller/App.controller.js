sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/model/json/JSONModel",
        "sap/ui/core/Fragment"
    ],
    function(BaseController, JSONModel, Fragment) {
      "use strict";
  
      return BaseController.extend("bp.cust.ui.controller.App", {
        onInit: function() {
            var bIsLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
            
            // Default guest user for deployed version
            var oUserData = {
                name: bIsLocal ? "Rajesh Pendem (Local)" : "Guest User",
                email: bIsLocal ? "rajesh.pendem@canopusgbs.com" : "",
                role: bIsLocal ? "admin" : "guest",
                isAdmin: bIsLocal,
                initials: bIsLocal ? "RP" : "GU",
                assignedRoles: bIsLocal ? "admin" : ""
            };

            var oUserModel = new JSONModel(oUserData);
            this.getView().setModel(oUserModel, "userModel");

            // If deployed, simulate checking for the specific admin user
            if (!bIsLocal) {
                this._checkUserInfo();
            }

            // Apply density class
            this.getView().addStyleClass("sapUiSizeCompact");
        },

        _checkUserInfo: function() {
            var oUserModel = this.getView().getModel("userModel");
            // Simulation: In BTP, the Approuter would pass the user info in headers.
            // We can fetch it via a bound action or from a system attribute.
            // For this demo, we assume 'rajesh.pendem@canopusgbs.com' is the authorized admin.
            
            // If we had a real way to get the logged in email:
            // var sLoggedInEmail = ... 
            // if (sLoggedInEmail === "rajesh.pendem@canopusgbs.com") {
            //     oUserModel.setProperty("/isAdmin", true);
            //     oUserModel.setProperty("/role", "admin");
            //     oUserModel.setProperty("/name", "Rajesh Pendem");
            // }
        },

        onSideNavButtonPress: function() {
            var oToolPage = this.byId("toolPage");
            var bSideExpanded = oToolPage.getSideExpanded();
            oToolPage.setSideExpanded(!bSideExpanded);
        },

        onItemSelect: function(oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            if (sKey === "admin") {
                this.getOwnerComponent().getRouter().navTo("Admin");
            } else if (sKey === "home") {
                this.getOwnerComponent().getRouter().navTo("Main");
            } else if (sKey === "createBP") {
                this.getOwnerComponent().getRouter().navTo("Wizard");
            }
        },

        onProfilePress: function(oEvent) {
            var oButton = oEvent.getSource();
            var oView = this.getView();

            if (!this._pProfilePopover) {
                this._pProfilePopover = Fragment.load({
                    id: oView.getId(),
                    name: "bp.cust.ui.view.fragments.ProfilePopover",
                    controller: this
                }).then(function(oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }
            this._pProfilePopover.then(function(oPopover) {
                oPopover.openBy(oButton);
            });
        },

        onRoleToggle: function(oEvent) {
            var bState = oEvent.getParameter("state");
            var oUserModel = this.getView().getModel("userModel");
            var sNewRole = bState ? "admin" : "viewer";
            oUserModel.setProperty("/role", sNewRole);
            oUserModel.setProperty("/isAdmin", sNewRole === "admin");
            oUserModel.setProperty("/assignedRoles", sNewRole);
            
            if (sNewRole === "viewer") {
                this.getOwnerComponent().getRouter().navTo("Main");
            }
            sap.m.MessageToast.show("Role switched to " + sNewRole);
        },

        onManageAccessPress: function() {
            var oView = this.getView();
            if (!this._pRequestDialog) {
                this._pRequestDialog = Fragment.load({
                    id: oView.getId(),
                    name: "bp.cust.ui.view.fragments.RequestAccess",
                    controller: this
                }).then(function(oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pRequestDialog.then(function(oDialog) {
                oDialog.open();
            });
        },

        onCancelRequest: function() {
            this.byId("requestAccessDialog").close();
        },

        onSubmitRequest: function() {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oUserModel = oView.getModel("userModel");
            
            var sRequestedRole = this.byId("requestedRole").getSelectedKey();
            var sReason = this.byId("requestReason").getValue();

            var oPayload = {
                userEmail: oUserModel.getProperty("/email"),
                userName: oUserModel.getProperty("/name"),
                requestedRole: sRequestedRole,
                reason: sReason,
                status: "pending"
            };

            var oListBinding = oModel.bindList("/AccessRequests");
            oListBinding.create(oPayload);

            sap.m.MessageToast.show("Access request submitted successfully.");
            this.byId("requestAccessDialog").close();
        },

        onLogoutPress: function() {
            sap.m.MessageToast.show("Logging out...");
        }
      });
    }
  );
  