/**
 * Seed dummy data into bp-cust-test.db for UI testing.
 * Run with: node seed-dummy-data.js
 */
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bp-cust-test.db');

const now = new Date().toISOString();

// UUIDs for cross-reference
const BP_IDS = [
    'aa000001-0000-0000-0000-000000000001',
    'aa000001-0000-0000-0000-000000000002',
    'aa000001-0000-0000-0000-000000000003',
    'aa000001-0000-0000-0000-000000000004',
    'aa000001-0000-0000-0000-000000000005',
    'aa000001-0000-0000-0000-000000000006',
    'aa000001-0000-0000-0000-000000000007',
    'aa000001-0000-0000-0000-000000000008',
];
const WF_IDS = [
    'bb000002-0000-0000-0000-000000000001',
    'bb000002-0000-0000-0000-000000000002',
    'bb000002-0000-0000-0000-000000000003',
    'bb000002-0000-0000-0000-000000000004',
    'bb000002-0000-0000-0000-000000000005',
];
const LOG_IDS = [
    'cc000003-0000-0000-0000-000000000001',
    'cc000003-0000-0000-0000-000000000002',
    'cc000003-0000-0000-0000-000000000003',
    'cc000003-0000-0000-0000-000000000004',
    'cc000003-0000-0000-0000-000000000005',
    'cc000003-0000-0000-0000-000000000006',
];

