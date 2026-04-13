#!/usr/bin/env ts-node

/**
 * ApplyBot Identity Management CLI
 *
 * Commands:
 *   pnpm identity init          - Interactive wizard to build identity.json
 *   pnpm identity encrypt       - Encrypts identity.json -> profile.enc
 *   pnpm identity decrypt       - Decrypts profile.enc -> identity.json.decrypted
 *   pnpm identity validate      - Validates identity.json against schema
 *   pnpm identity upload-resume - Copies resume PDF to identity directory
 *   pnpm identity status        - Shows what's in the identity directory
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';

const SETUP_DIR = path.join(process.cwd(), 'identity-setup');
const IDENTITY_FILE = path.join(SETUP_DIR, 'identity.json');

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function init() {
  console.log('\n=== ApplyBot Identity Setup Wizard ===\n');
  console.log('This will create your identity profile for job applications.\n');

  if (!fs.existsSync(SETUP_DIR)) {
    fs.mkdirSync(SETUP_DIR, { recursive: true });
  }

  const identity: Record<string, unknown> = {};

  // Personal info
  identity.firstName = await prompt('First name: ');
  identity.lastName = await prompt('Last name: ');
  identity.fullName = `${identity.firstName} ${identity.lastName}`;
  identity.email = await prompt('Email: ');
  identity.phone = await prompt('Phone (e.g. +15551234567): ');
  identity.phoneFormatted = await prompt('Phone formatted (e.g. (555) 123-4567): ');

  identity.address = {
    street: await prompt('Street address: '),
    city: await prompt('City: '),
    state: await prompt('State: '),
    zip: await prompt('ZIP code: '),
    country: await prompt('Country (default: United States): ') || 'United States',
  };

  // Professional
  identity.linkedinUrl = await prompt('LinkedIn URL: ');
  identity.githubUrl = await prompt('GitHub URL: ');
  identity.portfolioUrl = await prompt('Portfolio URL (or empty): ') || '';
  identity.currentTitle = await prompt('Current job title: ');
  identity.yearsOfExperience = parseInt(await prompt('Years of experience: '), 10) || 0;
  identity.summary = await prompt('Professional summary (2-3 sentences): ');

  // Work experience
  const expCount = parseInt(await prompt('Number of work experiences to add: '), 10) || 1;
  identity.workExperience = [];
  for (let i = 0; i < expCount; i++) {
    console.log(`\n--- Work Experience ${i + 1} ---`);
    (identity.workExperience as Array<Record<string, unknown>>).push({
      company: await prompt('  Company: '),
      title: await prompt('  Title: '),
      startDate: await prompt('  Start date (MM/YYYY): '),
      endDate: await prompt('  End date (MM/YYYY or Present): '),
      location: await prompt('  Location: '),
      description: await prompt('  Description: '),
      achievements: (await prompt('  Achievements (comma-separated): ')).split(',').map((a) => a.trim()).filter(Boolean),
    });
  }

  // Education
  const eduCount = parseInt(await prompt('\nNumber of education entries: '), 10) || 1;
  identity.education = [];
  for (let i = 0; i < eduCount; i++) {
    console.log(`\n--- Education ${i + 1} ---`);
    (identity.education as Array<Record<string, unknown>>).push({
      institution: await prompt('  Institution: '),
      degree: await prompt('  Degree: '),
      field: await prompt('  Field of study: '),
      startDate: await prompt('  Start date: '),
      endDate: await prompt('  End date: '),
      gpa: await prompt('  GPA (optional): ') || undefined,
    });
  }

  // Skills
  identity.technicalSkills = (await prompt('\nTechnical skills (comma-separated): ')).split(',').map((s) => s.trim()).filter(Boolean);
  identity.softSkills = (await prompt('Soft skills (comma-separated): ')).split(',').map((s) => s.trim()).filter(Boolean);
  identity.certifications = (await prompt('Certifications (comma-separated, or empty): ')).split(',').map((s) => s.trim()).filter(Boolean);
  identity.languages = (await prompt('Programming languages (comma-separated): ')).split(',').map((s) => s.trim()).filter(Boolean);

  // Preferences
  identity.desiredSalaryMin = parseInt(await prompt('\nDesired salary min: '), 10) || 0;
  identity.desiredSalaryMax = parseInt(await prompt('Desired salary max: '), 10) || 0;
  identity.willingToRelocate = (await prompt('Willing to relocate? (y/n): ')).toLowerCase() === 'y';
  identity.remotePreference = await prompt('Remote preference (remote/hybrid/onsite/any): ') || 'any';
  identity.preferredLocations = (await prompt('Preferred locations (comma-separated): ')).split(',').map((s) => s.trim()).filter(Boolean);

  // Resume
  identity.resumePath = '/identity/resume.pdf';
  identity.resumeText = await prompt('\nPaste your resume as plain text (or press Enter to skip): ') || 'See attached resume';
  identity.defaultCoverLetterTemplate = '';

  // Application defaults
  identity.authorizedToWork = (await prompt('\nAuthorized to work in the US? (y/n): ')).toLowerCase() === 'y';
  identity.requiresSponsorship = (await prompt('Require visa sponsorship? (y/n): ')).toLowerCase() === 'y';
  identity.veteranStatus = await prompt('Veteran status (e.g. "Not a veteran"): ') || 'Decline to self-identify';
  identity.disabilityStatus = await prompt('Disability status: ') || 'Decline to self-identify';
  identity.gender = await prompt('Gender: ') || 'Decline to self-identify';
  identity.ethnicity = await prompt('Ethnicity: ') || 'Decline to self-identify';
  identity.willingToBackgroundCheck = true;
  identity.willingToDrugTest = true;
  identity.noticePeriod = await prompt('Notice period (e.g. "2 weeks"): ') || '2 weeks';
  identity.availableStartDate = await prompt('Available start date: ') || 'Immediately';

  identity.encryptedAt = '';
  identity.version = 1;

  fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));
  console.log(`\nIdentity saved to: ${IDENTITY_FILE}`);
  console.log('Next: run "pnpm identity encrypt" to encrypt your profile');
}

function encrypt() {
  const key = process.env.IDENTITY_KEY;
  if (!key || key.length < 32) {
    console.error('Error: IDENTITY_KEY env var must be set (min 32 chars)');
    console.error('Generate with: openssl rand -hex 32');
    process.exit(1);
  }

  if (!fs.existsSync(IDENTITY_FILE)) {
    console.error(`Error: ${IDENTITY_FILE} not found. Run "pnpm identity init" first.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(IDENTITY_FILE, 'utf8');
  const identity = JSON.parse(raw);
  identity.encryptedAt = new Date().toISOString();

  const derivedKey = crypto.createHash('sha256').update(key).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(identity), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload = {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted.toString('hex'),
    encryptedAt: identity.encryptedAt,
    version: 1,
  };

  const outputPath = path.join(SETUP_DIR, 'profile.enc');
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Encrypted identity written to: ${outputPath}`);
  console.log(`File size: ${fs.statSync(outputPath).size} bytes`);
  console.log('\nCopy this file to your identity PVC:');
  console.log('  cp identity-setup/profile.enc /mnt/applybot-identity/profile.enc');
}

function decrypt() {
  const key = process.env.IDENTITY_KEY;
  if (!key || key.length < 32) {
    console.error('Error: IDENTITY_KEY env var must be set');
    process.exit(1);
  }

  const encPath = path.join(SETUP_DIR, 'profile.enc');
  if (!fs.existsSync(encPath)) {
    console.error(`Error: ${encPath} not found`);
    process.exit(1);
  }

  const raw = fs.readFileSync(encPath, 'utf8');
  const payload = JSON.parse(raw);

  const derivedKey = crypto.createHash('sha256').update(key).digest();
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const encrypted = Buffer.from(payload.data, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  const outputPath = path.join(SETUP_DIR, 'identity.json.decrypted');
  fs.writeFileSync(outputPath, decrypted.toString('utf8'));
  console.log(`Decrypted identity written to: ${outputPath}`);
  console.log('WARNING: This file contains your personal information. Delete when done editing.');
}

function validate() {
  if (!fs.existsSync(IDENTITY_FILE)) {
    console.error(`Error: ${IDENTITY_FILE} not found`);
    process.exit(1);
  }

  const raw = fs.readFileSync(IDENTITY_FILE, 'utf8');
  const identity = JSON.parse(raw);

  const required = ['firstName', 'lastName', 'email', 'phone', 'address', 'currentTitle', 'summary', 'workExperience', 'education', 'technicalSkills', 'resumeText'];
  const missing = required.filter((f) => !identity[f]);

  if (missing.length > 0) {
    console.error('Validation failed. Missing fields:');
    missing.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log('Identity validation passed!');
  console.log(`Name: ${identity.fullName}`);
  console.log(`Email: ${identity.email}`);
  console.log(`Title: ${identity.currentTitle}`);
  console.log(`Work Experience: ${identity.workExperience?.length || 0} entries`);
  console.log(`Education: ${identity.education?.length || 0} entries`);
  console.log(`Skills: ${identity.technicalSkills?.length || 0} technical skills`);
}

function status() {
  const identityDir = process.env.IDENTITY_PATH ? path.dirname(process.env.IDENTITY_PATH) : '/identity';
  const localDir = SETUP_DIR;

  console.log('\n=== Identity Status ===\n');

  console.log(`Local setup directory: ${localDir}`);
  if (fs.existsSync(localDir)) {
    const files = fs.readdirSync(localDir);
    files.forEach((f) => {
      const stats = fs.statSync(path.join(localDir, f));
      console.log(`  ${f} (${stats.size} bytes)`);
    });
  } else {
    console.log('  (not created yet)');
  }

  console.log(`\nIdentity PVC path: ${identityDir}`);
  if (fs.existsSync(identityDir)) {
    const files = fs.readdirSync(identityDir);
    files.forEach((f) => {
      const fullPath = path.join(identityDir, f);
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        const subfiles = fs.readdirSync(fullPath);
        console.log(`  ${f}/ (${subfiles.length} files)`);
      } else {
        console.log(`  ${f} (${stats.size} bytes)`);
      }
    });
  } else {
    console.log('  (not mounted)');
  }
}

// CLI router
const command = process.argv[2];
switch (command) {
  case 'init':
    init().catch(console.error);
    break;
  case 'encrypt':
    encrypt();
    break;
  case 'decrypt':
    decrypt();
    break;
  case 'validate':
    validate();
    break;
  case 'status':
    status();
    break;
  default:
    console.log('Usage: pnpm identity <command>');
    console.log('Commands: init, encrypt, decrypt, validate, status');
    process.exit(1);
}
