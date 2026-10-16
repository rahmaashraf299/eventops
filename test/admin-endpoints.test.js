import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcrypt";
import Event from "../db/models/eventModel.js";
import { bookingModel } from "../db/models/booking.model.js";
import { organizerApplicationModel } from "../db/models/organizerApplicationModel.js";
import { userModel } from "../db/models/users.model.js";
import { verifyAdmin, verifyToken } from "../src/middleware/auth.middleware.js";
import { login } from "../src/modules/users/users.controller.js";
import {
  getAllEvents,
  getDashboardStats,
  updateUserStatus,
} from "../src/modules/admin/admin.controller.js";
import adminRoutes from "../src/modules/admin/admin.routes.js";

const userId = "64b000000000000000000021";

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
});

const restoreAfter = (t, object, replacements) => {
  const originals = Object.fromEntries(
    Object.keys(replacements).map((key) => [key, object[key]]),
  );
  Object.assign(object, replacements);
  t.after(() => Object.assign(object, originals));
};

test("admin can update a user's status", async (t) => {
  const user = {
    _id: userId,
    name: "Test User",
    email: "test@example.com",
    role: "user",
    status: "pending",
    save: async () => {},
  };
  restoreAfter(t, userModel, { findById: async () => user });

  const res = makeResponse();
  await updateUserStatus({ params: { id: userId }, body: { status: "approved" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(user.status, "approved");
  assert.equal(res.body.data.status, "approved");
});

test("user status update validates IDs and schema status values", async (t) => {
  let lookupCalled = false;
  restoreAfter(t, userModel, {
    findById: async () => { lookupCalled = true; return null; },
  });

  const invalidIdRes = makeResponse();
  await updateUserStatus({ params: { id: "bad-id" }, body: { status: "approved" } }, invalidIdRes);
  assert.equal(invalidIdRes.statusCode, 400);
  assert.equal(lookupCalled, false);

  const invalidStatusRes = makeResponse();
  await updateUserStatus({ params: { id: userId }, body: { status: "active" } }, invalidStatusRes);
  assert.equal(invalidStatusRes.statusCode, 400);
  assert.equal(lookupCalled, false);
});

test("status update returns 404 for a missing user", async (t) => {
  restoreAfter(t, userModel, { findById: async () => null });
  const res = makeResponse();
  await updateUserStatus({ params: { id: userId }, body: { status: "rejected" } }, res);
  assert.equal(res.statusCode, 404);
});

test("dashboard statistics aggregate existing users, events, bookings, and applications", async (t) => {
  restoreAfter(t, userModel, {
    aggregate: async () => [{
      total: [{ count: 3 }],
      byRole: [{ _id: "user", count: 2 }, { _id: "admin", count: 1 }],
      byStatus: [{ _id: "approved", count: 2 }, { _id: "pending", count: 1 }],
    }],
  });
  restoreAfter(t, Event, {
    aggregate: async () => [{
      total: [{ count: 2 }],
      byVisibility: [{ _id: "private", count: 1 }, { _id: "public", count: 1 }],
      byStatus: [{ _id: "scheduled", count: 2 }],
    }],
  });
  restoreAfter(t, bookingModel, {
    aggregate: async () => [{
      total: [{ count: 4 }],
      byStatus: [{ _id: "confirmed", count: 3 }, { _id: "cancelled", count: 1 }],
    }],
  });
  restoreAfter(t, organizerApplicationModel, {
    aggregate: async () => [{
      total: [{ count: 1 }],
      byStatus: [{ _id: "pending", count: 1 }],
    }],
  });

  const res = makeResponse();
  await getDashboardStats({}, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.users.total, 3);
  assert.equal(res.body.data.users.byRole.admin, 1);
  assert.equal(res.body.data.events.byVisibility.private, 1);
  assert.equal(res.body.data.bookings.byStatus.confirmed, 3);
  assert.equal(res.body.data.organizerApplications.byStatus.pending, 1);
});

test("admin event listing includes all visibility and event statuses", async (t) => {
  const events = [
    { _id: "public-event", visibility: "public", status: "scheduled" },
    { _id: "private-event", visibility: "private", status: "cancelled" },
  ];
  let queryFilter;
  let populated;
  let sortOrder;
  const query = {
    populate(...args) { populated = args; return query; },
    sort(value) { sortOrder = value; return Promise.resolve(events); },
  };
  restoreAfter(t, Event, {
    find: (filter) => { queryFilter = filter; return query; },
  });

  const res = makeResponse();
  await getAllEvents({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(queryFilter, {});
  assert.deepEqual(populated, ["organizer", "name email"]);
  assert.deepEqual(sortOrder, { createdAt: -1 });
  assert.deepEqual(res.body.data, events);
});

test("admin routes require authentication and admin role", () => {
  const routes = adminRoutes.stack.filter((layer) => layer.route);
  assert.equal(routes.length, 5);

  const routeKeys = routes.map(
    ({ route }) => `${Object.keys(route.methods)[0].toUpperCase()} ${route.path}`,
  );
  assert.ok(routeKeys.includes("GET /api/admin/stats"));
  assert.ok(routeKeys.includes("PATCH /api/admin/users/:id"));

  for (const layer of routes) {
    const handlers = layer.route.stack.map(({ handle }) => handle);
    assert.equal(handlers[0], verifyToken);
    assert.equal(handlers[1], verifyAdmin);
  }
});

test("verifyAdmin denies non-admins and allows admins", async () => {
  const regularRes = makeResponse();
  let regularNext = false;
  verifyAdmin({ user: { role: "user" } }, regularRes, () => { regularNext = true; });
  assert.equal(regularRes.statusCode, 403);
  assert.equal(regularNext, false);

  const adminRes = makeResponse();
  let adminNext = false;
  verifyAdmin({ user: { role: "admin" } }, adminRes, () => { adminNext = true; });
  assert.equal(adminNext, true);
});

test("login issues a token accepted by verifyToken when JWT_SECRET is unset", async (t) => {
  const originalJwtSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  t.after(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  const user = {
    _id: userId,
    name: "Token User",
    email: "token-user@example.com",
    role: "user",
    status: "approved",
    passwordHash: bcrypt.hashSync("token-password", 8),
  };
  restoreAfter(t, userModel, {
    findOne: async () => user,
    findById: async (id) => String(id) === userId ? user : null,
  });

  const loginRes = makeResponse();
  await login(
    { body: { email: user.email, password: "token-password" } },
    loginRes,
  );
  assert.equal(loginRes.statusCode, 200);

  const authRes = makeResponse();
  let nextCalled = false;
  await new Promise((resolve, reject) => {
    verifyToken(
      { headers: { authorization: `Bearer ${loginRes.body.token}` } },
      authRes,
      (error) => {
        if (error) return reject(error);
        nextCalled = true;
        resolve();
      },
    );
  });
  assert.equal(nextCalled, true);
});
