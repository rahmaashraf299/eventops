import assert from "node:assert/strict";
import test from "node:test";
import Event from "../db/models/eventModel.js";
import { seatModel } from "../db/models/seat.model.js";
import { bookingModel } from "../db/models/booking.model.js";
import { verifyOrganizer, verifyToken } from "../src/middleware/auth.middleware.js";
import {
  validateCreateEvent,
  validateInviteUsers,
  validateUpdateEvent,
} from "../src/middleware/eventMiddleware.js";
import { createEventValidation } from "../src/modules/event/eventValidation.js";
import eventRoutes from "../src/modules/event/eventRoutes.js";
import {
  createEvent,
  getEventById,
  inviteUsersToEvent,
  updateEvent,
} from "../src/modules/event/eventController.js";
import {
  createBooking,
  getSeats,
} from "../src/modules/booking/booking.controller.js";

const eventId = "64b000000000000000000001";
const organizerId = "64b000000000000000000002";
const seatId = "64b000000000000000000003";

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

const runMiddleware = (middleware, req, res) =>
  new Promise((resolve, reject) => {
    let nextCalled = false;
    middleware(req, res, (error) => {
      nextCalled = true;
      error ? reject(error) : resolve();
    });
    if (!nextCalled) resolve();
  });

const makeEvent = (overrides = {}) => ({
  _id: eventId,
  organizer: organizerId,
  visibility: "private",
  invitedEmails: ["existing@example.com"],
  startsAt: new Date("2027-01-02T10:00:00.000Z"),
  endsAt: new Date("2027-01-02T11:00:00.000Z"),
  registrationDeadline: new Date("2027-01-01T10:00:00.000Z"),
  status: "scheduled",
  price: 0,
  capacity: 1,
  save: async () => {},
  ...overrides,
});

const restoreAfter = (t, object, replacements) => {
  const originals = Object.fromEntries(
    Object.keys(replacements).map((key) => [key, object[key]]),
  );
  Object.assign(object, replacements);
  t.after(() => Object.assign(object, originals));
};

const updateWithBody = async (req) => {
  const res = makeResponse();
  await runMiddleware(validateUpdateEvent, req, res);
  if (res.statusCode === 200) await updateEvent(req, res);
  return res;
};

test("an approved organizer can create a private event with normalized invitees", async (t) => {
  let createdEvent;
  restoreAfter(t, Event, {
    create: async (data) => {
      createdEvent = { ...data, _id: eventId };
      return createdEvent;
    },
  });
  const req = {
    user: { _id: organizerId, role: "organizer", status: "approved" },
    body: {
      title: "Private Event",
      description: "A sufficiently long event description",
      venue: "Main hall",
      startsAt: "2027-01-02T10:00:00.000Z",
      endsAt: "2027-01-02T11:00:00.000Z",
      registrationDeadline: "2027-01-01T10:00:00.000Z",
      capacity: 5,
      price: 0,
      visibility: "private",
      invitedEmails: [" Guest@Example.com "],
    },
  };
  const authRes = makeResponse();
  await runMiddleware(verifyOrganizer, req, authRes);
  assert.equal(authRes.statusCode, 200);
  const validationRes = makeResponse();
  await runMiddleware(validateCreateEvent, req, validationRes);
  assert.equal(validationRes.statusCode, 200);
  const res = makeResponse();
  await createEvent(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdEvent.visibility, "private");
  assert.deepEqual(createdEvent.invitedEmails, ["guest@example.com"]);
});

test("invited emails are normalized and invalid or duplicate addresses are rejected", () => {
  const payload = {
    title: "Private event",
    description: "A sufficiently long event description",
    venue: "Main hall",
    startsAt: "2027-01-02T10:00:00.000Z",
    endsAt: "2027-01-02T11:00:00.000Z",
    registrationDeadline: "2027-01-01T10:00:00.000Z",
    capacity: 5,
    price: 0,
    visibility: "private",
    invitedEmails: [" Guest@Example.com "],
  };

  const valid = createEventValidation.validate(payload);
  assert.equal(valid.error, undefined);
  assert.deepEqual(valid.value.invitedEmails, ["guest@example.com"]);

  for (const invitedEmails of [
    ["duplicate@example.com", " DUPLICATE@example.com "],
    ["not-an-email"],
  ]) {
    assert.ok(createEventValidation.validate({ ...payload, invitedEmails }).error);
  }
});

