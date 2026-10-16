import assert from "node:assert/strict";
import test from "node:test";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import { userModel } from "../db/models/users.model.js";
import { organizerApplicationModel } from "../db/models/organizerApplicationModel.js";
import { verifyOrganizer } from "../src/middleware/auth.middleware.js";
import {
  signup,
  verifyEmail,
  login,
} from "../src/modules/users/users.controller.js";
import {
  applyForOrganizer,
  getAllApplications,
  reviewApplication,
} from "../src/modules/organizerApplication/organizerApplication.controller.js";

const userId = "64b000000000000000000011";
const applicationId = "64b000000000000000000012";
const adminId = "64b000000000000000000013";

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  send(body) {
    this.body = body;
    return this;
  },
});

const restoreAfter = (t, object, replacements) => {
  const originals = Object.fromEntries(
    Object.keys(replacements).map((key) => [key, object[key]]),
  );
  Object.assign(object, replacements);
  t.after(() => Object.assign(object, originals));
};

const queryChain = (value) => {
  const query = {
    populate() { return query; },
    sort() { return query; },
    skip() { return query; },
    limit() { return Promise.resolve(value); },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
};

const runMiddleware = (middleware, req, res) =>
  new Promise((resolve, reject) => {
    let nextCalled = false;
    middleware(req, res, (error) => {
      nextCalled = true;
      error ? reject(error) : resolve();
    });
    if (!nextCalled) resolve();
  });

const reviewRequest = (id, status) => ({
  params: { id },
  body: { status, reviewNotes: "Workflow test" },
  user: { _id: adminId },
});

test("organizer signup, email verification, application, admin listing, approval, and login work end to end", async (t) => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalBaseUrl = process.env.BASE_URL;
  process.env.JWT_SECRET = "organizer-workflow-test-secret";
  process.env.BASE_URL = "https://eventops.test";
  t.after(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalBaseUrl === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = originalBaseUrl;
  });

  let user;
  let application;
  let sentEmail;
  restoreAfter(t, nodemailer, {
    createTransport: () => ({ sendMail: async (message) => { sentEmail = message; } }),
  });
  restoreAfter(t, userModel, {
    findOne: async (filter) => {
      if (filter.verificationToken) {
        return user?.verificationToken === filter.verificationToken ? user : null;
      }
      return user?.email === filter.email ? user : null;
    },
    findById: async (id) => String(id) === userId ? user : null,
    create: async (data) => {
      user = {
        ...data,
        _id: userId,
        save: async () => {},
      };
      return user;
    },
  });
  let findByIdCalls = 0;
  restoreAfter(t, organizerApplicationModel, {
    findOne: async () => null,
    create: async (data) => {
      application = {
        ...data,
        _id: applicationId,
        save: async () => {},
      };
      return application;
    },
    countDocuments: async () => application ? 1 : 0,
    find: () => queryChain(application ? [application] : []),
    findById: (id) => {
      findByIdCalls += 1;
      if (findByIdCalls === 1) {
        return Promise.resolve(String(id) === applicationId ? application : null);
      }
      return queryChain(application);
    },
  });

  const signupRes = makeResponse();
  await signup(
    {
      body: {
        name: "New Organizer",
        email: "new-organizer@example.com",
        password: "correct-horse-battery",
        role: "organizer",
      },
    },
    signupRes,
  );
  assert.equal(signupRes.statusCode, 201);
  assert.equal(user.role, "organizer");
  assert.equal(user.status, "pending");
  assert.ok(user.verificationToken);
  assert.match(sentEmail.html, /api\/auth\/verify-email/);

  const unverifiedApplicationRes = makeResponse();
  await applyForOrganizer(
    { user: { _id: userId }, body: { organizationName: "Unverified Org" } },
    unverifiedApplicationRes,
    (error) => { throw error; },
  );
  assert.equal(unverifiedApplicationRes.statusCode, 403);

  const unverifiedLogin = makeResponse();
  await login(
    { body: { email: user.email, password: "correct-horse-battery" } },
    unverifiedLogin,
  );
  assert.equal(unverifiedLogin.statusCode, 403);

  const verificationRes = makeResponse();
  await verifyEmail({ query: { token: user.verificationToken } }, verificationRes);
  assert.equal(verificationRes.statusCode, 200);
  assert.equal(user.verificationToken, undefined);
  assert.equal(user.status, "pending");

  const pendingOrganizerRes = makeResponse();
  await runMiddleware(verifyOrganizer, { user }, pendingOrganizerRes);
  assert.equal(pendingOrganizerRes.statusCode, 403);

  const pendingLogin = makeResponse();
  await login(
    { body: { email: user.email, password: "correct-horse-battery" } },
    pendingLogin,
  );
  assert.equal(pendingLogin.statusCode, 200);
  assert.ok(pendingLogin.body.token);

  const applyRes = makeResponse();
  await applyForOrganizer(
    { user: { _id: userId }, body: { organizationName: "New Organization" } },
    applyRes,
    (error) => { throw error; },
  );
  assert.equal(applyRes.statusCode, 201);
  assert.equal(application.status, "pending");

  const listRes = makeResponse();
  await getAllApplications({ query: {} }, listRes, (error) => { throw error; });
  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.body.data.length, 1);
  assert.equal(listRes.body.data[0]._id, applicationId);

  const approveRes = makeResponse();
  await reviewApplication(reviewRequest(applicationId, "approved"), approveRes, (error) => { throw error; });
  assert.equal(approveRes.statusCode, 200);
  assert.equal(application.status, "approved");
  assert.equal(user.role, "organizer");
  assert.equal(user.status, "approved");

  const approvedOrganizerRes = makeResponse();
  let organizerAccessGranted = false;
  await runMiddleware(verifyOrganizer, { user }, approvedOrganizerRes)
    .then(() => { organizerAccessGranted = true; });
  assert.equal(organizerAccessGranted, true);

  const approvedLogin = makeResponse();
  await login(
    { body: { email: user.email, password: "correct-horse-battery" } },
    approvedLogin,
  );
  assert.equal(approvedLogin.statusCode, 200);
});

