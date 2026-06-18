sap.ui.define(
    [
        "bp/cust/ui/controller/BaseController",
        "sap/ui/model/json/JSONModel"
    ],
    function (BaseController, JSONModel) {
        "use strict";

        return BaseController.extend("bp.cust.ui.controller.App", {
            onInit: function () {
                var sHostname = window.location.hostname;
                var bIsLocal = sHostname === "localhost" || sHostname === "127.0.0.1" || sHostname.includes("applicationstudio.cloud.sap");
                var bInShell = !!(window.sap && sap.ushell && sap.ushell.Container);

                var oUserData = {
                    name: bIsLocal ? "Rajesh Pendem (Local)" : "",
                    email: bIsLocal ? "rajesh.pendem@canopusgbs.com" : "",
                    role: bIsLocal ? "admin" : "none",
                    isAdmin: bIsLocal,
                    isViewer: false,
                    hasAccess: bIsLocal,
                    initials: bIsLocal ? "RP" : "",
                    assignedRoles: bIsLocal ? "admin" : "",
                    pendingApprovals: 0,
                    showAppHeader: !bInShell,
                    showSidebarToggle: bInShell
                };

                var oUserModel = new JSONModel(oUserData);
                this.getOwnerComponent().setModel(oUserModel, "userModel");

                this._checkUserInfo();

                this.getRouter().attachRouteMatched(this._onAnyRouteMatched, this);

                this.getView().addStyleClass("sapUiSizeCompact");
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

                var oCtx = oODataModel.bindContext("/getUserInfo(...)");
                oCtx.execute().then(function () {
                    var oData = oCtx.getBoundContext().getObject();
                    console.log("[Frontend] getUserInfo response:", JSON.stringify(oData));

                    if (!oData || !oData.hasAccess) {
                        // No BP_Admin or BP_Viewer role collection — redirect to Access Denied
                        console.log("[Frontend] User has no required role collection — redirecting to AccessDenied");
                        that.getOwnerComponent().getRouter().navTo("AccessDenied");
                        return;
                    }

                    oUserModel.setProperty("/email", oData.email);
                    oUserModel.setProperty("/name", oData.name);
                    oUserModel.setProperty("/role", oData.role);
                    oUserModel.setProperty("/isAdmin", oData.isAdmin);
                    oUserModel.setProperty("/isViewer", oData.isViewer);
                    oUserModel.setProperty("/hasAccess", oData.hasAccess);
                    oUserModel.setProperty("/initials", (oData.name || "U").substring(0, 2).toUpperCase());
                    oUserModel.setProperty("/assignedRoles", oData.role);

                    console.log("[Frontend] User role:", oData.role, "isAdmin:", oData.isAdmin);

                    if (oData.isAdmin) {
                        that._loadPendingCounts();
                    }
                }).catch(function (oErr) {
                    console.error("[Frontend] getUserInfo failed:", oErr);
                    that.getOwnerComponent().getRouter().navTo("AccessDenied");
                });
            },

            _loadPendingCounts: function () {
                var oUserModel = this.getView().getModel("userModel");
                var oODataModel = this.getOwnerComponent().getModel();
                if (!oODataModel) return;

                var oCtx = oODataModel.bindContext("/getAdminStats(...)");
                oCtx.execute().then(function () {
                    var oData = oCtx.getBoundContext().getObject();
                    if (oData) {
                        oUserModel.setProperty("/pendingApprovals", oData.pendingWorkflows || 0);
                    }
                }).catch(function () { /* silently ignore */ });
            },

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
                var bState = oEvent.getParameter("state");
                var sTheme = bState ? "sap_horizon_dark" : "sap_horizon";
                sap.ui.getCore().applyTheme(sTheme);
                document.body.setAttribute("data-theme", bState ? "dark" : "light");
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
                var bIsAdmin = oUserModel.getProperty("/isAdmin");
                var bHasAccess = oUserModel.getProperty("/hasAccess");

                if (!bHasAccess) {
                    this.getOwnerComponent().getRouter().navTo("AccessDenied");
                    return;
                }

                var sKey = oEvent.getParameter("item").getKey();

                if (sKey === "_collapse") {
                    this.onSideNavButtonPress();
                    return;
                }

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
                    this._pProfilePopover = sap.ui.core.Fragment.load({
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

            onLogoutPress: function () {
                window.location.href = "/logout";
            }
        });
    }
);
