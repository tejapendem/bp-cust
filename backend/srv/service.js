const cds = require('@sap/cds');
const nodemailer = require('nodemailer');

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

        // 1. Get the Business Partner
        const bp = await SELECT.one.from(BusinessPartners).where({ ID: bpID });
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

        // 5. Send Email using helper
        const subject = `Approval Required: New Business Partner ${bp.Name}`;
        const html = _getWorkflowEmailTemplate(
            "Approval Required",
            `A new Business Partner creation request for <strong>${bp.Name}</strong> requires your Level 1 approval.`,
            bp,
            true
        );
        await _sendEmail(workflowEntry.approverEmail, subject, null, html);

        return `Submitted for Level 1 approval to ${level1.email}`;
    });

    this.on('getAdminStats', async (req) => {
        const { BusinessPartners, Users, AccessRequests } = this.entities;

        const activeBPs = await SELECT.from(BusinessPartners).where({ LifecycleStatus: 'active' });
        const draftBPs = await SELECT.from(BusinessPartners).where({ LifecycleStatus: 'draft' });

        const totalAdmins = await SELECT.from(Users).where({ role: 'admin' });
        const totalViewers = await SELECT.from(Users).where({ role: 'viewer' });

        const pendingRequests = await SELECT.from(AccessRequests).where({ status: 'pending' });

        return {
            activeBPs: activeBPs.length,
            draftBPs: draftBPs.length,
            totalAdmins: totalAdmins.length,
            totalViewers: totalViewers.length,
            pendingRequests: pendingRequests.length
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

            // Send rejection email to requester
            const bp = await SELECT.one.from(BusinessPartners).where({ ID: workflow.businessPartner_ID });
            if (bp) {
                const subject = "Your Business Partner request has been rejected";
                const html = _getWorkflowEmailTemplate(
                    "Request Rejected",
                    `Your request for <strong>${bp.Name}</strong> has been rejected by the Level ${workflow.currentLevel} approver.`,
                    bp,
                    false
                );
                await _sendEmail(bp.Email, subject, null, html);
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
            const bp = await SELECT.one.from(BusinessPartners).where({ ID: workflow.businessPartner_ID });
            const subject = `Approval Required: Level ${nextLevel} - ${bp.Name}`;
            const html = _getWorkflowEmailTemplate(
                "Approval Required",
                `A Business Partner request for <strong>${bp.Name}</strong> requires your Level ${nextLevel} approval.`,
                bp,
                true
            );
            await _sendEmail(nextApprover.email, subject, null, html);
        } else {
            // No more levels - finalize the approval
            await UPDATE(ApprovalWorkflows).set({ status: 'approved' }).where({ ID: workflowID });
            await UPDATE(BusinessPartners).set({ LifecycleStatus: 'active' }).where({ ID: workflow.businessPartner_ID });

            // Send approval email to requester
            const bp = await SELECT.one.from(BusinessPartners).where({ ID: workflow.businessPartner_ID });
            if (bp) {
                const subject = "Business Partner Approved!";
                const html = _getWorkflowEmailTemplate(
                    "Business Partner Approved",
                    `Your Business Partner request for <strong>${bp.Name}</strong> has been fully approved and is now active.`,
                    bp,
                    false
                );
                await _sendEmail(bp.Email, subject, null, html);
            }
        }

        return `Level ${workflow.currentLevel} approval completed${nextApprover ? ', moved to Level ' + nextLevel : ', fully approved'}`;
    });

    // Helper function to send emails
    async function _sendEmail(to, subject, text, html) {
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

            await transporter.sendMail({
                from: `"Business Partner System" <${fromEmail}>`,
                to: to,
                subject: subject,
                text: text || "Please log in to the system to view this message.",
                html: html
            });
            console.log(`[MAIL] Email sent to ${to}`);
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
