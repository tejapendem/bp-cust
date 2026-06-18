-- Migration: Create missing Approval/Log tables for Production PostgreSQL
-- Run against the 'qas' schema
-- These tables are required by the ApprovalWorkflow, ApprovalLog, and SAPPushLog entities

CREATE TABLE IF NOT EXISTS "bp_cust-ApprovalWorkflows" (
    "ID" VARCHAR(36) NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP,
    "createdBy" VARCHAR(255),
    "modifiedAt" TIMESTAMP,
    "modifiedBy" VARCHAR(255),
    "businessPartner_ID" VARCHAR(36),
    "currentLevel" INTEGER,
    "status" VARCHAR(20),
    "approverEmail" VARCHAR(100),
    "levelEmails" TEXT
);

CREATE TABLE IF NOT EXISTS "bp_cust-ApprovalLogs" (
    "ID" VARCHAR(36) NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP,
    "createdBy" VARCHAR(255),
    "modifiedAt" TIMESTAMP,
    "modifiedBy" VARCHAR(255),
    "parent_ID" VARCHAR(36),
    "level" INTEGER,
    "approver" VARCHAR(100),
    "action" VARCHAR(20),
    "comment" VARCHAR(500),
    "timestamp" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "bp_cust-SAPPushLogs" (
    "ID" VARCHAR(36) NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP,
    "createdBy" VARCHAR(255),
    "modifiedAt" TIMESTAMP,
    "modifiedBy" VARCHAR(255),
    "businessPartner_ID" VARCHAR(36),
    "status" VARCHAR(20),
    "logs" TEXT,
    "timestamp" TIMESTAMP
);

-- Also create the service-level views for OData exposure
CREATE OR REPLACE VIEW "BusinessPartnerService_ApprovalWorkflows" AS
SELECT
    a0."ID", a0."createdAt", a0."createdBy", a0."modifiedAt", a0."modifiedBy",
    a0."businessPartner_ID", a0."currentLevel", a0."status", a0."approverEmail", a0."levelEmails"
FROM "bp_cust-ApprovalWorkflows" a0;

CREATE OR REPLACE VIEW "BusinessPartnerService_ApprovalLogs" AS
SELECT
    a0."ID", a0."createdAt", a0."createdBy", a0."modifiedAt", a0."modifiedBy",
    a0."parent_ID", a0."level", a0."approver", a0."action", a0."comment", a0."timestamp"
FROM "bp_cust-ApprovalLogs" a0;

CREATE OR REPLACE VIEW "BusinessPartnerService_SAPPushLogs" AS
SELECT
    a0."ID", a0."createdAt", a0."createdBy", a0."modifiedAt", a0."modifiedBy",
    a0."businessPartner_ID", a0."status", a0."logs", a0."timestamp"
FROM "bp_cust-SAPPushLogs" a0;