const businessPartners = [
    // === active + Pushed (Approval Data KPI: Pushed to SAP) ===
    {
        ID: BP_IDS[0], BusinessPartnerNumber: 'S00001', SAPBPNumber: '1000001',
        BPRole: '000000', BusinessPartnerCategory: '2', BPType: 'Customer', Grouping: 'ZP01',
        Name: 'Roofings Steel Ltd', StreetAddress: 'Plot 12, Industrial Area', HouseNumber: '12',
        City: 'Kampala', PostalCode: '10101', Country: 'UG', Region: 'KAM',
        MobileNumber: '0701234567', Email: 'procurement@roofingssteel.co.ug',
        TaxCategory: 'UG01', TaxNumber: '1001234567', TaxStatus: 'Active',
        RiskClass: 'A', LifecycleStatus: 'active', SAPPushStatus: 'Pushed',
        createdAt: '2026-05-01T08:00:00.000Z', modifiedAt: '2026-05-10T10:00:00.000Z',
        createdBy: 'rajesh.pendem@canopusgbs.com', modifiedBy: 'rajesh.pendem@canopusgbs.com'
    },
    {
        ID: BP_IDS[1], BusinessPartnerNumber: 'S00002', SAPBPNumber: '1000002',
        BPRole: '000000', BusinessPartnerCategory: '2', BPType: 'Customer', Grouping: 'ZP01',
        Name: 'Nile Breweries Limited', StreetAddress: 'Jinja Road', HouseNumber: '5A',
        City: 'Jinja', PostalCode: '10201', Country: 'UG', Region: 'JIN',
        MobileNumber: '0712345678', Email: 'finance@nilebreweries.ug',
        TaxCategory: 'UG01', TaxNumber: '1002345678', TaxStatus: 'Active',
        RiskClass: 'B', LifecycleStatus: 'active', SAPPushStatus: 'Pushed',
        createdAt: '2026-05-03T09:00:00.000Z', modifiedAt: '2026-05-12T11:00:00.000Z',
        createdBy: 'rajesh.pendem@canopusgbs.com', modifiedBy: 'rajesh.pendem@canopusgbs.com'
    },
    {
        ID: BP_IDS[2], BusinessPartnerNumber: 'S00003', SAPBPNumber: '1000003',
        BPRole: '000000', BusinessPartnerCategory: '1', BPType: 'Customer', Grouping: 'ZP05',
        Name: 'Amara Trading Co', FirstName: 'Amara', LastName: 'Okello',
        StreetAddress: 'Nakasero Hill Road', HouseNumber: '7',
        City: 'Kampala', PostalCode: '10102', Country: 'UG', Region: 'KAM',
        MobileNumber: '0723456789', Email: 'amara.okello@amaratrading.ug',
        TaxCategory: 'UG02', TaxNumber: '2003456789', TaxStatus: 'Active',
        RiskClass: 'A', LifecycleStatus: 'active', SAPPushStatus: 'Pushed',
        createdAt: '2026-05-05T10:00:00.000Z', modifiedAt: '2026-05-14T12:00:00.000Z',
        createdBy: 'rajesh.pendem@canopusgbs.com', modifiedBy: 'rajesh.pendem@canopusgbs.com'
    },
    // === active + Not Pushed (Pending Push KPI) ===
    {
        ID: BP_IDS[3], BusinessPartnerNumber: 'S00004',
        BPRole: '000000', BusinessPartnerCategory: '2', BPType: 'Customer', Grouping: 'ZP01',
        Name: 'Uganda Clays Limited', StreetAddress: 'Kajjansi, Entebbe Road', HouseNumber: '1',
        City: 'Entebbe', PostalCode: '10301', Country: 'UG', Region: 'WKL',
        MobileNumber: '0734567890', Email: 'info@ugandaclays.co.ug',
        TaxCategory: 'UG01', TaxNumber: '1004567890', TaxStatus: 'Active',
        RiskClass: 'C', LifecycleStatus: 'active', SAPPushStatus: 'Not Pushed',
        createdAt: '2026-05-07T11:00:00.000Z', modifiedAt: '2026-05-16T13:00:00.000Z',
        createdBy: 'rajesh.pendem@canopusgbs.com', modifiedBy: 'rajesh.pendem@canopusgbs.com'
    },
    {
        ID: BP_IDS[4], BusinessPartnerNumber: 'S00005',
        BPRole: '000000', BusinessPartnerCategory: '2', BPType: 'Vendor', Grouping: 'ZP05',
        Name: 'Mukwano Industries', StreetAddress: 'Port Bell Road', HouseNumber: '3',
        City: 'Kampala', PostalCode: '10103', Country: 'UG', Region: 'KAM',
        MobileNumber: '0745678901', Email: 'accounts@mukwano.com',
        TaxCategory: 'UG01', TaxNumber: '1005678901', TaxStatus: 'Active',
        RiskClass: 'B', LifecycleStatus: 'active', SAPPushStatus: 'Not Pushed',
        createdAt: '2026-05-09T12:00:00.000Z', modifiedAt: '2026-05-18T14:00:00.000Z',
        createdBy: 'rajesh.pendem@canopusgbs.com', modifiedBy: 'rajesh.pendem@canopusgbs.com'
    },
    // === active + Failed (Push Failed KPI) ===
    {
        ID: BP_IDS[5], BusinessPartnerNumber: 'S00006',
        BPRole: '000000', BusinessPartnerCategory: '2', BPType: 'Customer', Grouping: 'ZP01',
        Name: 'Hima Cement Ltd', StreetAddress: 'Kololo Hill Drive', HouseNumber: '22',
        City: 'Kampala', PostalCode: '10104', Country: 'UG', Region: 'KAM',
        MobileNumber: '0756789012', Email: 'finance@himacements.ug',
        TaxCategory: 'UG01', TaxNumber: '1006789012', TaxStatus: 'Active',
        RiskClass: 'D', LifecycleStatus: 'active', SAPPushStatus: 'Failed',
        SAPPushLogs: 'ERROR: BAPI_BUPA_CREATE_FROM_DATA2 returned error: "Tax number already exists in company code 1000". Contact SAP admin.',
        createdAt: '2026-05-11T13:00:00.000Z', modifiedAt: '2026-05-20T15:00:00.000Z',
        createdBy: 'rajesh.pendem@canopusgbs.com', modifiedBy: 'rajesh.pendem@canopusgbs.com'
    },
    // === draft (Admin Dashboard draftBPs count) ===
    {
        ID: BP_IDS[6], BusinessPartnerNumber: 'S00007',
        BPRole: '000000', BusinessPartnerCategory: '1', BPType: 'Customer', Grouping: 'ZP01',
        Name: 'Grace Namukasa', FirstName: 'Grace', LastName: 'Namukasa',
        StreetAddress: 'Ntinda Road', HouseNumber: '4B',
        City: 'Kampala', PostalCode: '10105', Country: 'UG', Region: 'KAM',
        MobileNumber: '0767890123', Email: 'grace.namukasa@gmail.com',
        TaxCategory: 'UG03', TaxNumber: 'CM900123456WR', TaxStatus: 'Active',
        RiskClass: 'A', LifecycleStatus: 'draft', SAPPushStatus: 'Not Pushed',
        createdAt: '2026-05-25T08:00:00.000Z', modifiedAt: '2026-05-25T08:00:00.000Z',
        createdBy: 'viewer@roofingsgroup.com', modifiedBy: 'viewer@roofingsgroup.com'
    },
    // === pending_approval ===
    {
        ID: BP_IDS[7], BusinessPartnerNumber: 'S00008',
        BPRole: '000000', BusinessPartnerCategory: '2', BPType: 'Customer', Grouping: 'ZP05',
        Name: 'Kakira Sugar Works', StreetAddress: 'Jinja-Iganga Road', HouseNumber: '1',
        City: 'Jinja', PostalCode: '10202', Country: 'UG', Region: 'JIN',
        MobileNumber: '0778901234', Email: 'procurement@kakirasugar.ug',
        TaxCategory: 'UG01', TaxNumber: '1008901234', TaxStatus: 'Active',
        RiskClass: 'B', LifecycleStatus: 'pending_approval', SAPPushStatus: 'Not Pushed',
        createdAt: '2026-06-01T07:00:00.000Z', modifiedAt: '2026-06-01T07:00:00.000Z',
        createdBy: 'viewer@roofingsgroup.com', modifiedBy: 'viewer@roofingsgroup.com'
    },
];

