const cds = require('@sap/cds');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

module.exports = cds.service.impl(async function () {
    this.before('*', async (req) => {
        console.log(`[AUTH DEBUG] User: ${req.user.id}, Roles: ${req.user.roles || 'none'}, IsAuthenticated: ${req.user.id !== 'anonymous'}`);
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

        // 12. Save Logic - Generate Business Partner Number
        // Generating a random 10-digit number for demonstration
        data.BusinessPartnerNumber = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
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
    const TAX_CATEGORY_FIELD_MAP = {
        'UG01': 'VATRegistrationNumber',
        'UG02': 'IncomeTaxRegNo',
        'UG03': 'NationalID',
        'UG04': 'PassportNumber'
    };

    // Tax Number Validation against external SAP API
    this.on('validateVATNumber', async (req) => {
        const { taxNumber, taxCategory } = req.data;
        if (!taxNumber || !taxNumber.trim()) {
            return { isValid: false, recordCount: 0, message: 'Tax number is required' };
        }
        if (!taxCategory) {
            return { isValid: false, recordCount: 0, message: 'Tax category is required' };
        }

        // Look up the API field for this tax category
        const sApiField = TAX_CATEGORY_FIELD_MAP[taxCategory];
        if (!sApiField) {
            // No validation configured for this tax category — treat as valid
            console.log(`[TAX VALIDATION] No API field mapping for category: ${taxCategory}, skipping validation`);
            return { isValid: true, recordCount: 0, message: 'No validation required for this tax category' };
        }

        const sTaxNum = taxNumber.trim();
        const sBaseUrl = 'https://devlb.roofingsgroup.com/sap/opu/odata4/sap/zapi_bp_cust_valid/srvd_a2x/sap/zsd_bpr_cust_valid/0001';
        const sUrl = `${sBaseUrl}/Customer?sap-client=400&$filter=${sApiField} eq '${sTaxNum}'`;

        console.log(`[TAX VALIDATION] Category: ${taxCategory}, Field: ${sApiField}, Value: ${sTaxNum}`);
        console.log(`[TAX VALIDATION] URL: ${sUrl}`);

        try {
            let response;
            try {
                // Use CDS destination service (for BTP deployed)
                const destService = await cds.connect.to('devlb');
                const sApiPath = `/sap/opu/odata4/sap/zapi_bp_cust_valid/srvd_a2x/sap/zsd_bpr_cust_valid/0001/Customer?sap-client=400&$filter=${sApiField} eq '${sTaxNum}'`;
                response = await destService.get(sApiPath);
            } catch (destErr) {
                console.error(`[TAX VALIDATION] Destination error: ${destErr.message}`);
                return { isValid: false, recordCount: 0, message: `System error: SAP destination 'devlb' unavailable.` };
            }

            const aResults = (response && response.value) || [];
            console.log(`[TAX VALIDATION] Found ${aResults.length} record(s) for ${sApiField}: ${sTaxNum}`);

            if (aResults.length > 0) {
                return {
                    isValid: true,
                    recordCount: aResults.length,
                    message: `Tax Number verified (${aResults.length} record(s) found)`
                };
            } else {
                return {
                    isValid: false,
                    recordCount: 0,
                    message: `Tax Number '${sTaxNum}' not found for category ${taxCategory}`
                };
            }
        } catch (err) {
            console.error(`[TAX VALIDATION] Error: ${err.message}`);
            return { isValid: false, recordCount: 0, message: `Validation service error: ${err.message}` };
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

        // 2. Get the Level 1 Approver
        const level1 = await SELECT.one.from(ApprovalLevels).where({ level: 1 });
        if (!level1) return req.error(400, "Level 1 approver not configured in Admin settings");

        // 3. Create the Approval Workflow entry
        const workflowEntry = {
            businessPartner_ID: bpID,
            currentLevel: 1,
            status: 'pending',
            approverEmail: level1.email
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
        await _sendEmail(workflowEntry.approverEmail, subject, null, html, pdfBuffer);

        return `Submitted for Level 1 approval to ${level1.email}`;
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

            if (fullRequest) {
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

        // 2. Verify the approver is the current level approver
        if (workflow.approverEmail !== approverEmail) {
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
                await _sendEmail(bp.Email, subject, null, html, pdfBuffer);
            }

            return "Request rejected";
        }

        // 4b. If approved, check if there's a next level
        const nextLevel = workflow.currentLevel + 1;
        const nextApprover = await SELECT.one.from(ApprovalLevels).where({ level: nextLevel });

        if (nextApprover) {
            // Move to next level
            await UPDATE(ApprovalWorkflows).set({
                currentLevel: nextLevel,
                approverEmail: nextApprover.email
            }).where({ ID: workflowID });

            // Send email to next level approver
            // Send email to next level approver with full details
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
            await _sendEmail(nextApprover.email, subject, null, html, pdfBuffer);
        } else {
            // No more levels - finalize the approval
            await UPDATE(ApprovalWorkflows).set({ status: 'approved' }).where({ ID: workflowID });
            await UPDATE(BusinessPartners).set({ LifecycleStatus: 'active' }).where({ ID: workflow.businessPartner_ID });

            // Send approval email to requester
            // Send approval email to requester with full details
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
                await _sendEmail(bp.Email, subject, null, html, pdfBuffer);
            }
        }

        return `Level ${workflow.currentLevel} approval completed${nextApprover ? ', moved to Level ' + nextLevel : ', fully approved'}`;
    });

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
                                    <th>Currency</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${sa.SalesOrganization || '-'}</td>
                                    <td>${sa.DistributionChannel || '-'}</td>
                                    <td>${sa.Division || '-'}</td>
                                    <td>${sa.Currency || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                        <table style="font-size: 12px; margin-top: 5px;">
                            <tr>
                                <td style="font-weight:bold; width:20%;">Payment Terms:</td><td style="width:30%;">${sa.PaymentTerms || '-'}</td>
                                <td style="font-weight:bold; width:20%;">Incoterms:</td><td style="width:30%;">${sa.Incoterms || '-'}</td>
                            </tr>
                            <tr>
                                <td style="font-weight:bold;">Tax Category:</td><td>${sa.OutputTaxCategory || '-'}</td>
                                <td style="font-weight:bold;">Tax Class:</td><td>${sa.TaxClassification || '-'}</td>
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
                headless: 'new',
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
            await page.setContent(templateHtml, { waitUntil: 'networkidle0' });
            
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
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    user: process.env.GMAIL_USER || 'saiteja14419@gmail.com',
                    pass: process.env.GMAIL_APP_PASSWORD || 'uvhl chqx pjtj qpxi'
                }
            });

            const fromEmail = process.env.GMAIL_USER || 'saiteja14419@gmail.com';

            const mailOptions = {
                from: `"Business Partner System" <${fromEmail}>`,
                to: to,
                subject: subject,
                text: text || "Please log in to the system to view this message.",
                html: html
            };

            // Attach the PDF if it was generated successfully
            if (pdfBuffer) {
                mailOptions.attachments = [{
                    filename: 'BusinessPartner_Summary.pdf',
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }];
            }

            await transporter.sendMail(mailOptions);
            console.log(`[MAIL] Email sent to ${to}${pdfBuffer ? ' with PDF attachment' : ''}`);
        } catch (err) {
            console.error(`[MAIL ERROR] Failed to send email: ${err.message}`);
        }
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
                    <tr><td style="font-weight: bold;">Role:</td><td>${bp.BPRole}</td></tr>
                    <tr><td style="font-weight: bold;">Type:</td><td>${bp.BPType}</td></tr>
                </table>
                <p style="margin-top: 20px;">
                    ${isApprover ? 'Please log in to the <strong>Business Partner Directory</strong> to review and approve the request.' : 'You can now view this Business Partner in the directory.'}
                </p>
            </div>
        `;
    }
});