test("only approved organizers pass the organizer authorization middleware", async () => {
  let nextCalled = false;
  const approvedRes = makeResponse();
  await runMiddleware(
    verifyOrganizer,
    { user: { role: "organizer", status: "approved" } },
    approvedRes,
  ).then(() => { nextCalled = true; });
  assert.equal(nextCalled, true);

  const pendingRes = makeResponse();
  await runMiddleware(
    verifyOrganizer,
    { user: { role: "organizer", status: "pending" } },
    pendingRes,
  );
  assert.equal(pendingRes.statusCode, 403);
});

test("updating a private event adds normalized emails and preserves existing invites", async (t) => {
  const event = makeEvent();
  restoreAfter(t, Event, {
    findOne: async (filter) =>
      String(filter.organizer) === organizerId ? event : null,
  });

  const req = {
    params: { id: eventId },
    user: { _id: organizerId },
    body: { invitedEmails: [" New@Example.com ", "existing@example.com"] },
  };
  const res = await updateWithBody(req);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(event.invitedEmails, [
    "existing@example.com",
    "new@example.com",
  ]);
});

test("update validation rejects duplicate or malformed invitation emails", async () => {
  for (const invitedEmails of [
    ["duplicate@example.com", " DUPLICATE@example.com "],
    ["not-an-email"],
  ]) {
    const res = makeResponse();
    await runMiddleware(validateUpdateEvent, { body: { invitedEmails } }, res);
    assert.equal(res.statusCode, 400);
  }
});

