sap.ui.define(
    [
        "bp/cust/ui/controller/BaseController",
        "sap/ui/model/json/JSONModel",
        "sap/ui/core/Fragment"
    ],
    function (BaseController, JSONModel, Fragment) {
        "use strict";

        return BaseController.extend("bp.cust.ui.controller.App", {
            onInit: function () {
                var sHostname = window.location.hostname;
                var bIsLocal = sHostname === "localhost" || sHostname === "127.0.0.1" || sHostname.includes("applicationstudio.cloud.sap");
                var bInShell = !!(window.sap && sap.ushell && sap.ushell.Container);

                // Initial default state
                var oUserData = {
                    name: bIsLocal ? "Rajesh Pendem (Local)" : "Guest User",
                    email: bIsLocal ? "rajesh.pendem@canopusgbs.com" : "",
                    role: bIsLocal ? "admin" : "guest",
                    isAdmin: bIsLocal,
                    initials: bIsLocal ? "RP" : "GU",
                    assignedRoles: bIsLocal ? "admin" : "",
                    isRegistered: bIsLocal,
                    pendingApprovals: 0,
                    pendingRequests: 0,
                    showAppHeader: !bInShell,
                    showSidebarToggle: bInShell
                };

                var oUserModel = new JSONModel(oUserData);
                this.getOwnerComponent().setModel(oUserModel, "userModel");

                // Always try to fetch the actual user info from the database
                this._checkUserInfo();

                // Refresh pending counts whenever the route changes (admin pages)
                this.getRouter().attachRouteMatched(this._onAnyRouteMatched, this);

                // Apply density class
                this.getView().addStyleClass("sapUiSizeCompact");

                // Restore saved theme
                this._restoreTheme();
            },

            _onAnyRouteMatched: function () {
                var oUserModel = this.getView().getModel("userModel");
                if (oUserModel && oUserModel.getProperty("/isAdmin")) {
                    this._loadPendingCounts();
                }
            },

            _checkUserInfo: function () {
                var oUserModel = this.getView().getModel("userModel");
                var oODataModel = this.getOwnerComponent().getModel();
                var that = this;

                // Call the backend function to get the logged-in user details
                var oCtx = oODataModel.bindContext("/getUserInfo(...)");
                oCtx.execute().then(function () {
                    var oData = oCtx.getBoundContext().getObject();
                    console.log("[Frontend] getUserInfo response:", JSON.stringify(oData));
                    if (oData && oData.email) {
                        oUserModel.setProperty("/email", oData.email);
                        oUserModel.setProperty("/name", oData.name);
                        oUserModel.setProperty("/role", oData.role);
                        oUserModel.setProperty("/isAdmin", oData.isAdmin);
                        oUserModel.setProperty("/initials", (oData.name || "GU").substring(0, 2).toUpperCase());
                        oUserModel.setProperty("/assignedRoles", oData.role);
                        oUserModel.setProperty("/isRegistered", oData.isRegistered);

                        console.log("[Frontend] User updated - role:", oData.role, "isAdmin:", oData.isAdmin, "isRegistered:", oData.isRegistered);

                        // If user is not registered (new user), show request access dialog
                        if (oData.isRegistered === false) {
                            that._showRequestAccessDialog();
                        }

                        // Load pending counts for admin users
                        if (oData.isAdmin) {
                            that._loadPendingCounts();
                        }
                    } else {
                        // Guest user - show request access dialog automatically
                        that._showRequestAccessDialog();
                    }
                }).catch(function (oErr) {
                    // If it fails, we keep the default local/guest state
                    console.log("UserInfo fetch skipped or failed: using defaults.");
                    // Show request access for guest
                    that._showRequestAccessDialog();
                });
            },

            _showRequestAccessDialog: function () {
                var oView = this.getView();
                if (!this._pRequestDialog) {
                    this._pRequestDialog = Fragment.load({
                        id: oView.getId(),
                        name: "bp.cust.ui.view.fragments.RequestAccess",
                        controller: this
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        return oDialog;
                    });
                }
                this._pRequestDialog.then(function (oDialog) {
                    oDialog.open();
                });
            },

            // Fetch admin pending counts for sidebar badges
            _loadPendingCounts: function () {
                var oUserModel = this.getView().getModel("userModel");
                var oODataModel = this.getOwnerComponent().getModel();
                if (!oODataModel) return;

                var oCtx = oODataModel.bindContext("/getAdminStats(...)");
                oCtx.execute().then(function () {
                    var oData = oCtx.getBoundContext().getObject();
                    if (oData) {
                        oUserModel.setProperty("/pendingApprovals", oData.pendingWorkflows || 0);
                        oUserModel.setProperty("/pendingRequests", oData.pendingRequests || 0);
                    }
                }).catch(function () { /* silently ignore */ });
            },

            // Public — let other controllers refresh after they take an action
            refreshPendingCounts: function () {
                this._loadPendingCounts();
            },

            onSideNavButtonPress: function () {
                var oToolPage = this.byId("toolPage");
                var bSideExpanded = oToolPage.getSideExpanded();
                oToolPage.setSideExpanded(!bSideExpanded);
                this._updateCollapseIcon(!bSideExpanded);
            },

            _updateCollapseIcon: function (bExpanded) {
                var oSideNav = this.byId("sideNavigation");
                if (!oSideNav) return;
                var oFixedNavList = oSideNav.getFixedItem();
                if (!oFixedNavList || !oFixedNavList.getItems) return;
                oFixedNavList.getItems().forEach(function (oItem) {
                    if (oItem.getKey() === "_collapse") {
                        oItem.setIcon(bExpanded ? "sap-icon://close-command-field" : "sap-icon://open-command-field");
                        oItem.setText(bExpanded ? "Collapse Sidebar" : "Expand Sidebar");
                    }
                });
            },

            onThemeSwitch: function (oEvent) {
                var bState = oEvent.getParameter("state"); // true for Dark, false for Light
                var sTheme = bState ? "sap_horizon_dark" : "sap_horizon";
                sap.ui.getCore().applyTheme(sTheme);
                // Toggle data-theme on body so our custom CSS can react too
                document.body.setAttribute("data-theme", bState ? "dark" : "light");
                // Persist preference
                try { localStorage.setItem("bp-cust-theme", bState ? "dark" : "light"); } catch (e) {}
            },

            _restoreTheme: function () {
                try {
                    var sSaved = localStorage.getItem("bp-cust-theme");
                    var bDark = sSaved === "dark";
                    if (bDark) {
                        sap.ui.getCore().applyTheme("sap_horizon_dark");
                    }
                    document.body.setAttribute("data-theme", bDark ? "dark" : "light");
                    var oSwitch = this.byId("themeSwitch");
                    if (oSwitch) oSwitch.setState(bDark);
                } catch (e) { /* ignore */ }
            },

            onItemSelect: function (oEvent) {
                var oUserModel = this.getView().getModel("userModel");
                var bIsRegistered = oUserModel.getProperty("/isRegistered");
                var bIsAdmin = oUserModel.getProperty("/isAdmin");
                var sRole = oUserModel.getProperty("/role");

                // Block navigation for non-registered users
                if (!bIsRegistered) {
                    sap.m.MessageBox.warning("You need to request access to use this application.");
                    return;
                }

                var sKey = oEvent.getParameter("item").getKey();

                if (sKey === "_collapse") {
                    this.onSideNavButtonPress();
                    return;
                }

                // Admin-only pages - ensure route names match manifest.json exactly
                if (sKey === "dashboard") {
                    if (!bIsAdmin) { sap.m.MessageBox.warning("Access Denied"); return; }
                    this.getOwnerComponent().getRouter().navTo("Dashboard");
                } else if (sKey === "queue") {
                    if (!bIsAdmin) { sap.m.MessageBox.warning("Access Denied"); return; }
                    this.getOwnerComponent().getRouter().navTo("ActivationQueue");
                } else if (sKey === "admin") {
                    if (!bIsAdmin) { sap.m.MessageBox.warning("Access Denied"); return; }
                    this.getOwnerComponent().getRouter().navTo("Admin");
                } else if (sKey === "approvalLevels") {
                    if (!bIsAdmin) { sap.m.MessageBox.warning("Access Denied"); return; }
                    this.getOwnerComponent().getRouter().navTo("ApprovalLevels");
                } else if (sKey === "approvalInbox") {
                    if (!bIsAdmin) { sap.m.MessageBox.warning("Access Denied"); return; }
                    this.getOwnerComponent().getRouter().navTo("ApprovalInbox");
                } else if (sKey === "approvalData") {
                    if (!bIsAdmin) { sap.m.MessageBox.warning("Access Denied"); return; }
                    this.getOwnerComponent().getRouter().navTo("ApprovalData");
                } else if (sKey === "home") {
                    this.getOwnerComponent().getRouter().navTo("Main");
                } else if (sKey === "createBP") {
                    this.getOwnerComponent().getRouter().navTo("Wizard");
                }
            },

            onProfilePress: function (oEvent) {
                var oButton = oEvent.getSource();
                var oView = this.getView();

                if (!this._pProfilePopover) {
                    this._pProfilePopover = Fragment.load({
                        id: oView.getId(),
                        name: "bp.cust.ui.view.fragments.ProfilePopover",
                        controller: this
                    }).then(function (oPopover) {
                        oView.addDependent(oPopover);
                        return oPopover;
                    });
                }
                this._pProfilePopover.then(function (oPopover) {
                    oPopover.openBy(oButton);
                });
            },

            onRoleToggle: function (oEvent) {
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

            onManageAccessPress: function () {
                var oView = this.getView();
                if (!this._pRequestDialog) {
                    this._pRequestDialog = Fragment.load({
                        id: oView.getId(),
                        name: "bp.cust.ui.view.fragments.RequestAccess",
                        controller: this
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        return oDialog;
                    });
                }
                this._pRequestDialog.then(function (oDialog) {
                    oDialog.open();
                });
            },

            onCancelRequest: function () {
                this.byId("requestAccessDialog").close();
            },

            onSubmitRequest: function () {
                var oView = this.getView();
                var oModel = oView.getModel();

                var sName = this.byId("requestName").getValue();
                var sEmail = this.byId("requestEmail").getValue();
                var sRequestedRole = this.byId("requestedRole").getSelectedKey();
                var sReason = this.byId("requestReason").getValue();

                if (!sName || !sEmail || !sReason) {
                    sap.m.MessageBox.error("Please fill in all mandatory fields.");
                    return;
                }

                var oPayload = {
                    userEmail: sEmail,
                    userName: sName,
                    requestedRole: sRequestedRole,
                    reason: sReason,
                    status: "pending"
                };

                var oListBinding = oModel.bindList("/AccessRequests", null, null, null, { $$updateGroupId: "$auto" });
                oListBinding.create(oPayload);

                sap.m.MessageToast.show("Access request submitted successfully.");
                this.byId("requestAccessDialog").close();
            },

            onLogoutPress: function () {
                window.location.href = "/logout";
            }
        });
    }
);
