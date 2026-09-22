import express from 'express';
import http from 'http';
import { db } from '../server/db/database';
import { authRouter } from '../server/routes/auth';
import { hospitalsRouter } from '../server/routes/hospitals';
import { generateToken, hashPassword } from '../server/middleware/auth';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('       PHASE 4: AUTHENTICATION & AUTHORIZATION TEST SUITE       ');
  console.log('===============================================================\n');

  // Setup test Express instance
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/hospitals', hospitalsRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail: string = '') {
    if (condition) {
      console.log(`[PASS] ${testName} ${detail ? '-> ' + detail : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} -> FAILED: ${detail}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Valid Login & User Registration
    // -------------------------------------------------------------
    console.log('--- TEST 1: Valid Login & User Registration ---');
    
    // 1.1 Super Admin login
    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@federatedhealth.ai', password: 'Admin@12345' }),
    });
    const adminData = await adminRes.json();
    assert(adminRes.status === 200, '1.1 Super Admin Login HTTP Status 200');
    assert(!!adminData.access_token, '1.1 Super Admin received JWT access token');
    assert(adminData.role === 'SUPER_ADMIN', '1.1 Super Admin role verified', adminData.role);

    // 1.2 Hospital Admin login
    const hospRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@metrohospital.org', password: 'Hospital@12345' }),
    });
    const hospData = await hospRes.json();
    assert(hospRes.status === 200, '1.2 Hospital Admin Login HTTP Status 200');
    assert(hospData.role === 'HOSPITAL_ADMIN', '1.2 Hospital Admin role verified', hospData.role);

    // 1.3 Doctor login
    const docRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'doctor@metrohospital.org', password: 'Doctor@12345' }),
    });
    const docData = await docRes.json();
    assert(docRes.status === 200, '1.3 Doctor Login HTTP Status 200');
    assert(docData.role === 'DOCTOR', '1.3 Doctor role verified', docData.role);

    // 1.4 New User Registration with bcrypt password hashing
    const testRegEmail = `researcher_${Date.now()}@metrohospital.org`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Evelyn Reed, PhD',
        email: testRegEmail,
        password: 'SecureResearch@2026',
        role: 'DOCTOR',
        hospital_id: 1,
      }),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, '1.4 Registration HTTP Status 201 Created');
    assert(!!regData.access_token, '1.4 Registration issued valid JWT token');

    // 1.5 Verify registered user can login with their new password
    const regLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testRegEmail, password: 'SecureResearch@2026' }),
    });
    const regLoginData = await regLoginRes.json();
    assert(regLoginRes.status === 200, '1.5 Newly registered user logged in successfully');
    assert(regLoginData.email === testRegEmail, '1.5 Correct email returned');

    // -------------------------------------------------------------
    // TEST 2: Invalid Password Rejection & Audit Logging
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Invalid Password Rejection & Security Audit ---');
    const badLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@federatedhealth.ai', password: 'DefinitelyWrongPassword999' }),
    });
    const badLoginData = await badLoginRes.json();
    assert(badLoginRes.status === 401, '2.1 Invalid password returned 401 Unauthorized');
    assert(badLoginData.code === 'INVALID_CREDENTIALS', '2.1 Expected code INVALID_CREDENTIALS', badLoginData.code);

    // Verify security audit log was written to database
    const failedAudit = await db.queryOne(
      "SELECT * FROM audit_logs WHERE action = 'LOGIN_FAILED' ORDER BY id DESC LIMIT 1"
    );
    assert(!!failedAudit, '2.2 Security audit log recorded in PostgreSQL database for failed login attempt');

    // -------------------------------------------------------------
    // TEST 3: Expired / Invalid / Malformed Token Rejection
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Expired, Invalid, & Missing Token Rejection ---');
    
    // 3.1 Missing token
    const noTokenRes = await fetch(`${baseUrl}/auth/me`);
    const noTokenData = await noTokenRes.json();
    assert(noTokenRes.status === 401, '3.1 Missing Authorization header returned 401');
    assert(noTokenData.code === 'AUTH_REQUIRED', '3.1 Expected AUTH_REQUIRED code', noTokenData.code);

    // 3.2 Forged / Tampered token
    const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.tampered_invalid_signature_bits';
    const forgedRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${forgedToken}` },
    });
    const forgedData = await forgedRes.json();
    assert(forgedRes.status === 401, '3.2 Forged token returned 401 Unauthorized');
    assert(forgedData.code === 'INVALID_TOKEN', '3.2 Expected INVALID_TOKEN code', forgedData.code);

    // 3.3 Expired token
    const expiredToken = generateToken(
      { id: 1, email: 'admin@federatedhealth.ai', name: 'Admin', role: 'SUPER_ADMIN', hospital_id: null },
      '-1s' // Expired 1 second ago
    );
    const expiredRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const expiredData = await expiredRes.json();
    assert(expiredRes.status === 401, '3.3 Expired token returned 401 Unauthorized');
    assert(expiredData.code === 'TOKEN_EXPIRED', '3.3 Expected TOKEN_EXPIRED code', expiredData.code);

    // -------------------------------------------------------------
    // TEST 4: Unauthorized Role (Role-Based Access Control)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Unauthorized Role (RBAC) Enforcement ---');

    // 4.1 Doctor attempts Super Admin protected endpoint
    const docAdminAttemptRes = await fetch(`${baseUrl}/auth/protected/admin-only`, {
      headers: { Authorization: `Bearer ${docData.access_token}` },
    });
    const docAdminAttemptData = await docAdminAttemptRes.json();
    assert(docAdminAttemptRes.status === 403, '4.1 Doctor denied Super Admin endpoint with 403 Forbidden');
    assert(docAdminAttemptData.code === 'FORBIDDEN_ROLE', '4.1 Expected code FORBIDDEN_ROLE', docAdminAttemptData.code);

    // 4.2 Doctor attempts to register a new hospital node
    const docCreateHospRes = await fetch(`${baseUrl}/hospitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${docData.access_token}`,
      },
      body: JSON.stringify({ hospital_name: 'Unauthorized Clinic', hospital_code: 'UNAUTH' }),
    });
    assert(docCreateHospRes.status === 403, '4.2 Doctor denied hospital creation with 403 Forbidden');

    // 4.3 Hospital Admin attempts to modify a DIFFERENT hospital node
    const hospMismatchRes = await fetch(`${baseUrl}/hospitals/3`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hospData.access_token}`, // Belongs to hospital 1
      },
      body: JSON.stringify({ hospital_name: 'Hijacked Hospital Name' }),
    });
    const hospMismatchData = await hospMismatchRes.json();
    assert(hospMismatchRes.status === 403, '4.3 Hospital Admin denied updating other hospital node with 403');
    assert(hospMismatchData.code === 'FORBIDDEN_HOSPITAL_MISMATCH', '4.3 Expected FORBIDDEN_HOSPITAL_MISMATCH code');

    // -------------------------------------------------------------
    // TEST 5: Protected API Operations with Authorized Roles
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Protected API Operations with Authorized Roles ---');

    // 5.1 Super Admin accesses admin-only endpoint
    const adminAllowedRes = await fetch(`${baseUrl}/auth/protected/admin-only`, {
      headers: { Authorization: `Bearer ${adminData.access_token}` },
    });
    assert(adminAllowedRes.status === 200, '5.1 Super Admin successfully accessed admin-only endpoint');

    // 5.2 Hospital Admin accesses hospital-admin endpoint
    const hospAllowedRes = await fetch(`${baseUrl}/auth/protected/hospital-admin`, {
      headers: { Authorization: `Bearer ${hospData.access_token}` },
    });
    assert(hospAllowedRes.status === 200, '5.2 Hospital Admin accessed hospital-admin endpoint');

    // 5.3 Doctor accesses clinical endpoint
    const docAllowedRes = await fetch(`${baseUrl}/auth/protected/clinical`, {
      headers: { Authorization: `Bearer ${docData.access_token}` },
    });
    assert(docAllowedRes.status === 200, '5.3 Doctor accessed clinical endpoint');

    // 5.4 Token Validation endpoint
    const validateRes = await fetch(`${baseUrl}/auth/validate-token`, {
      headers: { Authorization: `Bearer ${adminData.access_token}` },
    });
    const validateData = await validateRes.json();
    assert(validateRes.status === 200, '5.4 /api/auth/validate-token returns 200');
    assert(validateData.valid === true, '5.4 Token validation confirmed valid: true');

    // 5.5 User Profile from PostgreSQL (/api/auth/me)
    const profileRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${adminData.access_token}` },
    });
    const profileData = await profileRes.json();
    assert(profileRes.status === 200, '5.5 /api/auth/me returned 200');
    assert(profileData.email === 'admin@federatedhealth.ai', '5.5 Profile matches DB record', profileData.name);

    // -------------------------------------------------------------
    // TEST 6: Protected Frontend Route & Logout Session Handling
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Protected Frontend Route & Session Handling ---');

    // 6.1 Logout API call records audit trail
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminData.access_token}` },
    });
    assert(logoutRes.status === 200, '6.1 Logout completed with status 200');

    // Verify logout audit log in PostgreSQL
    const logoutAudit = await db.queryOne(
      "SELECT * FROM audit_logs WHERE action = 'USER_LOGOUT' ORDER BY id DESC LIMIT 1"
    );
    assert(!!logoutAudit, '6.2 User logout event audited and persisted in PostgreSQL database');

    console.log('\n===============================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
