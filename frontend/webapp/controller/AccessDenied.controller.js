sap.ui.define([
    "bp/cust/ui/controller/BaseController"
], function (BaseController) {
    "use strict";

    return BaseController.extend("bp.cust.ui.controller.AccessDenied", {
        onLogoutPress: function () {
            window.location.href = "/logout";
        }
    });
});