test("rejection keeps the applicant pending and able to log in without organizer access", async (t) => {
  const applicant = {
    _id: userId,
    role: "organizer",
    status: "pending",
    email: "rejected-organizer@example.com",
    passwordHash: bcrypt.hashSync("test-password", 8),
    save: async () => {},
  };
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "organizer-workflow-test-secret";
  t.after(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });
  const application = {
    _id: applicationId,
    user: userId,
    status: "pending",
    save: async () => {},
  };
  let lookup = 0;
  restoreAfter(t, userModel, {
    findById: async () => applicant,
  });
  restoreAfter(t, organizerApplicationModel, {
    findById: () => ++lookup === 1 ? Promise.resolve(application) : queryChain(application),
  });

  const res = makeResponse();
  await reviewApplication(reviewRequest(applicationId, "rejected"), res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(application.status, "rejected");
  assert.equal(applicant.role, "organizer");
  assert.equal(applicant.status, "pending");

  restoreAfter(t, userModel, {
    findOne: async () => applicant,
  });
  const loginRes = makeResponse();
  await login(
    { body: { email: applicant.email, password: "test-password" } },
    loginRes,
  );
  assert.equal(loginRes.statusCode, 200);
  assert.equal(loginRes.body.data.role, "organizer");

  const organizerAccessRes = makeResponse();
  await runMiddleware(verifyOrganizer, { user: applicant }, organizerAccessRes);
  assert.equal(organizerAccessRes.statusCode, 403);

  let retryApplication;
  restoreAfter(t, organizerApplicationModel, {
    findOne: async () => null,
    create: async (data) => {
      retryApplication = { ...data, _id: "64b000000000000000000014" };
      return retryApplication;
    },
  });
  const retryRes = makeResponse();
  await applyForOrganizer(
    { user: { _id: userId }, body: { organizationName: "Updated Organization" } },
    retryRes,
    (error) => { throw error; },
  );
  assert.equal(retryRes.statusCode, 201);
  assert.equal(application.status, "rejected");
  assert.equal(retryApplication.status, "pending");
});