test("an organizer can explicitly remove normalized addresses", async (t) => {
  const event = makeEvent();
  restoreAfter(t, Event, {
    findOne: async () => event,
  });

  const res = await updateWithBody({
    params: { id: eventId },
    user: { _id: organizerId },
    body: { removeInvitedEmails: [" EXISTING@example.com "] },
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(event.invitedEmails, []);
});

test("an organizer cannot modify another organizer's event", async (t) => {
  restoreAfter(t, Event, { findOne: async () => null });
  const res = makeResponse();

  await updateEvent(
    {
      params: { id: eventId },
      user: { _id: "64b000000000000000000099" },
      body: { invitedEmails: ["guest@example.com"] },
    },
    res,
  );

  assert.equal(res.statusCode, 404);
});

test("an unauthorized organizer cannot add invitees to another organizer's event", async (t) => {
  let lookupFilter;
  restoreAfter(t, Event, {
    findOne: async (filter) => {
      lookupFilter = filter;
      return null;
    },
  });

  const res = await updateWithBody({
    params: { id: eventId },
    user: { _id: "64b000000000000000000099" },
    body: { invitedEmails: ["guest@example.com"] },
  });

  assert.equal(res.statusCode, 404);
  assert.equal(String(lookupFilter.organizer), "64b000000000000000000099");
});

const stubBookingDependencies = (t, event) => {
  restoreAfter(t, Event, { findById: async () => event });
  restoreAfter(t, seatModel, {
    countDocuments: async () => 1,
    find: () => ({ select: async () => [] }),
    findOneAndUpdate: async () => ({ _id: seatId }),
  });
  restoreAfter(t, bookingModel, {
    findOne: async () => null,
    create: async (booking) => booking,
  });
};

const book = (email) =>
  createBooking(
    {
      params: { id: eventId },
      body: { seat: seatId },
      user: { _id: organizerId, email },
    },
    makeResponse(),
  );

test("a normalized invited user can book a private event", async (t) => {
  stubBookingDependencies(
    t,
    makeEvent({ invitedEmails: ["guest@example.com"] }),
  );

  const res = await book(" Guest@Example.com ");
  assert.equal(res.statusCode, 201);
});

test("a user who is not invited receives 403 for a private event", async (t) => {
  stubBookingDependencies(
    t,
    makeEvent({ invitedEmails: ["guest@example.com"] }),
  );

  const res = await book("outsider@example.com");
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "You are not invited to this private event");
});

test("public event booking remains open to non-invited users", async (t) => {
  stubBookingDependencies(
    t,
    makeEvent({ visibility: "public", invitedEmails: [] }),
  );

  const res = await book("outsider@example.com");
  assert.equal(res.statusCode, 201);
});

test("non-invited users cannot read seats for a private event", async (t) => {
  let seatLookupCalled = false;
  restoreAfter(t, Event, {
    findById: async () => makeEvent({ invitedEmails: ["guest@example.com"] }),
  });
  restoreAfter(t, seatModel, {
    countDocuments: async () => { seatLookupCalled = true; return 1; },
  });

  const res = makeResponse();
  await getSeats(
    { params: { id: eventId }, user: { email: "outsider@example.com" } },
    res,
  );
  assert.equal(res.statusCode, 403);
  assert.equal(seatLookupCalled, false);
});

test("private event details are visible to invitees and hidden from others", async (t) => {
  restoreAfter(t, Event, {
    findOne: async () => makeEvent({ invitedEmails: ["guest@example.com"] }),
  });

  const invitedRes = makeResponse();
  await getEventById(
    { params: { id: eventId }, user: { email: " Guest@Example.com " } },
    invitedRes,
  );
  assert.equal(invitedRes.statusCode, 200);

  const outsiderRes = makeResponse();
  await getEventById({ params: { id: eventId }, user: { email: "outsider@example.com" } }, outsiderRes);
  assert.equal(outsiderRes.statusCode, 404);

  const anonymousRes = makeResponse();
  await getEventById({ params: { id: eventId } }, anonymousRes);
  assert.equal(anonymousRes.statusCode, 404);
});

test("invited users can read private event seats and anonymous public seat access remains available", async (t) => {
  restoreAfter(t, Event, {
    findById: async (_id) =>
      _id === eventId
        ? makeEvent({ invitedEmails: ["guest@example.com"] })
        : makeEvent({ visibility: "public", invitedEmails: [] }),
  });
  restoreAfter(t, seatModel, {
    countDocuments: async () => 1,
    find: () => ({
      select: async () => [],
      sort: async () => [{ _id: seatId, status: "available" }],
    }),
  });

  const invitedRes = makeResponse();
  await getSeats(
    { params: { id: eventId }, user: { email: " Guest@Example.com " } },
    invitedRes,
  );
  assert.equal(invitedRes.statusCode, 200);

  const publicRes = makeResponse();
  await getSeats({ params: { id: "64b000000000000000000099" } }, publicRes);
  assert.equal(publicRes.statusCode, 200);
});

test("an existing active booking is rejected without attempting another seat hold", async (t) => {
  let seatUpdateCalled = false;
  restoreAfter(t, Event, {
    findById: async () => makeEvent({ visibility: "public", invitedEmails: [] }),
  });
  restoreAfter(t, seatModel, {
    countDocuments: async () => 1,
    find: () => ({ select: async () => [] }),
    findOneAndUpdate: async () => { seatUpdateCalled = true; return { _id: seatId }; },
  });
  restoreAfter(t, bookingModel, {
    findOne: async () => ({ status: "confirmed" }),
  });

  const res = await createBooking(
    {
      params: { id: eventId },
      body: { seat: seatId },
      user: { _id: organizerId, email: "guest@example.com" },
    },
    makeResponse(),
  );
  assert.equal(res.statusCode, 409);
  assert.equal(seatUpdateCalled, false);
});

test("a fully occupied event rejects a booking when no capacity seat is available", async (t) => {
  restoreAfter(t, Event, {
    findById: async () => makeEvent({ visibility: "public", invitedEmails: [] }),
  });
  restoreAfter(t, seatModel, {
    countDocuments: async () => 1,
    find: () => ({ select: async () => [] }),
    findOneAndUpdate: async () => null,
  });
  restoreAfter(t, bookingModel, { findOne: async () => null });

  const res = await createBooking(
    {
      params: { id: eventId },
      body: { seat: seatId },
      user: { _id: organizerId, email: "guest@example.com" },
    },
    makeResponse(),
  );
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.message, "Seat is not available");
});