const approvalWorkflows = [
    // === pending workflows (Approval Inbox - Pending tab) ===
    {
        ID: WF_IDS[0], businessPartner_ID: BP_IDS[7],
        currentLevel: 1, status: 'pending',
        approverEmail: 'teja.p@canopusgbs.com',
        levelEmails: JSON.stringify({ "1": "teja.p@canopusgbs.com", "2": "rajesh.pendem@canopusgbs.com" }),
        createdAt: '2026-06-01T07:05:00.000Z', modifiedAt: '2026-06-01T07:05:00.000Z',
        createdBy: 'system', modifiedBy: 'system'
    },
    {
        ID: WF_IDS[1], businessPartner_ID: BP_IDS[6],
        currentLevel: 2, status: 'pending',
        approverEmail: 'rajesh.pendem@canopusgbs.com',
        levelEmails: JSON.stringify({ "1": "teja.p@canopusgbs.com", "2": "rajesh.pendem@canopusgbs.com" }),
        createdAt: '2026-05-28T10:00:00.000Z', modifiedAt: '2026-05-29T09:00:00.000Z',
        createdBy: 'system', modifiedBy: 'system'
    },
    // === approved workflows (Approval Inbox - Approved tab) ===
    {
        ID: WF_IDS[2], businessPartner_ID: BP_IDS[0],
        currentLevel: 2, status: 'approved',
        approverEmail: 'rajesh.pendem@canopusgbs.com',
        levelEmails: JSON.stringify({ "1": "teja.p@canopusgbs.com", "2": "rajesh.pendem@canopusgbs.com" }),
        createdAt: '2026-04-28T08:00:00.000Z', modifiedAt: '2026-05-01T10:00:00.000Z',
        createdBy: 'system', modifiedBy: 'system'
    },
    {
        ID: WF_IDS[3], businessPartner_ID: BP_IDS[1],
        currentLevel: 2, status: 'approved',
        approverEmail: 'rajesh.pendem@canopusgbs.com',
        levelEmails: JSON.stringify({ "1": "teja.p@canopusgbs.com", "2": "rajesh.pendem@canopusgbs.com" }),
        createdAt: '2026-04-30T09:00:00.000Z', modifiedAt: '2026-05-03T11:00:00.000Z',
        createdBy: 'system', modifiedBy: 'system'
    },
    // === rejected workflow (Approval Inbox - Rejected tab) ===
    {
        ID: WF_IDS[4], businessPartner_ID: BP_IDS[2],
        currentLevel: 1, status: 'rejected',
        approverEmail: 'teja.p@canopusgbs.com',
        levelEmails: JSON.stringify({ "1": "teja.p@canopusgbs.com", "2": "rajesh.pendem@canopusgbs.com" }),
        createdAt: '2026-05-02T10:00:00.000Z', modifiedAt: '2026-05-03T08:30:00.000Z',
        createdBy: 'system', modifiedBy: 'system'
    },
];