test("a duplicate pending application is blocked", async (t) => {
  const applicant = { _id: userId, role: "organizer", status: "pending" };
  restoreAfter(t, userModel, { findById: async () => applicant });
  restoreAfter(t, organizerApplicationModel, {
    findOne: async () => ({ status: "pending" }),
    create: async () => { throw new Error("must not create a duplicate"); },
  });

  const res = makeResponse();
  await applyForOrganizer(
    { user: { _id: userId }, body: { organizationName: "Another Org" } },
    res,
    (error) => { throw error; },
  );

  assert.equal(res.statusCode, 400);
});

test("a duplicate-key race is returned as a conflict", async (t) => {
  const applicant = { _id: userId, role: "organizer", status: "pending" };
  restoreAfter(t, userModel, { findById: async () => applicant });
  restoreAfter(t, organizerApplicationModel, {
    findOne: async () => null,
    create: async () => { throw Object.assign(new Error("duplicate"), { code: 11000 }); },
  });

  const res = makeResponse();
  await applyForOrganizer(
    { user: { _id: userId }, body: { organizationName: "Racing Org" } },
    res,
    (error) => { throw error; },
  );

  assert.equal(res.statusCode, 409);
});

test("the schema has a unique partial index for pending applications only", () => {
  const pendingIndex = organizerApplicationModel.schema.indexes().find(
    ([keys, options]) =>
      keys.user === 1 &&
      options.unique === true &&
      options.partialFilterExpression?.status === "pending",
  );

  assert.ok(pendingIndex);
});

test("reviewing an application with a missing user returns 404 without throwing", async (t) => {
  const application = {
    _id: applicationId,
    user: null,
    status: "pending",
    save: async () => { throw new Error("orphan application must not be saved"); },
  };
  restoreAfter(t, userModel, { findById: async () => null });
  restoreAfter(t, organizerApplicationModel, {
    findById: async () => application,
  });

  const res = makeResponse();
  await reviewApplication(reviewRequest(applicationId, "approved"), res, (error) => { throw error; });
  assert.equal(res.statusCode, 404);
  assert.equal(application.status, "pending");
});

test("regular user signup and approval roles remain unchanged", async (t) => {
  let createdUser;
  let sent = false;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalBaseUrl = process.env.BASE_URL;
  process.env.JWT_SECRET = "organizer-workflow-test-secret";
  process.env.BASE_URL = "https://eventops.test";
  t.after(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalBaseUrl === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = originalBaseUrl;
  });
  restoreAfter(t, nodemailer, {
    createTransport: () => ({ sendMail: async () => { sent = true; } }),
  });
  restoreAfter(t, userModel, {
    findOne: async (filter) => {
      if (filter.verificationToken) {
        return createdUser?.verificationToken === filter.verificationToken ? createdUser : null;
      }
      return createdUser?.email === filter.email ? createdUser : null;
    },
    create: async (data) => {
      createdUser = { ...data, _id: userId, save: async () => {} };
      return createdUser;
    },
  });

  const res = makeResponse();
  await signup(
    { body: { name: "Regular User", email: "regular@example.com", password: "password", role: "user" } },
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.equal(createdUser.role, "user");
  assert.equal(createdUser.status, "pending");
  assert.equal(sent, true);
  assert.equal(bcrypt.compareSync("password", createdUser.passwordHash), true);

  const verificationRes = makeResponse();
  await verifyEmail(
    { query: { token: createdUser.verificationToken } },
    verificationRes,
  );
  assert.equal(verificationRes.statusCode, 200);
  assert.equal(createdUser.status, "approved");

  const loginRes = makeResponse();
  await login(
    { body: { email: createdUser.email, password: "password" } },
    loginRes,
  );
  assert.equal(loginRes.statusCode, 200);
  assert.equal(loginRes.body.data.role, "user");
});

test("admin self-registration remains forbidden", async () => {
  const res = makeResponse();
  await signup(
    { body: { name: "Admin", email: "admin@example.com", password: "password", role: "admin" } },
    res,
  );
  assert.equal(res.statusCode, 403);
});

