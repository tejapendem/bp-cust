sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, BusyIndicator, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("bp.cust.ui.controller.BaseController", {

        getRouter: function () {
            return this.getOwnerComponent().getRouter();
        },

        getModel: function (sName) {
            return this.getView().getModel(sName) || this.getOwnerComponent().getModel(sName);
        },

        getUserModel: function () {
            return this.getOwnerComponent().getModel("userModel");
        },

        navTo: function (sRoute, oParams) {
            this.getRouter().navTo(sRoute, oParams || {});
        },

        showBusy: function (iDelay) {
            BusyIndicator.show(iDelay || 0);
        },

        hideBusy: function () {
            BusyIndicator.hide();
        },

        toast: function (sMsg) {
            MessageToast.show(sMsg);
        },

        success: function (sMsg, fnAfterClose) {
            MessageBox.success(sMsg, { onClose: fnAfterClose });
        },

        error: function (sMsg, fnAfterClose) {
            MessageBox.error(sMsg, { onClose: fnAfterClose });
        },

        warn: function (sMsg, fnAfterClose) {
            MessageBox.warning(sMsg, { onClose: fnAfterClose });
        },

        confirm: function (sMsg, fnOnOk) {
            MessageBox.confirm(sMsg, {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK && typeof fnOnOk === "function") {
                        fnOnOk();
                    }
                }
            });
        },

        // Refresh a list/table binding by control id
        refreshBinding: function (sControlId, sBindingName) {
            var oControl = this.byId(sControlId);
            if (!oControl) return;
            var oBinding = oControl.getBinding(sBindingName || "items");
            if (oBinding) oBinding.refresh();
        },

        // Format ISO date string to compact local format
        formatDate: function (sValue) {
            if (!sValue) return "";
            var oDate = new Date(sValue);
            if (isNaN(oDate.getTime())) return sValue;
            return oDate.toLocaleString("en-GB", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit"
            });
        },

        // Best-effort error message extraction from various error shapes
        getErrorMessage: function (oError) {
            if (!oError) return "Unknown error";
            if (oError.error && oError.error.message) return oError.error.message;
            try {
                if (oError.responseText) {
                    var oResponse = JSON.parse(oError.responseText);
                    if (oResponse && oResponse.error && oResponse.error.message) {
                        return oResponse.error.message;
                    }
                }
            } catch (e) { /* ignore parse errors */ }
            try {
                var oMM = sap.ui.getCore().getMessageManager();
                var aMsgs = oMM.getMessageModel().getData();
                var aErrs = (aMsgs || []).filter(function (m) {
                    return m.type === "Error" || m.severity === "error";
                }).map(function (m) { return m.message; });
                if (aErrs.length) return aErrs.join("\n");
            } catch (e) { /* ignore */ }
            return oError.message || "Unknown error";
        },

        // Run an OData action and surface any error via MessageBox
        runAction: function (sActionPath, oParams) {
            var oModel = this.getModel();
            var oCtx = oModel.bindContext(sActionPath);
            Object.keys(oParams || {}).forEach(function (k) {
                oCtx.setParameter(k, oParams[k]);
            });
            this.showBusy();
            var that = this;
            return oCtx.execute().then(function () {
                that.hideBusy();
                return oCtx.getBoundContext().getObject();
            }).catch(function (oErr) {
                that.hideBusy();
                that.error(that.getErrorMessage(oErr));
                throw oErr;
            });
        }
    });
});
