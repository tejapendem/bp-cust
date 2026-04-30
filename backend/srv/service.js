const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
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

        if (!userEmail || userEmail === 'anonymous') {
            return { email: "", name: "Guest User", role: "guest", isAdmin: false };
        }

        let hasAdminScope = false;
        try {
            hasAdminScope = req.user.is('Admin') ||
                           req.user.is('admin') ||
                           req.user.attr?.role === 'admin' ||
                           (Array.isArray(req.user.roles) && req.user.roles.some(r => r.toLowerCase().includes('admin'))) ||
                           (Array.isArray(req.user.scopes) && req.user.scopes.some(s => s.toLowerCase().includes('admin')));
        } catch (e) {
            console.error("Error checking scopes:", e);
        }

        const { Users } = this.entities;
        let user;
        try {
            user = await SELECT.one.from(Users).where({ email: userEmail });
        } catch (dbErr) {
            console.error("Database query failed (likely schema not deployed):", dbErr.message);
            // Fallback: Use JWT scopes only if DB is not ready
            if (hasAdminScope) {
                return { email: userEmail, name: userEmail.split('@')[0], role: 'admin', isAdmin: true };
            }
            return { email: userEmail, name: userEmail.split('@')[0], role: 'guest', isAdmin: false };
        }

        if (user) {
            // If user exists in DB, use DB role but also check JWT for admin override
            const effectiveRole = (user.role === 'admin' || hasAdminScope) ? 'admin' : user.role;
            return {
                email: user.email,
                name: user.name,
                role: effectiveRole,
                isAdmin: effectiveRole === 'admin'
            };
        }

        // 2. User authenticated via BTP but not in Users table yet
        //    Use XSUAA scope to determine role
        if (hasAdminScope) {
            return {
                email: userEmail,
                name: userEmail.split('@')[0],
                role: 'admin',
                isAdmin: true
            };
        }

        // 3. Authenticated but no role assigned yet — return guest
        return {
            email: userEmail,
            name: userEmail.split('@')[0],
            role: 'guest',
            isAdmin: false
        };
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
});
