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
});