const approvalLogs = [
    // Logs for WF_IDS[1] (pending at level 2 — level 1 already approved)
    {
        ID: LOG_IDS[0], parent_ID: WF_IDS[1],
        level: 1, approver: 'teja.p@canopusgbs.com',
        action: 'approved', comment: 'All details verified at level 1.',
        timestamp: '2026-05-29T09:00:00.000Z',
        createdAt: '2026-05-29T09:00:00.000Z', modifiedAt: '2026-05-29T09:00:00.000Z',
        createdBy: 'teja.p@canopusgbs.com', modifiedBy: 'teja.p@canopusgbs.com'
    },
    // Logs for WF_IDS[2] (fully approved)
    {
        ID: LOG_IDS[1], parent_ID: WF_IDS[2],
        level: 1, approver: 'teja.p@canopusgbs.com',
        action: 'approved', comment: 'Tax and address verified.',
        timestamp: '2026-04-29T10:00:00.000Z',
        createdAt: '2026-04-29T10:00:00.000Z', modifiedAt: '2026-04-29T10:00:00.000Z',
        createdBy: 'teja.p@canopusgbs.com', modifiedBy: 'teja.p@canopusgbs.com'
    },
    {
        ID: LOG_IDS[2], parent_ID: WF_IDS[2],
        level: 2, approver: 'rajesh.pendem@canopusgbs.com',
        action: 'approved', comment: 'Final approval granted. Credit limit confirmed.',
        timestamp: '2026-05-01T10:00:00.000Z',
        createdAt: '2026-05-01T10:00:00.000Z', modifiedAt: '2026-05-01T10:00:00.000Z',
        createdBy: 'rajesh.pendem@canopusgbs.com', modifiedBy: 'rajesh.pendem@canopusgbs.com'
    },
    // Logs for WF_IDS[3] (fully approved)
    {
        ID: LOG_IDS[3], parent_ID: WF_IDS[3],
        level: 1, approver: 'teja.p@canopusgbs.com',
        action: 'approved', comment: 'Documents checked and approved.',
        timestamp: '2026-05-01T09:00:00.000Z',
        createdAt: '2026-05-01T09:00:00.000Z', modifiedAt: '2026-05-01T09:00:00.000Z',
        createdBy: 'teja.p@canopusgbs.com', modifiedBy: 'teja.p@canopusgbs.com'
    },
    {
        ID: LOG_IDS[4], parent_ID: WF_IDS[3],
        level: 2, approver: 'rajesh.pendem@canopusgbs.com',
        action: 'approved', comment: 'Approved after finance review.',
        timestamp: '2026-05-03T11:00:00.000Z',
        createdAt: '2026-05-03T11:00:00.000Z', modifiedAt: '2026-05-03T11:00:00.000Z',
        createdBy: 'rajesh.pendem@canopusgbs.com', modifiedBy: 'rajesh.pendem@canopusgbs.com'
    },
    // Logs for WF_IDS[4] (rejected)
    {
        ID: LOG_IDS[5], parent_ID: WF_IDS[4],
        level: 1, approver: 'teja.p@canopusgbs.com',
        action: 'rejected', comment: 'Tax number could not be verified in URA system.',
        timestamp: '2026-05-03T08:30:00.000Z',
        createdAt: '2026-05-03T08:30:00.000Z', modifiedAt: '2026-05-03T08:30:00.000Z',
        createdBy: 'teja.p@canopusgbs.com', modifiedBy: 'teja.p@canopusgbs.com'
    },
];

