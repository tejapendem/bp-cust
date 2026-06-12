const cds = require('@sap/cds');
const { getDestination } = require('@sap-cloud-sdk/connectivity');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

module.exports = cds.service.impl(async function () {
    this.before('*', async (req) => {
        console.log(`[AUTH DEBUG] User: ${req.user.id}, Roles: ${req.user.roles || 'none'}, IsAuthenticated: ${req.user.id !== 'anonymous'}`);
    });

    // TEST ACTION: Test devlb destination connectivity
    this.on('testDestination', async (req) => {
        const results = { steps: [] };
        try {
            // Step 1: Get destination
            results.steps.push('Fetching destination devlb...');
            const dest = await getDestination({ destinationName: 'devlb' });
            results.destinationUrl = dest?.url || 'N/A';
            results.destinationProxyType = dest?.proxyType || 'N/A';
            results.destinationAuthentication = dest?.authentication || 'N/A';
            results.destinationUser = dest?.username || 'N/A';
            results.steps.push(`Destination resolved: URL=${dest?.url}, ProxyType=${dest?.proxyType}, Auth=${dest?.authentication}, User=${dest?.username}`);

            if (!dest?.url) {
                results.steps.push('ERROR: No URL in destination');
                return results;
            }

            // Step 2: Try $metadata
            results.steps.push(`Fetching: ${dest.url}/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata`);
            try {
                const metaRes = await executeHttpRequest(dest, {
                    method: 'GET',
                    url: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata',
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
                results.steps.push(`$metadata response: HTTP ${metaRes.status}`);
                results.csrfToken = metaRes.headers?.['x-csrf-token'] ? 'YES (length: ' + metaRes.headers['x-csrf-token'].length + ')' : 'NO';
                results.steps.push(`CSRF token: ${results.csrfToken}`);
            } catch (metaErr) {
                results.steps.push(`$metadata FAILED: HTTP ${metaErr.response?.status || 'N/A'} - ${JSON.stringify(metaErr.response?.data || metaErr.message).substring(0, 300)}`);
            }

            return results;
        } catch (err) {
            results.steps.push(`FATAL ERROR: ${err.message}`);
            return results;
        }
    });


    this.before('CREATE', 'BusinessPartners', async (req) => {
        const data = req.data;
        console.log("Incoming CREATE data:", JSON.stringify(data, null, 2));

        // Temporarily disabling strict mandatory checks for debugging
        /*
        if (!data.Name) req.error(400, 'Name is mandatory');
        if (!data.Country) req.error(400, 'Country is mandatory');
        if (!data.SalesOrganization) req.error(400, 'Sales Area (Sales Organization) is mandatory');
        if (!data.CompanyCode) req.error(400, 'Company Code is mandatory');
        if (!data.TaxCategory) req.error(400, 'Tax Category is mandatory');
        */

        // Email format validation
        if (data.Email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.Email)) {
                req.error(400, 'Invalid email format');
            }
        }

        // Phone number format validation (simple numeric check here, could be more robust)
        if (data.MobileNumber) {
            const phoneRegex = /^\d+$/;
            if (!phoneRegex.test(data.MobileNumber)) {
                req.error(400, 'Invalid phone number format, digits only');
            }
        }

        // Tax number validation per category (basic example)
        if (data.TaxNumber && data.TaxNumber.length < 3) {
            req.error(400, 'Tax number is too short');
        }

        // Logic-Based Defaults / Adjustments
        if (data.SalesOrganization === '1000') {
            data.ExchangeRateType = data.ExchangeRateType || 'S';
        } else if (data.SalesOrganization === '2000') {
            data.ExchangeRateType = data.ExchangeRateType || 'SALE';
        }

        data.Currency = data.Currency || 'UGX';
        data.CustomerPricingProcedure = data.CustomerPricingProcedure || '1';
        data.CustomerStatsGroup = data.CustomerStatsGroup || '+';
        data.PaymentTerms = data.PaymentTerms || 'Z001';
        data.Incoterms = data.Incoterms || 'EXW';
        data.OutputTaxCountry = data.OutputTaxCountry || 'UG';
        data.OutputTaxCategory = data.OutputTaxCategory || 'MWST';
        data.CustomerData2 = data.CustomerData2 || '02';

        // Auto-assign
        data.IsBP = true;
        data.IsCustomer = true;

        // 12. Save Logic - Generate sequential S-number
        const { BusinessPartners } = this.entities;
        const lastBP = await SELECT.one.from(BusinessPartners)
            .columns('BusinessPartnerNumber')
            .where({ BusinessPartnerNumber: { like: 'S%' } })
            .orderBy('BusinessPartnerNumber desc');
        let nextSeq = 1;
        if (lastBP && lastBP.BusinessPartnerNumber) {
            const numPart = parseInt(lastBP.BusinessPartnerNumber.substring(1), 10);
            if (!isNaN(numPart)) nextSeq = numPart + 1;
        }
        data.BusinessPartnerNumber = 'S' + String(nextSeq).padStart(5, '0');
    });

    const otps = {}; // Simple in-memory storage for OTPs

    this.on('sendOTP', async (req) => {
        const { mobileNumber } = req.data;
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        otps[mobileNumber] = otp;

        console.log(`[REAL-TIME OTP] Sending OTP ${otp} to mobile: ${mobileNumber}`);

        // INTEGRATION POINT: Here is where you would call your SMS API (Twilio, etc.)
        // Example: await smsService.send(mobileNumber, `Your code is ${otp}`);

        return `OTP sent to ${mobileNumber}`;
    });

    this.on('verifyOTP', async (req) => {
        const { mobileNumber, otp } = req.data;
        if (otps[mobileNumber] && otps[mobileNumber] === otp) {
            delete otps[mobileNumber];
            return true;
        }
        return false;
    });

    // Tax Category → SAP API field mapping
    // Each tax category validates against a different field in the Customer entity
    // Tax Number Validation against external SAP API
    this.on('validateVATNumber', async (req) => {
        const { taxNumber, taxCategory } = req.data;
        if (!taxNumber || !taxNumber.trim()) {
            return { isValid: false, recordCount: 0, message: 'Tax number is required' };
        }
        if (!taxCategory) {
            return { isValid: false, recordCount: 0, message: 'Tax category is required' };
        }

        // Only validate UG categories against the new Taxpayer API
        if (!taxCategory.startsWith('UG')) {
            return { isValid: true, recordCount: 0, message: 'No validation required for this tax category' };
        }

        const sTaxNum = taxNumber.trim().replace(/'/g, "''");

        try {
            let response;
            try {
                const destService = await cds.connect.to('devlb');
                const sApiPath = `/sap/opu/odata/sap/ZAPI_BP_INVOICE_T119_CALL_SRV/TaxpayerSet?sap-client=400&` +
                    `$filter=Tin eq '${sTaxNum}'`;
                response = await destService.get(sApiPath);
            } catch (destErr) {
                console.error(`[TAX VALIDATION] Destination error: ${destErr.message}`);
                return { isValid: false, recordCount: 0, message: `System error: SAP destination 'devlb' unavailable.` };
            }

            const aResults = (response && response.d && response.d.results) || (response && response.value) || [];
            console.log(`[TAX VALIDATION] Found ${aResults.length} taxpayer(s) for Tin: ${sTaxNum}`);

            if (aResults.length > 0) {
                const tp = aResults[0];
                const legalName = (tp.LegalName || '').trim();
                const businessName = (tp.BusinessName || '').trim();
                const contactNumber = (tp.ContactNumber || '').trim();
                const contactEmail = (tp.ContactEmail || '').trim();
                const address = (tp.Address || '').trim();
                const returnMessage = (tp.ReturnMessage || '').trim();

                // If the SAP API is offline (Offline Enabler), allow the user to proceed
                if (returnMessage && returnMessage.toLowerCase().includes('offline')) {
                    return {
                        isValid: true,
                        recordCount: 1,
                        message: 'Validation service offline — proceeding without TIN validation',
                        legalName: 'N/A', businessName: 'N/A', contactNumber: 'N/A', contactEmail: 'N/A', address: 'N/A'
                    };
                }

                // If all fields are N/A or empty, the taxpayer does not exist or state is abnormal
                const allNa = !legalName && !businessName && !contactNumber && !contactEmail && !address;
                if (allNa) {
                    return {
                        isValid: false,
                        recordCount: 0,
                        message: 'The taxpayer does not exist or the state is abnormal!'
                    };
                }

                return {
                    isValid: true,
                    recordCount: aResults.length,
                    message: 'Taxpayer verified successfully',
                    legalName: legalName || 'N/A',
                    businessName: businessName || 'N/A',
                    contactNumber: contactNumber || 'N/A',
                    contactEmail: contactEmail || 'N/A',
                    address: address || 'N/A'
                };
            } else {
                return {
                    isValid: false,
                    recordCount: 0,
                    message: 'The taxpayer does not exist or the state is abnormal!'
                };
            }
        } catch (err) {
            console.error(`[TAX VALIDATION] Error: ${err.message}`);
            return { isValid: false, recordCount: 0, message: `Validation service error: ${err.message}` };
        }
    });

    // Tax Number validation against Customer API (checks category-specific field)
    this.on('validateTaxNumber', async (req) => {
        const { taxNumber, taxCategory } = req.data;
        if (!taxNumber || !taxNumber.trim()) {
            return { isDuplicate: false, message: 'Tax number is required', name: '', streetHouseNo: '', city: '', mobile: '', registrationField: '', registrationValue: '', companyCode: '' };
        }
        if (!taxCategory) {
            return { isDuplicate: false, message: 'Tax category is required', name: '', streetHouseNo: '', city: '', mobile: '', registrationField: '', registrationValue: '', companyCode: '' };
        }

        const fieldMap = { UG01: 'VATRegistrationNumber', UG02: 'IncomeTaxRegNo', UG03: 'NationalID', UG04: 'PassportNumber' };
        const fieldName = fieldMap[taxCategory];
        if (!fieldName) {
            return { isDuplicate: false, message: `No validation required for ${taxCategory}`, name: '', streetHouseNo: '', city: '', mobile: '', registrationField: '', registrationValue: '', companyCode: '' };
        }

        const sTaxNum = taxNumber.trim().replace(/'/g, "''");

        try {
            let response;
            try {
                const destService = await cds.connect.to('devlb');
                const sApiPath = `/sap/opu/odata4/sap/zapi_bp_cust_valid/srvd_a2x/sap/zsd_bpr_cust_valid/0001/Customer?sap-client=400&` +
                    `$filter=${fieldName} eq '${sTaxNum}'`;
                response = await destService.get(sApiPath);
            } catch (destErr) {
                console.error(`[TAX NUMBER VALIDATION] Destination error: ${destErr.message}`);
                return { isDuplicate: false, message: `System error: SAP destination unavailable.`, name: '', customerID: '', streetHouseNo: '', city: '', mobile: '', registrationField: '', registrationValue: '', companyCode: '' };
            }

            const aResults = (response && response.d && response.d.results) || (response && response.value) || [];
            console.log(`[TAX NUMBER VALIDATION] Found ${aResults.length} customer(s) for ${fieldName}: ${sTaxNum}`);

            if (aResults.length > 0) {
                const c = aResults[0];
                return {
                    isDuplicate: true,
                    message: `Tax Number already exists in ${fieldName}`,
                    name: (c.Name || c.CustomerName || '').trim() || 'N/A',
                    customerID: (c.CustomerID || c.CustomerId || '').toString().trim() || 'N/A',
                    streetHouseNo: (c.StreetHouseNo || c.Street_HouseNo || '').trim() || 'N/A',
                    city: (c.City || '').trim() || 'N/A',
                    mobile: (c.Mobile || c.MobileNumber || '').trim() || 'N/A',
                    registrationField: fieldName,
                    registrationValue: (c[fieldName] || '').toString() || 'N/A',
                    companyCode: (c.CompanyCode || '').trim() || 'N/A'
                };
            } else {
                return {
                    isDuplicate: false,
                    message: 'Tax Number not found in any Business Partner - OK to proceed',
                    name: '', customerID: '', streetHouseNo: '', city: '', mobile: '', registrationField: '', registrationValue: '', companyCode: ''
                };
            }
        } catch (err) {
            console.error(`[TAX NUMBER VALIDATION] Error: ${err.message}`);
            return { isDuplicate: false, message: `Validation service error: ${err.message}`, name: '', customerID: '', streetHouseNo: '', city: '', mobile: '', registrationField: '', registrationValue: '', companyCode: '' };
        }
    });

    this.on('searchCustomersByName', async (req) => {
        const { name } = req.data;
        if (!name || name.trim().length < 2) {
            return JSON.stringify([]);
        }
        const sSearch = name.trim().replace(/'/g, "''");
        console.log(`[SUGGESTIONS] Searching for customers matching: ${sSearch}`);

        try {
            const destService = await cds.connect.to('devlb');
            const sApiPath = `/sap/opu/odata4/sap/zapi_bp_cust_valid/srvd_a2x/sap/zsd_bpr_cust_valid/0001/Customer?sap-client=400&$filter=contains(Name, '${sSearch}')&$top=15`;
            const response = await destService.get(sApiPath);
            const aResults = (response && response.value) || [];
            console.log(`[SUGGESTIONS] Found ${aResults.length} records matching: ${sSearch}`);
            return JSON.stringify(aResults);
        } catch (err) {
            console.error(`[SUGGESTIONS] Error with contains filter: ${err.message}`);
            // Fallback: try startswith
            try {
                const destService = await cds.connect.to('devlb');
                const sApiPath = `/sap/opu/odata4/sap/zapi_bp_cust_valid/srvd_a2x/sap/zsd_bpr_cust_valid/0001/Customer?sap-client=400&$filter=startswith(Name, '${sSearch}')&$top=15`;
                const response = await destService.get(sApiPath);
                const aResults = (response && response.value) || [];
                return JSON.stringify(aResults);
            } catch (err2) {
                console.error(`[SUGGESTIONS] Error with startswith filter: ${err2.message}`);
                // Safe fallback: try City eq 'Kampala' and filter in-memory
                try {
                    const destService = await cds.connect.to('devlb');
                    const sApiPath = `/sap/opu/odata4/sap/zapi_bp_cust_valid/srvd_a2x/sap/zsd_bpr_cust_valid/0001/Customer?sap-client=400&$filter=City eq 'Kampala'`;
                    const response = await destService.get(sApiPath);
                    const aResults = (response && response.value) || [];
                    const lowerSearch = sSearch.toLowerCase();
                    const filtered = aResults
                        .filter(item => item.Name && item.Name.toLowerCase().includes(lowerSearch))
                        .slice(0, 15);
                    return JSON.stringify(filtered);
                } catch (err3) {
                    console.error(`[SUGGESTIONS] Fallback failed: ${err3.message}`);
                    return JSON.stringify([]);
                }
            }
        }
    });

    this.on('getUserInfo', async (req) => {
        const userEmail = req.user?.id;
        console.log("[AUTH DEBUG] Starting getUserInfo for:", userEmail);

        if (!userEmail || userEmail === 'anonymous') {
            console.log("[AUTH DEBUG] User is anonymous or missing");
            return { email: "", name: "Guest User", role: "guest", isAdmin: false, isRegistered: false, requestStatus: 'none' };
        }

        let hasAdminScope = false;
        try {
            hasAdminScope = req.user.is('Admin') ||
                req.user.is('admin') ||
                req.user.attr?.role === 'admin' ||
                (Array.isArray(req.user.roles) && req.user.roles.some(r => r.toLowerCase().includes('admin'))) ||
                (Array.isArray(req.user.scopes) && req.user.scopes.some(s => s.toLowerCase().includes('admin')));
            console.log("[AUTH DEBUG] hasAdminScope from JWT:", hasAdminScope);
        } catch (e) {
            console.error("Error checking scopes:", e);
        }

        const { Users, AccessRequests } = this.entities;
        let user;
        try {
            // Case-insensitive lookup for email
            user = await SELECT.one.from(Users).where('LOWER(email) =', userEmail.toLowerCase());
            console.log("[AUTH DEBUG] DB user found:", user ? JSON.stringify(user) : "No");
        } catch (dbErr) {
            console.error("Database query failed (likely schema not deployed):", dbErr.message);
            return { email: userEmail, name: userEmail.split('@')[0], role: 'guest', isAdmin: false, isRegistered: false, requestStatus: 'none' };
        }

        if (user) {
            console.log("[AUTH DEBUG] User found in DB with role:", user.role);
            return {
                email: user.email,
                name: user.name,
                role: user.role,
                isAdmin: user.role === 'admin',
                isRegistered: true,
                requestStatus: 'approved'
            };
        }


        // Check for pending access requests
        const accessRequest = await SELECT.one.from(AccessRequests)
            .where('LOWER(userEmail) =', userEmail.toLowerCase())
            .orderBy('createdAt desc');

        console.log("[AUTH DEBUG] Returning guest with request status:", accessRequest?.status || 'none');
        return {
            email: userEmail,
            name: userEmail.split('@')[0],
            role: 'guest',
            isAdmin: false,
            isRegistered: false,
            requestStatus: accessRequest?.status || 'none'
        };
    });

    this.on('submitForApproval', async (req) => {
        const { bpID } = req.data;
        const { BusinessPartners, ApprovalLevels, ApprovalWorkflows } = this.entities;

        // 1. Get the Business Partner with all compositions expanded
        const bp = await SELECT.one.from(BusinessPartners)
            .where({ ID: bpID })
            .columns(b => {
                b('*'),
                    b.CompanyCodes('*'),
                    b.SalesAreas('*'),
                    b.CreditSegments('*')
            });
        if (!bp) return req.error(404, `Business Partner with ID ${bpID} not found`);

        // 2. Get all approval levels and create a snapshot
        const allLevels = await SELECT.from(ApprovalLevels).orderBy('level');
        if (!allLevels || allLevels.length === 0) return req.error(400, "No approvers configured in Admin settings");

        const levelEmailMap = {};
        for (const l of allLevels) {
            levelEmailMap[l.level] = l.email;
        }

        // 3. Create the Approval Workflow entry with frozen level emails
        // Handle multi-email format: if the email is a JSON array, store as-is
        let level1Email = allLevels[0].email;
        let level1EmailArray = [level1Email];
        try {
            const parsed = JSON.parse(level1Email);
            if (Array.isArray(parsed)) level1EmailArray = parsed;
        } catch (_) { /* single email string */ }

        const workflowEntry = {
            businessPartner_ID: bpID,
            currentLevel: 1,
            status: 'pending',
            approverEmail: level1EmailArray.length > 1 ? JSON.stringify(level1EmailArray) : level1Email,
            levelEmails: JSON.stringify(levelEmailMap)
        };
        await INSERT.into(ApprovalWorkflows).entries(workflowEntry);

        // 4. Update BP status to 'pending_approval'
        await UPDATE(BusinessPartners).set({ LifecycleStatus: 'pending_approval' }).where({ ID: bpID });

        // 5. Generate PDF and Send Email using helper
        const subject = `Approval Required: New Business Partner ${bp.Name}`;
        const html = _getWorkflowEmailTemplate(
            "Approval Required",
            `A new Business Partner creation request for <strong>${bp.Name}</strong> requires your Level 1 approval.`,
            bp,
            true
        );
        const pdfBuffer = await _generateBPPdf(bp);
        level1EmailArray.forEach(email => {
            _sendEmail(email, subject, null, html, pdfBuffer).catch(e =>
                console.error(`[APPROVAL] Background email to Level 1 approver ${email} failed:`, e)
            );
        });

        return `Submitted for Level 1 approval to ${allLevels[0].email}`;
    });

    this.on('getAdminStats', async (req) => {
        const { BusinessPartners, Users, AccessRequests, ApprovalLevels, ApprovalWorkflows } = this.entities;

        const activeBPs = await SELECT.from(BusinessPartners).where({ LifecycleStatus: 'active' });
        const draftBPs = await SELECT.from(BusinessPartners).where({ LifecycleStatus: 'draft' });

        const totalAdmins = await SELECT.from(Users).where({ role: 'admin' });
        const totalViewers = await SELECT.from(Users).where({ role: 'viewer' });

        const pendingRequests = await SELECT.from(AccessRequests).where({ status: 'pending' });

        // New Approval Stats
        const approvalLevels = await SELECT.from(ApprovalLevels);
        const pendingWorkflows = await SELECT.from(ApprovalWorkflows).where({ status: 'pending' });
        const approvedWorkflows = await SELECT.from(ApprovalWorkflows).where({ status: 'approved' });
        const rejectedWorkflows = await SELECT.from(ApprovalWorkflows).where({ status: 'rejected' });

        return {
            activeBPs: activeBPs.length,
            draftBPs: draftBPs.length,
            totalAdmins: totalAdmins.length,
            totalViewers: totalViewers.length,
            pendingRequests: pendingRequests.length,
            approvalLevelsCount: approvalLevels.length,
            pendingWorkflows: pendingWorkflows.length,
            approvedWorkflows: approvedWorkflows.length,
            rejectedWorkflows: rejectedWorkflows.length
        };
    });

    this.before('CREATE', 'AccessRequests', async (req) => {
        if (!req.data.userEmail || !req.data.userEmail.trim()) {
            return req.error(400, 'User email is required to submit an access request');
        }
    });

    this.after('CREATE', 'AccessRequests', async (data) => {
        console.log("SUCCESS: New Access Request created for:", data.userEmail);

        // Notify Admin (Rajesh Pendem) about the new access request
        const adminEmail = 'rajesh.pendem@canopusgbs.com';
        const subject = `New Access Request: ${data.userName}`;
        const text = `User ${data.userName} (${data.userEmail}) has requested ${data.requestedRole} access.`;
        await _sendEmail(adminEmail, subject, text);
    });

    this.after('UPDATE', 'AccessRequests', async (data, req) => {
        if (data.status === 'approved') {
            const { Users, AccessRequests } = this.entities;

            // 1. Fetch the full request data (since 'data' only contains changed fields)
            const fullRequest = await SELECT.one.from(AccessRequests).where({ ID: data.ID });

            if (fullRequest && fullRequest.userEmail && fullRequest.userEmail.trim()) {
                // 2. Promote the user to the Users table
                await UPSERT.into(Users).entries({
                    email: fullRequest.userEmail,
                    name: fullRequest.userName,
                    role: fullRequest.requestedRole,
                    status: 'active'
                });
                console.log(`PROMOTION SUCCESS: User ${fullRequest.userEmail} promoted to ${fullRequest.requestedRole}`);
            }
        }
    });

    // Multi-level Approval Process
    this.on('processApproval', async (req) => {
        const { workflowID, action, approverEmail } = req.data;
        const { ApprovalWorkflows, ApprovalLogs, ApprovalLevels, BusinessPartners } = this.entities;

        console.log(`[APPROVAL] Processing workflow ${workflowID} by ${approverEmail} (Action: ${action})`);

        // 1. Get the workflow entry
        const workflow = await SELECT.one.from(ApprovalWorkflows).where({ ID: workflowID });
        if (!workflow) return req.error(404, "Workflow not found");

        // 2. Verify the approver is the current level approver (supports multi-email)
        let aApproverEmails = [workflow.approverEmail];
        try {
            const parsed = JSON.parse(workflow.approverEmail || "[]");
            if (Array.isArray(parsed)) aApproverEmails = parsed;
        } catch (_) { /* single email string */ }
        if (aApproverEmails.indexOf(approverEmail) === -1) {
            return req.error(403, "You are not authorized to approve this request");
        }

        // 3. Log the action
        await INSERT.into(ApprovalLogs).entries({
            parent_ID: workflowID,
            level: workflow.currentLevel,
            approver: approverEmail,
            action: action,
            timestamp: new Date()
        });

        if (action === 'reject') {
            // 4a. If rejected, update BP status to draft and mark workflow as rejected
            await UPDATE(ApprovalWorkflows).set({ status: 'rejected' }).where({ ID: workflowID });
            await UPDATE(BusinessPartners).set({ LifecycleStatus: 'draft' }).where({ ID: workflow.businessPartner_ID });

            // Send rejection email to requester with full details
            const bp = await SELECT.one.from(BusinessPartners)
                .where({ ID: workflow.businessPartner_ID })
                .columns(b => {
                    b('*'),
                        b.CompanyCodes('*'),
                        b.SalesAreas('*'),
                        b.CreditSegments('*')
                });
            if (bp) {
                const subject = "Your Business Partner request has been rejected";
                const html = _getWorkflowEmailTemplate(
                    "Request Rejected",
                    `Your request for <strong>${bp.Name}</strong> has been rejected by the Level ${workflow.currentLevel} approver.`,
                    bp,
                    false
                );
                const pdfBuffer = await _generateBPPdf(bp);
                _sendEmail(bp.Email, subject, null, html, pdfBuffer).catch(e =>
                    console.error(`[APPROVAL] Background rejection email failed:`, e)
                );
            }

            return "Request rejected";
        }

        // 4b. If approved, check if there's a next level from the frozen snapshot
        const nextLevel = workflow.currentLevel + 1;
        let nextApproverEmail;
        let levelEmails = {};
        try { levelEmails = JSON.parse(workflow.levelEmails || '{}'); } catch (_) { }
        nextApproverEmail = levelEmails[nextLevel];

        // Backfill snapshot for old workflows that were created before the levelEmails feature
        if (!nextApproverEmail && !workflow.levelEmails) {
            const allLevels = await SELECT.from(ApprovalLevels).orderBy('level');
            if (allLevels && allLevels.length > 0) {
                const emailMap = {};
                for (const l of allLevels) {
                    emailMap[l.level] = l.email;
                }
                await UPDATE(ApprovalWorkflows).set({ levelEmails: JSON.stringify(emailMap) }).where({ ID: workflowID });
                levelEmails = emailMap;
                nextApproverEmail = emailMap[nextLevel];
            }
        }

        if (nextApproverEmail) {
            // Handle multi-email for next level
            let aNextEmails = [nextApproverEmail];
            try {
                const parsed = JSON.parse(nextApproverEmail);
                if (Array.isArray(parsed)) aNextEmails = parsed;
            } catch (_) { /* single email string */ }

            // Move to next level
            const nextApproverValue = aNextEmails.length > 1 ? JSON.stringify(aNextEmails) : nextApproverEmail;
            await UPDATE(ApprovalWorkflows).set({
                currentLevel: nextLevel,
                approverEmail: nextApproverValue
            }).where({ ID: workflowID });

            // Send email to next level approver(s) with full details
            const bp = await SELECT.one.from(BusinessPartners)
                .where({ ID: workflow.businessPartner_ID })
                .columns(b => {
                    b('*'),
                        b.CompanyCodes('*'),
                        b.SalesAreas('*'),
                        b.CreditSegments('*')
                });
            const subject = `Approval Required: Level ${nextLevel} - ${bp.Name}`;
            const html = _getWorkflowEmailTemplate(
                "Approval Required",
                `A Business Partner request for <strong>${bp.Name}</strong> requires your Level ${nextLevel} approval.`,
                bp,
                true
            );
            const pdfBuffer = await _generateBPPdf(bp);
            aNextEmails.forEach(email => {
                _sendEmail(email, subject, null, html, pdfBuffer).catch(e =>
                    console.error(`[APPROVAL] Background email to next approver ${email} failed:`, e)
                );
            });
        } else {
            // No more levels - finalize the approval
            await UPDATE(ApprovalWorkflows).set({ status: 'approved' }).where({ ID: workflowID });
            await UPDATE(BusinessPartners).set({ LifecycleStatus: 'active' }).where({ ID: workflow.businessPartner_ID });

            // Send approval email to requester
            const bp = await SELECT.one.from(BusinessPartners)
                .where({ ID: workflow.businessPartner_ID })
                .columns(b => {
                    b('*'),
                        b.CompanyCodes('*'),
                        b.SalesAreas('*'),
                        b.CreditSegments('*')
                });
            if (bp) {
                const subject = "Business Partner Approved!";
                const html = _getWorkflowEmailTemplate(
                    "Business Partner Approved",
                    `Your Business Partner request for <strong>${bp.Name}</strong> has been fully approved and is now active.`,
                    bp,
                    false
                );
                const pdfBuffer = await _generateBPPdf(bp);
                _sendEmail(bp.Email, subject, null, html, pdfBuffer).catch(e =>
                    console.error(`[APPROVAL] Background email to requester failed:`, e)
                );
            }
        }

        return `Level ${workflow.currentLevel} approval completed${nextApproverEmail ? ', moved to Level ' + nextLevel : ', fully approved'}`;
    });

    // ─── SAP ODATA SCHEMA GENERATOR AND PUSH INTEGRATION ──────────────────

    this.after(['CREATE', 'UPDATE'], 'BusinessPartners', async (data, req) => {
        const bpId = data.ID || req.data.ID;
        if (!bpId) return;

        const { BusinessPartners } = this.entities;

        try {
            // Fetch the fully expanded BP record
            const bp = await SELECT.one.from(BusinessPartners)
                .where({ ID: bpId })
                .columns(b => {
                    b('*'),
                        b.CompanyCodes('*'),
                        b.SalesAreas('*'),
                        b.CreditSegments('*')
                });

            if (bp) {
                console.log(`[PAYLOAD GEN] Generating SAP payloads for BP ID: ${bpId}, BusinessPartnerNumber: ${bp.BusinessPartnerNumber}, SAPBPNumber: ${bp.SAPBPNumber}`);
                const { bpPayload, creditPayload } = generateSAPPayloads(bp);

                console.log("=== SAP BP PAYLOAD ===");
                console.log(JSON.stringify(bpPayload, null, 2));
                console.log("=== END SAP BP PAYLOAD ===");
                console.log("=== SAP CREDIT PAYLOAD ===");
                console.log(JSON.stringify(creditPayload, null, 2));
                console.log("=== END SAP CREDIT PAYLOAD ===");

                await UPDATE(BusinessPartners)
                    .set({
                        SAPBUPAPayload: JSON.stringify(bpPayload, null, 2),
                        SAPCreditPayload: JSON.stringify(creditPayload, null, 2)
                    })
                    .where({ ID: bpId });
                console.log(`[PAYLOAD GEN] Successfully updated payloads in DB`);
            }
        } catch (err) {
            console.error(`[PAYLOAD GEN ERROR] Failed to auto-generate SAP payloads:`, err);
        }
    });

    this.on('pushToSAP', async (req) => {
        const { bpID } = req.data;
        const { BusinessPartners, SAPPushLogs, ApprovalWorkflows } = this.entities;
        const logs = [];

        logs.push(`[${new Date().toLocaleTimeString()}] Initiating push to SAP for Business Partner ID: ${bpID}...`);

        try {
            // 1. Fetch Business Partner details
            const bp = await SELECT.one.from(BusinessPartners).where({ ID: bpID });
            if (!bp) {
                return req.error(404, `Business Partner with ID ${bpID} not found`);
            }

            if (!bp.SAPBUPAPayload) {
                return req.error(400, `SAP Business Partner payload is empty. Please save/update the Business Partner form first.`);
            }

            let bpPayload;
            try {
                bpPayload = JSON.parse(bp.SAPBUPAPayload);
            } catch (e) {
                return req.error(400, `Stored SAP Business Partner payload is invalid JSON: ${e.message}`);
            }

            // 2. Resolve devlb destination via Cloud SDK (handles OnPremise Cloud Connector proxy)
            logs.push(`[${new Date().toLocaleTimeString()}] Connecting to SAP destination 'devlb'...`);
            const dest = await getDestination({ destinationName: 'devlb' });
            if (!dest) throw new Error("Destination 'devlb' not found.");
            logs.push(`[${new Date().toLocaleTimeString()}] Destination resolved: URL=${dest.url}, ProxyType=${dest.proxyType || 'N/A'}, Authentication=${dest.authentication || 'N/A'}`);

            // 3. Fetch CSRF token via Cloud SDK (routes through Cloud Connector for OnPremise)
            logs.push(`[${new Date().toLocaleTimeString()}] Fetching CSRF token from: ${dest.url}/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata`);
            let csrfRes;
            try {
                csrfRes = await executeHttpRequest(dest, {
                    method: 'GET',
                    url: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata',
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
            } catch (csrfErr) {
                const csStatus = csrfErr.response?.status || 'N/A';
                const csBody = JSON.stringify(csrfErr.response?.data || csrfErr.message).substring(0, 500);
                logs.push(`[${new Date().toLocaleTimeString()}] CSRF fetch FAILED: HTTP ${csStatus} - ${csBody}`);
                throw new Error(`CSRF token fetch failed: HTTP ${csStatus} - ${csBody}`);
            }
            const csrfToken = csrfRes.headers['x-csrf-token'] || csrfRes.headers['X-CSRF-Token'] || '';
            const setCookie = csrfRes.headers['set-cookie'] || [];
            const cookie = Array.isArray(setCookie) ? setCookie.map(c => c.split(';')[0]).join('; ') : (setCookie || '').split(';')[0];
            if (!csrfToken) throw new Error('No CSRF token in response from $metadata');
            logs.push(`[${new Date().toLocaleTimeString()}] CSRF token obtained successfully (length: ${csrfToken.length}).`);

            // 4. Post A_BusinessPartner
            logs.push(`[${new Date().toLocaleTimeString()}] Pushing Business Partner payload...`);
            let bpResponse;
            let httpStatus = '';
            try {
                const postRes = await executeHttpRequest(dest, {
                    method: 'POST',
                    url: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner',
                    headers: {
                        'X-CSRF-Token': csrfToken,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(cookie ? { 'Cookie': cookie } : {})
                    },
                    data: bpPayload
                });
                bpResponse = postRes.data;
                logs.push(`[${new Date().toLocaleTimeString()}] Business Partner posted successfully.`);
            } catch (postErr) {
                httpStatus = postErr.response?.status || '';
                const errBody = JSON.stringify(postErr.response?.data || postErr.message).substring(0, 1000);
                const errHeaders = JSON.stringify(postErr.response?.headers || {}).substring(0, 500);
                logs.push(`[${new Date().toLocaleTimeString()}] POST failed: HTTP ${httpStatus}`);
                logs.push(`[${new Date().toLocaleTimeString()}] Response headers: ${errHeaders}`);
                logs.push(`[${new Date().toLocaleTimeString()}] Response body: ${errBody}`);
                throw new Error(`Business Partner push failed: HTTP ${httpStatus}: ${errBody}`, { cause: { httpStatus } });
            }

            // 4. Parse response to extract Business Partner Number
            let bpNumber = '';
            const responseStr = typeof bpResponse === 'string' ? bpResponse : JSON.stringify(bpResponse);

            if (bpResponse && bpResponse.d && bpResponse.d.BusinessPartner) {
                bpNumber = bpResponse.d.BusinessPartner;
            } else if (bpResponse && bpResponse.BusinessPartner) {
                bpNumber = bpResponse.BusinessPartner;
            }

            if (!bpNumber) {
                const rx1 = /A_BusinessPartner\('(\d+)'\)/i;
                const rx2 = /BusinessPartner\('(\d+)'\)/i;
                const rx3 = /"BusinessPartner"\s*:\s*"(\d+)"/i;

                const m1 = responseStr.match(rx1);
                const m2 = responseStr.match(rx2);
                const m3 = responseStr.match(rx3);

                if (m1 && m1[1]) bpNumber = m1[1];
                else if (m2 && m2[1]) bpNumber = m2[1];
                else if (m3 && m3[1]) bpNumber = m3[1];
            }

            if (!bpNumber) {
                logs.push(`[${new Date().toLocaleTimeString()}] WARNING: Could not parse Business Partner number from SAP response. Using local BP number.`);
                bpNumber = bp.BusinessPartnerNumber || Math.floor(Math.random() * 9000000000 + 1000000000).toString();
            } else {
                if (bpNumber.length < 10) bpNumber = bpNumber.padStart(10, '0');
                logs.push(`[${new Date().toLocaleTimeString()}] SUCCESS: SAP Business Partner created with ID: ${bpNumber}`);
            }

            // Update SAP BP number in database (keep original BusinessPartnerNumber unchanged)
            await UPDATE(BusinessPartners).set({ SAPBPNumber: bpNumber }).where({ ID: bpID });

            // 5. Post Credit Segment
            let creditPushed = false;
            if (bp.SAPCreditPayload) {
                let creditPayload;
                try {
                    creditPayload = JSON.parse(bp.SAPCreditPayload);
                } catch (e) {
                    logs.push(`[${new Date().toLocaleTimeString()}] ERROR: Failed to parse stored SAP Credit Segment payload: ${e.message}`);
                }

                if (creditPayload) {
                    logs.push(`[${new Date().toLocaleTimeString()}] Injecting Business Partner ID '${bpNumber}' into Credit Segment payload...`);
                    creditPayload.BusinessPartner = bpNumber;

                    if (creditPayload.to_CreditMgmtAccountTP && Array.isArray(creditPayload.to_CreditMgmtAccountTP.results)) {
                        creditPayload.to_CreditMgmtAccountTP.results.forEach(result => {
                            result.BusinessPartner = bpNumber;
                        });
                    }

                    logs.push(`[${new Date().toLocaleTimeString()}] Pushing Credit Segment payload...`);
                    try {
                        // Fetch fresh CSRF token for Credit Management API
                        const creditCsrfRes = await executeHttpRequest(dest, {
                            method: 'GET',
                            url: '/sap/opu/odata/sap/API_CRDTMBUSINESSPARTNER/$metadata',
                            headers: { 'X-CSRF-Token': 'Fetch' }
                        });
                        const creditCsrf = creditCsrfRes.headers['x-csrf-token'] || creditCsrfRes.headers['X-CSRF-Token'] || '';
                        const creditSetCookie = creditCsrfRes.headers['set-cookie'] || [];
                        const creditCookie = Array.isArray(creditSetCookie) ? creditSetCookie.map(c => c.split(';')[0]).join('; ') : (creditSetCookie || '').split(';')[0];

                        await executeHttpRequest(dest, {
                            method: 'POST',
                            url: '/sap/opu/odata/sap/API_CRDTMBUSINESSPARTNER/CreditMgmtBusinessPartner',
                            headers: {
                                'X-CSRF-Token': creditCsrf,
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                ...(creditCookie ? { 'Cookie': creditCookie } : {})
                            },
                            data: creditPayload
                        });
                        logs.push(`[${new Date().toLocaleTimeString()}] SUCCESS: Credit Segment pushed successfully.`);
                        creditPushed = true;
                    } catch (creditErr) {
                        console.error("SAP Credit Push Error:", creditErr);
                        logs.push(`[${new Date().toLocaleTimeString()}] WARNING: Credit Segment push failed: ${creditErr.message}`);
                    }
                }
            } else {
                logs.push(`[${new Date().toLocaleTimeString()}] No Credit Segment payload found, skipping.`);
            }

            // 6. Save logs and status
            const finalStatus = 'Pushed';
            const logStr = logs.join('\n');
            await UPDATE(BusinessPartners).set({
                SAPPushStatus: finalStatus,
                SAPPushLogs: logStr
            }).where({ ID: bpID });

            await INSERT.into(SAPPushLogs).entries({
                businessPartner_ID: bpID,
                status: finalStatus,
                logs: logStr,
                timestamp: new Date()
            });

            // Send notification to approvers on successful push
            try {
                const workflows = await SELECT.from(ApprovalWorkflows).where({ businessPartner_ID: bpID, status: 'approved' }).orderBy('currentLevel desc');
                const latestWorkflow = workflows && workflows.length > 0 ? workflows[0] : null;
                if (latestWorkflow) {
                    let aApproverEmails = [latestWorkflow.approverEmail];
                    try {
                        const parsed = JSON.parse(latestWorkflow.approverEmail || "[]");
                        if (Array.isArray(parsed)) aApproverEmails = parsed;
                    } catch (_) {}
                    const emailSubject = `SAP Business Partner Created: ${bpNumber} - ${bp.Name}`;
                    const emailText = `Dear Approver,\n\nThe Business Partner ${bp.Name} has been successfully created in the SAP system.\n\nSAP BP Number: ${bpNumber}\nBusiness Partner: ${bp.Name}\nLocal Reference No.: ${bp.BusinessPartnerNumber}\n\nBest regards,\nBusiness Partner System`;
                    aApproverEmails.forEach(email => {
                        _sendEmail(email, emailSubject, emailText).catch(e =>
                            console.error(`[PUSH] Email to approver ${email} failed:`, e)
                        );
                    });
                    logs.push(`[${new Date().toLocaleTimeString()}] Notification sent to ${aApproverEmails.length} approver(s) for SAP BP: ${bpNumber}`);
                }
            } catch (wfErr) {
                console.error(`[PUSH] Failed to send approval notification:`, wfErr);
            }

            return {
                success: true,
                bpNumber: bpNumber,
                httpStatus: '200',
                logs: logStr
            };

        } catch (err) {
            console.error("SAP Push Action Error:", err);
            const httpStatus = err.cause?.httpStatus || '500';
            logs.push(`[${new Date().toLocaleTimeString()}] CRITICAL ERROR (HTTP ${httpStatus}): ${err.message}`);
            const logStr = logs.join('\n');
            await UPDATE(BusinessPartners).set({
                SAPPushStatus: 'Failed',
                SAPPushLogs: logStr
            }).where({ ID: bpID });

            await INSERT.into(SAPPushLogs).entries({
                businessPartner_ID: bpID,
                status: 'Failed',
                logs: logStr,
                timestamp: new Date()
            });

            return {
                success: false,
                bpNumber: '',
                httpStatus: httpStatus,
                logs: logStr
            };
        }
    });

    // Delete Business Partners (admin only, draft/pending_approval only)
    this.on('deleteBusinessPartners', async (req) => {
        const { bpIDs } = req.data;
        const { BusinessPartners, ApprovalWorkflows, SAPPushLogs } = this.entities;

        if (!bpIDs || !bpIDs.length) {
            return req.error(400, 'No BP IDs provided');
        }

        if (!(await _isAdmin(req))) {
            return req.error(403, 'Only admins can delete Business Partners');
        }

        let deleted = 0;
        let skipped = 0;

        for (const id of bpIDs) {
            const bp = await SELECT.one.from(BusinessPartners)
                .columns(['ID', 'LifecycleStatus', 'Name', 'BusinessPartnerNumber'])
                .where({ ID: id });

            if (!bp) {
                skipped++;
                continue;
            }

            if (bp.LifecycleStatus === 'active') {
                skipped++;
                continue;
            }

            // Delete related records first
            await DELETE.from(SAPPushLogs).where({ businessPartner_ID: id });
            const workflows = await SELECT.from(ApprovalWorkflows).columns('ID').where({ businessPartner_ID: id });
            for (const wf of workflows) {
                await DELETE.from(ApprovalWorkflows).where({ ID: wf.ID });
            }

            await DELETE.from(BusinessPartners).where({ ID: id });
            deleted++;
            console.log(`[DELETE] BP ${bp.BusinessPartnerNumber || bp.Name} (${id}) deleted by ${req.user.id}`);
        }

        return `${deleted} BP(s) deleted, ${skipped} skipped (active BPs cannot be deleted).`;
    });

    function generateSAPPayloads(bp) {
        const creationDate = new Date().toISOString().split('T')[0] + "T00:00:00";
        const timeNow = new Date().toLocaleTimeString('en-US', { hour12: false });
        const [h, m, s] = timeNow.split(':');
        const sapTime = `PT${h}H${m}M${s}S`;

        let category = "2"; // Default Organization
        if (bp.BusinessPartnerCategory === "1") {
            category = "1";
        }

        const email = bp.Email || "";
        const name = bp.Name || "";
        const street = bp.StreetAddress ? bp.StreetAddress.trim() : "";
        const houseNum = bp.HouseNumber || "";
        const city = bp.City || "";
        const postalCode = bp.PostalCode || "";
        const country = bp.Country || "";
        const region = bp.Region || "";
        const lang = bp.Language || "EN";
        const mobileCountry = bp.MobileCountryCode || "";
        const mobileNum = bp.MobileNumber || "";
        const tel = bp.Telephone || "";
        const title = bp.Title || "0003";
        const room = bp.Room || "";
        const floor = bp.Floor || "";
        const careOf = bp.CareOf || "";
        const street2 = bp.Street2 || "";
        const street3 = bp.Street3 || "";
        const street4 = bp.Street4 || "";
        const street5 = bp.Street5 || "";
        const district = bp.District || "";
        const timeZone = bp.TimeZone || "";

        // 1. Build to_BusinessPartnerAddress
        const addresses = [{
            "BusinessPartner": "",
            "AddressID": "",
            "ValidityStartDate": "2026-04-23T00:00:00Z",
            "ValidityEndDate": "9999-12-31T23:59:59Z",
            "AuthorizationGroup": "",
            "AddressUUID": "0911721a-db8d-1ede-b8a6-ef04ace846d9",
            "AdditionalStreetPrefixName": street3,
            "AdditionalStreetSuffixName": floor || street5,
            "AddressTimeZone": timeZone || "UTC+3",
            "CareOfName": careOf,
            "CityCode": "",
            "CityName": city,
            "CompanyPostalCode": "",
            "Country": country,
            "County": "",
            "DeliveryServiceNumber": "",
            "DeliveryServiceTypeCode": "",
            "District": district,
            "FormOfAddress": title,
            "FullName": name,
            "HomeCityName": "",
            "HouseNumber": houseNum,
            "HouseNumberSupplementText": room,
            "Language": lang,
            "POBox": "",
            "POBoxDeviatingCityName": "",
            "POBoxDeviatingCountry": "",
            "POBoxDeviatingRegion": "",
            "POBoxIsWithoutNumber": false,
            "POBoxLobbyName": "",
            "POBoxPostalCode": "",
            "Person": "",
            "PostalCode": postalCode,
            "PrfrdCommMediumType": "",
            "Region": region,
            "StreetName": street,
            "StreetPrefixName": street2,
            "StreetSuffixName": street4,
            "TaxJurisdiction": "",
            "TransportZone": "",
            "AddressIDByExternalSystem": "",
            "CountyCode": "",
            "TownshipCode": "",
            "TownshipName": "",
            "to_AddressUsage": [
                {
                    "BusinessPartner": "",
                    "AddressID": "",
                    "AddressUsage": "XXDEFAULT",
                    "ValidityStartDate": "2026-04-23T00:00:00Z",
                    "ValidityEndDate": "9999-12-31T23:59:59Z",
                    "StandardUsage": false,
                    "AuthorizationGroup": ""
                }
            ],
            "to_EmailAddress": email ? [
                {
                    "AddressID": "",
                    "Person": "",
                    "OrdinalNumber": "1",
                    "IsDefaultEmailAddress": true,
                    "EmailAddress": email,
                    // "SearchEmailAddress": email.toUpperCase(),
                    "AddressCommunicationRemarkText": ""
                }
            ] : [],
            "to_MobilePhoneNumber": mobileNum ? [
                {
                    "AddressID": "",
                    "Person": "",
                    "OrdinalNumber": "2",
                    "DestinationLocationCountry": country,
                    "IsDefaultPhoneNumber": false,
                    "PhoneNumber": mobileNum,
                    "PhoneNumberExtension": "",
                    "InternationalPhoneNumber": mobileCountry + mobileNum,
                    "PhoneNumberType": "3",
                    "AddressCommunicationRemarkText": ""
                }
            ] : [],
            "to_PhoneNumber": tel ? [
                {
                    "AddressID": "",
                    "Person": "",
                    "OrdinalNumber": "1",
                    "DestinationLocationCountry": country,
                    "IsDefaultPhoneNumber": true,
                    "PhoneNumber": tel,
                    "PhoneNumberExtension": "",
                    "InternationalPhoneNumber": mobileCountry + tel,
                    "PhoneNumberType": "1",
                    "AddressCommunicationRemarkText": ""
                }
            ] : []
        }];

        // 2. Build to_BusinessPartnerRole
        const roles = [
            {
                "BusinessPartner": "",
                "BusinessPartnerRole": "FLCU01",
                "ValidFrom": "2026-04-23T00:00:00Z",
                "ValidTo": "9999-12-31T23:59:59Z",
                "AuthorizationGroup": ""
            },
            {
                "BusinessPartner": "",
                "BusinessPartnerRole": "FLCU00",
                "ValidFrom": "2026-04-23T00:00:00Z",
                "ValidTo": "9999-12-31T23:59:59Z",
                "AuthorizationGroup": ""
            }
        ];

        // 3. Build to_BusinessPartnerTax
        const taxes = bp.TaxNumber ? [
            {
                "BusinessPartner": "",
                "BPTaxType": bp.TaxCategory || "UG01",
                "BPTaxNumber": bp.TaxNumber,
                "BPTaxLongNumber": "",
                "AuthorizationGroup": ""
            }
        ] : [];

        // 4. Build to_Customer
        const companyCodes = (bp.CompanyCodes || []).map(cc => ({
            "Customer": "",
            "CompanyCode": cc.CompanyCode,
            "APARToleranceGroup": "",
            "AccountByCustomer": "",
            "AccountingClerk": "",
            "AccountingClerkFaxNumber": "",
            "AccountingClerkInternetAddress": "",
            "AccountingClerkPhoneNumber": "",
            "AlternativePayerAccount": "",
            "AuthorizationGroup": "",
            "CollectiveInvoiceVariant": "",
            "CustomerAccountNote": "",
            "CustomerHeadOffice": "",
            "CustomerSupplierClearingIsUsed": false,
            "HouseBank": "",
            "InterestCalculationCode": "",
            "InterestCalculationDate": null,
            "IntrstCalcFrequencyInMonths": "0",
            "IsToBeLocallyProcessed": false,
            "ItemIsToBePaidSeparately": false,
            "LayoutSortingRule": "",
            "PaymentBlockingReason": "",
            "PaymentMethodsList": "",
            "PaymentTerms": "",
            "PaytAdviceIsSentbyEDI": false,
            "PhysicalInventoryBlockInd": false,
            "ReconciliationAccount": cc.ReconciliationAccount,
            "RecordPaymentHistoryIndicator": false,
            "UserAtCustomer": "",
            "DeletionIndicator": false,
            "CashPlanningGroup": "",
            "KnownOrNegotiatedLeave": "",
            "ValueAdjustmentKey": "",
            "CustomerAccountGroup": "Z001"
        }));

        const salesAreas = (bp.SalesAreas || []).map(sa => {
            const salesAreaEntry = {
                "Customer": "",
                "SalesOrganization": sa.SalesOrganization,
                "DistributionChannel": sa.DistributionChannel,
                "Division": sa.Division,
                "AccountByCustomer": "",
                "AuthorizationGroup": "",
                "BillingIsBlockedForCustomer": "",
                "CompleteDeliveryIsDefined": false,
                "Currency": sa.Currency || "UGX",
                "CustomerABCClassification": "",
                "CustomerAccountAssignmentGroup": sa.AccountAssignmentGroup,
                "CustomerGroup": sa.CustomerGroup,
                "CustomerPaymentTerms": sa.PaymentTerms,
                "CustomerPriceGroup": "",
                "CustomerPricingProcedure": sa.CustomerPricingProcedure || "1",
                "DeliveryIsBlockedForCustomer": "",
                "DeliveryPriority": "0",
                "IncotermsClassification": sa.Incoterms,
                "IncotermsLocation2": "",
                "IncotermsVersion": "",
                "IncotermsLocation1": "",
                "DeletionIndicator": false,
                "IncotermsTransferLocation": "",
                "InvoiceDate": "",
                "ItemOrderProbabilityInPercent": "100",
                "OrderCombinationIsAllowed": true,
                "OrderIsBlockedForCustomer": "",
                "PartialDeliveryIsAllowed": "",
                "PriceListType": "",
                "SalesGroup": "",
                "SalesOffice": "",
                "ShippingCondition": "",
                "SupplyingPlant": "",
                "SalesDistrict": "",
                "InvoiceListSchedule": "",
                "ExchangeRateType": sa.ExchangeRateType || "S",
                "AdditionalCustomerGroup1": "",
                "AdditionalCustomerGroup2": sa.CustomerData2 || "02",
                "AdditionalCustomerGroup3": "",
                "AdditionalCustomerGroup4": "",
                "AdditionalCustomerGroup5": "",
                "PaymentGuaranteeProcedure": "",
                "CustomerAccountGroup": "Z001"
            };

            if (sa.SalesOrganization === "2000") {
                salesAreaEntry["to_SalesAreaTax"] = [];
            } else {
                salesAreaEntry["to_SalesAreaTax"] = [{
                    "Customer": "",
                    "SalesOrganization": sa.SalesOrganization,
                    "DistributionChannel": sa.DistributionChannel,
                    "Division": sa.Division,
                    "DepartureCountry": sa.OutputTaxCountry || "UG",
                    "CustomerTaxCategory": sa.OutputTaxCategory || "MWST",
                    "CustomerTaxClassification": sa.TaxClassification || "1"
                }];
            }

            return salesAreaEntry;
        });

        const customerObj = {
            "Customer": "",
            "AuthorizationGroup": "",
            "BillingIsBlockedForCustomer": "",
            "CreatedByUser": "",
            "CreationDate": null,
            "CustomerAccountGroup": "Z001",
            "CustomerClassification": "",
            "CustomerFullName": `${name}/${postalCode}`,
            "CustomerName": name,
            "DeliveryIsBlocked": "",
            "NFPartnerIsNaturalPerson": "",
            "OrderIsBlockedForCustomer": "",
            "PostingIsBlocked": false,
            "Supplier": "",
            "CustomerCorporateGroup": "",
            "FiscalAddress": "",
            "Industry": "",
            "IndustryCode1": "",
            "IndustryCode2": "",
            "IndustryCode3": "",
            "IndustryCode4": "",
            "IndustryCode5": "",
            "InternationalLocationNumber1": "0",
            "NielsenRegion": "",
            "ResponsibleType": "",
            "TaxNumber1": "",
            "TaxNumber2": "",
            "TaxNumber3": "",
            "TaxNumber4": "",
            "TaxNumber5": "",
            "TaxNumberType": "",
            "VATRegistration": bp.TaxNumber || "",
            "DeletionIndicator": false,
            "ExpressTrainStationName": "",
            "TrainStationName": "",
            "CityCode": "",
            "County": "",
            "to_CustomerCompany": companyCodes,
            "to_CustomerSalesArea": salesAreas
        };

        const bpPayload = {
            "BusinessPartner": "",
            "Customer": "",
            "Supplier": "",
            "AcademicTitle": "",
            "AuthorizationGroup": "",
            "BusinessPartnerCategory": category,
            "BusinessPartnerFullName": name,
            "BusinessPartnerGrouping": bp.Grouping || "ZP01",
            "BusinessPartnerName": name,
            "CorrespondenceLanguage": bp.CorrespondenceLanguage || lang,
            "CreatedByUser": "",
            "CreationDate": creationDate,
            "CreationTime": sapTime,
            "FirstName": bp.FirstName || "",
            "FormOfAddress": title,
            "Industry": "",
            "InternationalLocationNumber1": "0",
            "InternationalLocationNumber2": "0",
            "IsFemale": false,
            "IsMale": false,
            "IsNaturalPerson": "",
            "IsSexUnknown": false,
            "GenderCodeName": "",
            "Language": lang,
            "LastChangeDate": null,
            "LastChangedByUser": "",
            "LastName": bp.LastName || "",
            "LegalForm": "",
            "OrganizationBPName1": name,
            "OrganizationBPName2": "",
            "OrganizationBPName3": "",
            "OrganizationBPName4": "",
            "OrganizationFoundationDate": null,
            "OrganizationLiquidationDate": null,
            "SearchTerm1": (bp.SearchTerm1 || "").trim(),
            "SearchTerm2": (bp.SearchTerm2 || "").trim(),
            "AdditionalLastName": "",
            "BirthDate": null,
            "BusinessPartnerBirthDateStatus": "",
            "BusinessPartnerBirthplaceName": "",
            "BusinessPartnerDeathDate": null,
            "BusinessPartnerIsBlocked": false,
            "BusinessPartnerType": "",
            "ETag": "",
            "GroupBusinessPartnerName1": "",
            "GroupBusinessPartnerName2": "",
            "IndependentAddressID": "",
            "InternationalLocationNumber3": "0",
            "MiddleName": "",
            "NameCountry": "",
            "NameFormat": "",
            "PersonFullName": "",
            "PersonNumber": "",
            "IsMarkedForArchiving": false,
            "BusinessPartnerIDByExtSystem": bp.BusinessPartnerNumber || "",
            "TradingPartner": "",
            "to_BusinessPartnerAddress": addresses,
            "to_BusinessPartnerRole": roles,
            "to_BusinessPartnerTax": taxes,
            "to_Customer": customerObj
        };

        // 5. Build Credit Segment Payload
        const creditLimits = (bp.CreditSegments || []).map(cs => ({
            "BusinessPartner": "",
            "CreditSegment": cs.CreditSegment || "1000",
            "BusinessPartnerIsCritical": false,
            "CreditAccountIsBlocked": false,
            "CreditAccountBlockReason": "",
            "CreditLimitAmount": cs.CreditLimit ? cs.CreditLimit.toString() : "100",
            "CreditLimitValidityEndDate": cs.ValidityDate ? cs.ValidityDate + "T00:00:00" : "9999-12-31T00:00:00",
            "CreditLimitCalculatedAmount": "0",
            "CreditLimitIsZero": true,
            "CreditLimitRequestedAmount": "124",
            "CrdtLmtIsReqdFrmAutomCalc": false,
            "CreditSegmentCurrency": cs.LimitCurrency || "UGX"
        }));

        const creditPayload = {
            "BusinessPartner": "",
            "CrdtMgmtBusinessPartnerGroup": "",
            "CreditWorthinessScoreValue": "22",
            "CrdtWrthnssScoreValdtyEndDate": "2026-05-28T00:00:00",
            "CrdtWorthinessScoreLastChgDate": "2026-05-28T00:00:00",
            "CalcdCrdtWorthinessScoreValue": "22",
            "CreditRiskClass": bp.RiskClass || "D",
            "CalculatedCreditRiskClass": bp.RiskClass || "",
            "CreditRiskClassLastChangeDate": "2026-05-28T00:00:00",
            "CreditCheckRule": bp.CheckRule || "Z1",
            "CreditScoreAndLimitCalcRule": (bp.CreditSegments?.[0]?.CreditLimitRules) || "",
            "to_CreditMgmtAccountTP": {
                "results": creditLimits
            }
        };

        return { bpPayload, creditPayload };
    }

    // Helper function to generate BP PDF from the HTML template
    async function _generateBPPdf(bp) {
        let browser;
        try {
            console.log('[PDF] Starting PDF generation...');
            const templatePath = path.join(__dirname, 'pdfformat.html');
            let templateHtml = fs.readFileSync(templatePath, 'utf8');

            // Read logo image and convert to base64 data URI
            const logoPath = path.join(__dirname, 'images/roofing.png');
            let logoBase64 = '';
            try {
                const logoData = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
            } catch (logoErr) {
                console.warn('[PDF] Logo image not found at:', logoPath, logoErr.message);
            }

            // Build company codes HTML
            let companyCodesHtml = '';
            if (bp.CompanyCodes && bp.CompanyCodes.length > 0) {
                companyCodesHtml = bp.CompanyCodes.map(cc => `
                    <tr>
                        <td>${cc.CompanyCode || '-'}</td>
                        <td>${cc.IsBP ? 'Yes' : 'No'}</td>
                        <td>${cc.IsCustomer ? 'Yes' : 'No'}</td>
                        <td>${cc.ReconciliationAccount || '-'}</td>
                    </tr>
                `).join('');
            } else {
                companyCodesHtml = '<tr><td colspan="4" style="text-align:center;">No company codes assigned</td></tr>';
            }

            // Build sales areas HTML
            let salesAreasHtml = '';
            if (bp.SalesAreas && bp.SalesAreas.length > 0) {
                salesAreasHtml = bp.SalesAreas.map(sa => `
                    <div style="margin-bottom: 20px;">
                        <table class="sub-table">
                            <thead>
                                <tr>
                                    <th>Sales Org</th>
                                    <th>Dist. Channel</th>
                                    <th>Division</th>
                                    <th>Cust. Group</th>
                                    <th>Currency</th>
                                    <th>Exch. Rate Type</th>
                                    <th>Pricing Proc.</th>
                                    <th>Stats Group</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${sa.SalesOrganization || '-'}</td>
                                    <td>${sa.DistributionChannel || '-'}</td>
                                    <td>${sa.Division || '-'}</td>
                                    <td>${sa.CustomerGroup || '-'}</td>
                                    <td>${sa.Currency || '-'}</td>
                                    <td>${sa.ExchangeRateType || '-'}</td>
                                    <td>${sa.CustomerPricingProcedure || '-'}</td>
                                    <td>${sa.CustomerStatsGroup || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                        <table style="font-size: 12px; margin-top: 5px;">
                            <tr>
                                <td style="font-weight:bold; width:18%;">Payment Terms:</td><td style="width:15%;">${sa.PaymentTerms || '-'}</td>
                                <td style="font-weight:bold; width:18%;">Incoterms:</td><td style="width:15%;">${sa.Incoterms || '-'}</td>
                                <td style="font-weight:bold; width:18%;">Acct Assign Group:</td><td style="width:16%;">${sa.AccountAssignmentGroup || '-'}</td>
                            </tr>
                            <tr>
                                <td style="font-weight:bold;">Tax Classification:</td><td>${sa.TaxClassification || '-'}</td>
                                <td style="font-weight:bold;">Output Tax Country:</td><td>${sa.OutputTaxCountry || '-'}</td>
                                <td style="font-weight:bold;">Output Tax Category:</td><td>${sa.OutputTaxCategory || '-'}</td>
                            </tr>
                            <tr>
                                <td style="font-weight:bold;">Customer Data 2:</td><td colspan="5">${sa.CustomerData2 || '-'}</td>
                            </tr>
                        </table>
                    </div>
                `).join('');
            } else {
                salesAreasHtml = '<p style="text-align:center; font-size:13px; color:#666;">No sales areas assigned</p>';
            }

            // Build credit segments HTML
            let creditSegmentsHtml = '';
            if (bp.CreditSegments && bp.CreditSegments.length > 0) {
                creditSegmentsHtml = bp.CreditSegments.map(cs => `
                    <tr>
                        <td>${cs.CreditSegment || '-'}</td>
                        <td>${cs.CreditLimitRules || '-'}</td>
                        <td>${cs.LimitDefined ? 'Yes' : 'No'}</td>
                        <td>${cs.CreditLimit || '-'}</td>
                        <td>${cs.ValidityDate || '-'}</td>
                    </tr>
                `).join('');
            } else {
                creditSegmentsHtml = '<tr><td colspan="5" style="text-align:center;">No credit segments defined</td></tr>';
            }

            // Replace template placeholders
            templateHtml = templateHtml
                .replace(/\$\{logoBase64\}/g, logoBase64)
                .replace(/\$\{companyCodesHtml\}/g, companyCodesHtml)
                .replace(/\$\{salesAreasHtml\}/g, salesAreasHtml)
                .replace(/\$\{creditSegmentsHtml\}/g, creditSegmentsHtml)
                .replace(/\$\{new Date\(\)\.toLocaleDateString\(\)\}/g, new Date().toLocaleDateString())
                .replace(/\$\{bp\.([^}]+)\}/g, (match, key) => {
                    const val = bp[key];
                    return (val !== undefined && val !== null) ? val : '-';
                });

            // Launch Puppeteer with cloud-friendly flags
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });

            const page = await browser.newPage();
            await page.setContent(templateHtml, { waitUntil: 'networkidle0', timeout: 15000 });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
            });

            await browser.close();
            console.log('[PDF] PDF generated successfully');
            return pdfBuffer;
        } catch (err) {
            console.error(`[PDF ERROR] CRITICAL failure: ${err.message}`);
            if (err.stack) console.error(err.stack);
            if (browser) await browser.close();
            return null;
        }
    }

    // Helper function to send emails
    async function _sendEmail(to, subject, text, html, pdfBuffer) {
        const mailOptions = {
            from: '"Business Partner System" <IT.ADMIN@ROOFINGSGROUP.COM>',
            to: to,
            subject: subject,
            text: text || "Please log in to the system to view this message.",
            html: html
        };

        if (pdfBuffer) {
            mailOptions.attachments = [{
                filename: 'BusinessPartner_Summary.pdf',
                content: pdfBuffer,
                contentType: 'application/pdf'
            }];
        }

        try {
            const transportOptions = await _getSmtpTransportOptions();
            const transporter = nodemailer.createTransport(transportOptions);
            await transporter.sendMail(mailOptions);
            console.log(`[MAIL] Email sent to ${to} via sap_process_automation_mail destination`);
        } catch (err) {
            console.error(`[MAIL ERROR] Failed to send email: ${err.message}`);
        }
    }

    async function _getSmtpTransportOptions() {
        console.log('[MAIL] Fetching destination via SAP Cloud SDK...');

        // 1. Correct syntax: getDestination expects an object
        const dest = await getDestination({ destinationName: 'sap_process_automation_mail' });

        if (!dest) {
            throw new Error("Destination 'sap_process_automation_mail' not found in BTP.");
        }

        // 2. MAIL destination properties are safely stored in originalProperties
        const props = dest.originalProperties;
        if (!props) {
            throw new Error("No properties found on the destination.");
        }

        const host = props['mail.smtp.host'];
        const port = parseInt(props['mail.smtp.port'] || '25', 10);

        // Match the exact property you set in BTP (true/false string)
        const isSecure = props['mail.smtp.starttls.enable'] === 'true';

        // 3. The SDK usually hoists Basic Authentication fields to the root
        const user = dest.username || props['mail.user'];
        const pass = dest.password || props['mail.password'];

        if (!host) {
            throw new Error("mail.smtp.host is missing in the destination's Additional Properties.");
        }

        console.log(`[MAIL] Destination loaded successfully. Host: ${host}, Port: ${port}, Secure: ${isSecure}`);

        // 4. Return standard Nodemailer transport options
        return {
            host: host,
            port: port,
            secure: port === 465,
            requireTLS: isSecure,
            auth: {
                user: user,
                pass: pass
            },
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 10000,
            socketTimeout: 15000
        };
    }

    // Helper: fetch CSRF token + session cookie from SAP OData service
    function _fetchCsrfToken(serviceUrl, authHeader) {
        return new Promise((resolve, reject) => {
            const metadataUrl = serviceUrl.endsWith('/$metadata') ? serviceUrl
                : serviceUrl.includes('/sap/opu/') ? serviceUrl + '/$metadata'
                    : serviceUrl + '/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata';
            const u = new URL(metadataUrl);
            const mod = require('https');
            const opts = {
                hostname: u.hostname, port: u.port, path: u.pathname + u.search,
                method: 'GET',
                headers: { 'Authorization': authHeader, 'X-CSRF-Token': 'Fetch' }
            };
            const req = mod.request(opts, res => {
                const csrfToken = res.headers['x-csrf-token'] || '';
                const setCookie = res.headers['set-cookie'] || [];
                const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => {
                    if (csrfToken) resolve({ csrfToken, cookie });
                    else reject(new Error('No CSRF token in response'));
                });
            });
            req.on('error', reject);
            req.end();
        });
    }

    // Helper: POST to SAP with CSRF token + session cookie
    function _sapPost(url, data, authHeader, csrfToken, cookie) {
        return new Promise((resolve, reject) => {
            const u = new URL(url);
            const body = JSON.stringify(data);
            const mod = require('https');
            const headers = {
                'Authorization': authHeader,
                'X-CSRF-Token': csrfToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            };
            if (cookie) headers['Cookie'] = cookie;
            const opts = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'POST', headers };
            const req = mod.request(opts, res => {
                let responseBody = '';
                res.on('data', d => responseBody += d);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try { resolve(JSON.parse(responseBody)); }
                        catch (e) { resolve(responseBody); }
                    } else {
                        const err = new Error(`HTTP ${res.statusCode}: ${responseBody.substring(0, 500)}`);
                        err.status = res.statusCode;
                        reject(err);
                    }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }

    // HTML Email Template for successful SAP push with SAP BP number
    function _getSAPPushSuccessTemplate(bpName, sapBPNumber, localBPNumber) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 30px;">
                <div style="text-align: center; margin-bottom: 25px;">
                    <h1 style="color: #1a73e8; margin: 0; font-size: 24px;">SAP Business Partner Created</h1>
                </div>
                <hr style="border: 0; border-top: 2px solid #1a73e8; margin: 20px 0;" />
                <p style="color: #333; font-size: 15px; line-height: 1.6;">Dear Approver,</p>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    The Business Partner <strong style="color: #1a73e8;">${bpName}</strong> has been successfully created in the SAP system.
                </p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8f9fa; border-radius: 6px;">
                    <tr><td style="padding: 12px 16px; font-weight: bold; color: #555; width: 140px; border-bottom: 1px solid #e0e0e0;">SAP BP Number</td>
                        <td style="padding: 12px 16px; color: #1a73e8; font-weight: bold; font-size: 16px; border-bottom: 1px solid #e0e0e0;">${sapBPNumber}</td></tr>
                    <tr><td style="padding: 12px 16px; font-weight: bold; color: #555; width: 140px; border-bottom: 1px solid #e0e0e0;">Business Partner</td>
                        <td style="padding: 12px 16px; color: #333; border-bottom: 1px solid #e0e0e0;">${bpName}</td></tr>
                    <tr><td style="padding: 12px 16px; font-weight: bold; color: #555; width: 140px;">Local Reference No.</td>
                        <td style="padding: 12px 16px; color: #333;">${localBPNumber}</td></tr>
                </table>
                <p style="color: #555; font-size: 14px; line-height: 1.6;">
                    This BP is now fully active and available in the SAP system for transactions.
                </p>
                <p style="color: #333; font-size: 15px; line-height: 1.6; margin-top: 25px;">
                    Best regards,<br />
                    <strong style="color: #1a73e8;">Business Partner System</strong>
                </p>
            </div>
        `;
    }

    // Professional HTML Email Template Generator
    function _getWorkflowEmailTemplate(title, message, bp, isApprover) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px;">
                <h2 style="color: #0070f3;">${title}</h2>
                <p>${message}</p>
                <hr style="border: 0; border-top: 1px solid #eee;" />
                <p><strong>BP Details:</strong></p>
                <table style="width: 100%;">
                    <tr><td style="font-weight: bold; width: 120px;">Name:</td><td>${bp.Name}</td></tr>
                    <tr><td style="font-weight: bold;">ID:</td><td>${bp.BusinessPartnerNumber}</td></tr>
                    <tr><td style="font-weight: bold;">Type:</td><td>${bp.BPType}</td></tr>
                </table>
                <p style="margin-top: 20px;">
                    ${isApprover ? 'Please log in to the <strong>Business Partner Directory</strong> to review and approve the request.' : 'You can now view this Business Partner in the directory.'}
                </p>
            </div>
        `;
    }

    async function _isAdmin(req) {
        // Check XSUAA scope first
        if (req.user.is('Admin') || req.user.is('admin')) return true;
        // Check user.roles array
        if (Array.isArray(req.user.roles)) {
            if (req.user.roles.some(r => typeof r === 'string' && r.toLowerCase().includes('admin'))) return true;
        }
        // Fallback: check application Users table
        try {
            const { Users } = cds.entities('BusinessPartnerService');
            const user = await SELECT.one.from(Users)
                .where('LOWER(email) =', req.user.id.toLowerCase());
            if (user && user.role === 'admin') return true;
        } catch (_) { /* ignore */ }
        return false;
    }
});
