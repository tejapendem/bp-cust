// sap.ui.define([
//     "sap/ui/core/mvc/Controller",
//     "sap/ui/model/Filter",
//     "sap/ui/model/FilterOperator"
// ], function (Controller, Filter, FilterOperator) {

//     "use strict";
//     return Controller.extend("bp.cust.ui.controller.Main", {
//         onCreatepress: function () {
//             this.getOwnerComponent().getRouter().navTo("Wizard");
//         },
//         onSearch: function (oEvent) {
//             var sQuery = oEvent.getParameter("query");
//             var oTable = this.byId("bpTable");
//             var oBinding = oTable.getBinding("items");

//             if (sQuery) {
//                 var aFilters = [
//                     new Filter("Name", FilterOperator.Contains, sQuery),
//                     new Filter("BusinessPartnerNumber", FilterOperator.Contains, sQuery)
//                 ];
//                 oBinding.filter(new Filter({
//                     filters: aFilters,
//                     and: false
//                 }));
//             } else {
//                 oBinding.filter([]);
//             }
//         },
//         onClear: function () {
//             this.byId("filterID").setValue("");
//             this.byId("filterCategory").setValue("");
//             this.byId("filterName").setValue("");
//             this.byId("filterGrouping").setSelectedKey("");
//             this.byId("filterGrouping").setValue("");
//             var oBinding = this.byId("bpTable").getBinding("items");
//             if (oBinding) {
//                 oBinding.filter([]);
//             }
//         },
//         onItemPress: function (oEvent) {
//             // Optional: View details

//         }
//     });
// });


sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("bp.cust.ui.controller.Main", {

        onCreatepress: function () {
            this.getOwnerComponent().getRouter().navTo("Wizard");
        },

        // ─────────────────────────────────────────────
        // MULTI-FIELD FILTER LOGIC
        // ─────────────────────────────────────────────
        onSearch: function () {
            // 1. Get values from the individual FilterBar inputs
            var sCompanyCode = this.byId("filterCompanyCode").getValue();
            var sSalesArea = this.byId("filterSalesArea").getValue();
            var sBPRole = this.byId("filterBPRole").getValue();
            var sGrouping = this.byId("filterGrouping").getSelectedKey(); // Using getSelectedKey for dropdown

            var aFilters = [];

            // 2. Add filters only if the user typed/selected something
            if (sCompanyCode) {
                aFilters.push(new Filter("CompanyCode", FilterOperator.Contains, sCompanyCode));
            }
            if (sSalesArea) {
                aFilters.push(new Filter("SalesOrganization", FilterOperator.Contains, sSalesArea));
            }
            if (sBPRole) {
                aFilters.push(new Filter("BPRole", FilterOperator.Contains, sBPRole));
            }
            if (sGrouping) {
                // Using EQ (Equals) because the dropdown values match the backend exactly
                aFilters.push(new Filter("Grouping", FilterOperator.EQ, sGrouping));
            }

            // 3. Apply to table binding
            var oTable = this.byId("bpTable");
            var oBinding = oTable.getBinding("items");

            if (aFilters.length > 0) {
                // Combine all filters with AND logic
                oBinding.filter(new Filter({
                    filters: aFilters,
                    and: true
                }));
            } else {
                oBinding.filter([]); // Show all if search is empty
            }
        },

        onClear: function () {
            // 1. Clear all inputs visually
            this.byId("filterCompanyCode").setValue("");
            this.byId("filterSalesArea").setValue("");
            this.byId("filterBPRole").setValue("");
            this.byId("filterGrouping").setSelectedKey(""); // Reset dropdown

            // 2. Clear the table binding to show all records
            var oBinding = this.byId("bpTable").getBinding("items");
            if (oBinding) {
                oBinding.filter([]);
            }
        },

        onItemPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oBindingContext = oItem.getBindingContext();

            if (oBindingContext) {
                // Safely extract the UUID directly from the OData context
                var sId = oBindingContext.getProperty("ID");

                this.getOwnerComponent().getRouter().navTo("WizardEdit", {
                    bpID: sId
                });
            }
        }
    });
});