test("invalid private event invitation input returns 400", async () => {
  const req = {
    body: {
      title: "Private Event",
      description: "A sufficiently long event description",
      venue: "Main hall",
      startsAt: "2027-01-02T10:00:00.000Z",
      endsAt: "2027-01-02T11:00:00.000Z",
      registrationDeadline: "2027-01-01T10:00:00.000Z",
      capacity: 5,
      price: 0,
      visibility: "private",
      invitedEmails: ["not-an-email"],
    },
  };
  const res = makeResponse();
  await runMiddleware(validateCreateEvent, req, res);
  assert.equal(res.statusCode, 400);
});

test("the dedicated invite endpoint adds normalized invitees for the event owner", async (t) => {
  const event = makeEvent();
  restoreAfter(t, Event, {
    findOne: async (filter) =>
      String(filter.organizer) === organizerId ? event : null,
  });
  const req = {
    params: { id: eventId },
    user: { _id: organizerId },
    body: { invitedEmails: [" New@Example.com ", "existing@example.com"] },
  };
  const validationRes = makeResponse();
  await runMiddleware(validateInviteUsers, req, validationRes);
  assert.equal(validationRes.statusCode, 200);
  const res = makeResponse();
  await inviteUsersToEvent(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(event.invitedEmails, ["existing@example.com", "new@example.com"]);
});

test("POST /:id/invites applies token, approved-organizer, and invitation validation middleware", () => {
  const layer = eventRoutes.stack.find(
    (candidate) => candidate.route?.path === "/:id/invites",
  );
  assert.ok(layer);
  const handlers = layer.route.stack.map(({ handle }) => handle);
  assert.deepEqual(handlers, [
    verifyToken,
    verifyOrganizer,
    validateInviteUsers,
    inviteUsersToEvent,
  ]);
});

test("invite endpoint rejects invalid IDs, missing bodies, malformed and duplicate emails", async () => {
  const requests = [
    { params: { id: "bad-id" }, body: { invitedEmails: ["guest@example.com"] } },
    { params: { id: eventId }, body: undefined },
    { params: { id: eventId }, body: { invitedEmails: ["not-an-email"] } },
    {
      params: { id: eventId },
      body: { invitedEmails: ["guest@example.com", " Guest@Example.com "] },
    },
    {
      params: { id: eventId },
      body: { id: "64b000000000000000000099", invitedEmails: ["guest@example.com"] },
    },
  ];

  for (const req of requests) {
    const res = makeResponse();
    await runMiddleware(validateInviteUsers, req, res);
    assert.equal(res.statusCode, 400);
  }
});

test("invite endpoint requires the event to be private and owned by the organizer", async (t) => {
  const event = makeEvent({ visibility: "public" });
  restoreAfter(t, Event, { findOne: async () => event });
  const req = {
    params: { id: eventId },
    user: { _id: organizerId },
    body: { invitedEmails: ["guest@example.com"] },
  };
  const validationRes = makeResponse();
  await runMiddleware(validateInviteUsers, req, validationRes);
  const res = makeResponse();
  await inviteUsersToEvent(req, res);
  assert.equal(res.statusCode, 400);

  restoreAfter(t, Event, { findOne: async () => null });
  const unauthorizedRes = makeResponse();
  await inviteUsersToEvent(req, unauthorizedRes);
  assert.equal(unauthorizedRes.statusCode, 404);
});