const extraUsers = [
    { email: 'teja.p@canopusgbs.com', name: 'Teja Pendem', role: 'admin', status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z', modifiedAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'system', modifiedBy: 'system' },
    { email: 'viewer@roofingsgroup.com', name: 'Sarah Nakato', role: 'viewer', status: 'active',
      createdAt: '2026-02-01T00:00:00.000Z', modifiedAt: '2026-02-01T00:00:00.000Z',
      createdBy: 'system', modifiedBy: 'system' },
    { email: 'viewer2@roofingsgroup.com', name: 'James Otieno', role: 'viewer', status: 'active',
      createdAt: '2026-03-01T00:00:00.000Z', modifiedAt: '2026-03-01T00:00:00.000Z',
      createdBy: 'system', modifiedBy: 'system' },
];

// ── helpers ──────────────────────────────────────────────────────────────────
function run(sql, params = []) {
    return new Promise((res, rej) =>
        db.run(sql, params, function (err) { err ? rej(err) : res(this); }));
}

function allRows(sql, params = []) {
    return new Promise((res, rej) =>
        db.all(sql, params, (err, rows) => { err ? rej(err) : res(rows); }));
}

async function upsertBP(bp) {
    const exists = await allRows('SELECT ID FROM bp_cust_BusinessPartners WHERE ID=?', [bp.ID]);
    if (exists.length) {
        console.log(`  SKIP (exists): BusinessPartner ${bp.BusinessPartnerNumber}`);
        return;
    }
    await run(`INSERT INTO bp_cust_BusinessPartners
        (ID,createdAt,createdBy,modifiedAt,modifiedBy,BusinessPartnerNumber,SAPBPNumber,
         BPRole,BusinessPartnerCategory,BPType,Grouping,Name,FirstName,LastName,
         StreetAddress,HouseNumber,City,PostalCode,Country,Region,
         MobileNumber,Email,TaxCategory,TaxNumber,TaxStatus,RiskClass,
         LifecycleStatus,SAPPushStatus,SAPPushLogs)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [bp.ID, bp.createdAt, bp.createdBy, bp.modifiedAt, bp.modifiedBy,
         bp.BusinessPartnerNumber, bp.SAPBPNumber || null,
         bp.BPRole, bp.BusinessPartnerCategory, bp.BPType, bp.Grouping,
         bp.Name, bp.FirstName || null, bp.LastName || null,
         bp.StreetAddress, bp.HouseNumber, bp.City, bp.PostalCode, bp.Country, bp.Region,
         bp.MobileNumber, bp.Email, bp.TaxCategory, bp.TaxNumber, bp.TaxStatus, bp.RiskClass,
         bp.LifecycleStatus, bp.SAPPushStatus, bp.SAPPushLogs || null]);
    console.log(`  INSERT: BusinessPartner ${bp.BusinessPartnerNumber} — ${bp.Name}`);
}

async function upsertWF(wf) {
    const exists = await allRows('SELECT ID FROM bp_cust_ApprovalWorkflows WHERE ID=?', [wf.ID]);
    if (exists.length) { console.log(`  SKIP (exists): Workflow ${wf.ID}`); return; }
    await run(`INSERT INTO bp_cust_ApprovalWorkflows
        (ID,createdAt,createdBy,modifiedAt,modifiedBy,businessPartner_ID,currentLevel,status,approverEmail,levelEmails)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [wf.ID, wf.createdAt, wf.createdBy, wf.modifiedAt, wf.modifiedBy,
         wf.businessPartner_ID, wf.currentLevel, wf.status, wf.approverEmail, wf.levelEmails]);
    console.log(`  INSERT: Workflow ${wf.status} for BP ${wf.businessPartner_ID.slice(-4)}`);
}

async function upsertLog(log) {
    const exists = await allRows('SELECT ID FROM bp_cust_ApprovalLogs WHERE ID=?', [log.ID]);
    if (exists.length) { console.log(`  SKIP (exists): Log ${log.ID}`); return; }
    await run(`INSERT INTO bp_cust_ApprovalLogs
        (ID,createdAt,createdBy,modifiedAt,modifiedBy,parent_ID,level,approver,action,comment,timestamp)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [log.ID, log.createdAt, log.createdBy, log.modifiedAt, log.modifiedBy,
         log.parent_ID, log.level, log.approver, log.action, log.comment, log.timestamp]);
    console.log(`  INSERT: Log level=${log.level} action=${log.action}`);
}

async function upsertUser(u) {
    const exists = await allRows('SELECT email FROM bp_cust_Users WHERE email=?', [u.email]);
    if (exists.length) { console.log(`  SKIP (exists): User ${u.email}`); return; }
    await run(`INSERT INTO bp_cust_Users (email,name,role,status,createdAt,createdBy,modifiedAt,modifiedBy)
               VALUES (?,?,?,?,?,?,?,?)`,
        [u.email, u.name, u.role, u.status, u.createdAt, u.createdBy, u.modifiedAt, u.modifiedBy]);
    console.log(`  INSERT: User ${u.email} (${u.role})`);
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
    try {
        console.log('\n=== Seeding Business Partners ===');
        for (const bp of businessPartners) await upsertBP(bp);

        console.log('\n=== Seeding Approval Workflows ===');
        for (const wf of approvalWorkflows) await upsertWF(wf);

        console.log('\n=== Seeding Approval Logs ===');
        for (const log of approvalLogs) await upsertLog(log);

        console.log('\n=== Seeding Extra Users ===');
        for (const u of extraUsers) await upsertUser(u);

        // Summary
        const bpCount   = (await allRows('SELECT COUNT(*) c FROM bp_cust_BusinessPartners'))[0].c;
        const wfCount   = (await allRows('SELECT COUNT(*) c FROM bp_cust_ApprovalWorkflows'))[0].c;
        const logCount  = (await allRows('SELECT COUNT(*) c FROM bp_cust_ApprovalLogs'))[0].c;
        const userCount = (await allRows('SELECT COUNT(*) c FROM bp_cust_Users'))[0].c;
        const active    = (await allRows("SELECT COUNT(*) c FROM bp_cust_BusinessPartners WHERE LifecycleStatus='active'"))[0].c;
        const pushed    = (await allRows("SELECT COUNT(*) c FROM bp_cust_BusinessPartners WHERE SAPPushStatus='Pushed'"))[0].c;
        const failed    = (await allRows("SELECT COUNT(*) c FROM bp_cust_BusinessPartners WHERE SAPPushStatus='Failed'"))[0].c;
        const notPushed = (await allRows("SELECT COUNT(*) c FROM bp_cust_BusinessPartners WHERE LifecycleStatus='active' AND SAPPushStatus='Not Pushed'"))[0].c;

        console.log('\n✅ Seed complete!');
        console.log(`   BusinessPartners : ${bpCount} total | ${active} active | ${pushed} pushed | ${notPushed} not-pushed | ${failed} failed`);
        console.log(`   ApprovalWorkflows: ${wfCount} total`);
        console.log(`   ApprovalLogs     : ${logCount} total`);
        console.log(`   Users            : ${userCount} total`);
    } catch (err) {
        console.error('❌ Seed error:', err.message);
    } finally {
        db.close();
    }
})();
