/* =========================================================
   EventOps · DEMO MODE (offline backend)
   ---------------------------------------------------------
   This file turns the real frontend into a fully working demo
   that runs with NO server and NO database.

   How it works:
   - It patches window.fetch and answers every /api/* request
     from a local JSON store kept in localStorage.
   - Data survives page reloads, so booking / paying / getting
     a ticket behaves like the real thing.
   - Everything is stored per browser (origin). Clearing site
     data (or the Reset button) restores the seed data.

   Demo accounts (password: demo1234)
     demo@eventops.test        (participant)
     organizer@eventops.test   (organizer)
     admin@eventops.test       (admin)
   ========================================================= */
(function () {
  "use strict";

  const DB_KEY = "eventops_demo_db_v1";
  const TOKEN_PREFIX = "demo";
  const DEMO_PASSWORD = "demo1234";
  const originalFetch = window.fetch ? window.fetch.bind(window) : null;

  /* ---------------------------------------------------------
     tiny helpers
     --------------------------------------------------------- */
  const nowMs = () => Date.now();
  const ISO = (ms) => new Date(ms).toISOString();

  function hex(size) {
    const bytes = new Uint8Array(size);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const oid = () => hex(12); // 24 hex chars, looks like a Mongo ObjectId
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const ok = (data, message = "OK") =>
    jsonResponse(200, { success: true, message, data });
  const created = (data, message = "Created") =>
    jsonResponse(201, { success: true, message, data });
  const fail = (status, message) =>
    jsonResponse(status, { success: false, message });

  /* ---------------------------------------------------------
     seed data
     --------------------------------------------------------- */
  function seed() {
    const t = nowMs();
    const D = 86400000;
    const H = 3600000;

    const users = [
      { _id: oid(), name: "Demo User", email: "demo@eventops.test", password: DEMO_PASSWORD, role: "user", status: "approved" },
      { _id: oid(), name: "Omar Organizer", email: "organizer@eventops.test", password: DEMO_PASSWORD, role: "organizer", status: "approved" },
      { _id: oid(), name: "Aya Admin", email: "admin@eventops.test", password: DEMO_PASSWORD, role: "admin", status: "approved" },
      { _id: oid(), name: "Sara Hassan", email: "sara@example.com", password: DEMO_PASSWORD, role: "user", status: "approved" },
      { _id: oid(), name: "Mohamed Ali", email: "mohamed@example.com", password: DEMO_PASSWORD, role: "user", status: "approved" },
      { _id: oid(), name: "Nour Adel", email: "nour@example.com", password: DEMO_PASSWORD, role: "user", status: "pending" },
      { _id: oid(), name: "Karim Adel", email: "karim@example.com", password: DEMO_PASSWORD, role: "user", status: "approved" },
    ];

    const demo = users[0];
    const organizer = users[1];

    const eventSeed = [
      {
        title: "Cairo Tech Summit 2026",
        description: "A full day of talks about AI, cloud, software engineering and modern developer tools.",
        venue: "Cairo Convention Center",
        inDays: 7, hour: 10, hours: 7, capacity: 60, price: 250,
      },
      {
        title: "AI & Data Science Meetup",
        description: "Hands-on meetup about machine learning, data engineering and practical AI products.",
        venue: "Nile Innovation Hub",
        inDays: 12, hour: 18, hours: 3, capacity: 40, price: 0,
      },
      {
        title: "Startup Business Forum",
        description: "Founders, investors and market experts share how to grow a startup in 2026.",
        venue: "Downtown Business Center",
        inDays: 20, hour: 9, hours: 5, capacity: 50, price: 400,
      },
      {
        title: "Desert Music Festival",
        description: "An open-air live music festival with bands, DJs and a full night of concerts.",
        venue: "Saqqara Desert Stage",
        inDays: 30, hour: 19, hours: 6, capacity: 80, price: 300,
      },
      {
        title: "UI/UX Design Workshop",
        description: "Creative workshop about design systems, product thinking and modern UI patterns.",
        venue: "Design Lab, Zamalek",
        inDays: 5, hour: 16, hours: 3, capacity: 30, price: 150,
      },
      {
        title: "Street Food Tasting Night",
        description: "A culinary night with the best street food chefs, tasting stations and drinks.",
        venue: "Al Khalifa Rooftop",
        inDays: 15, hour: 20, hours: 3, capacity: 45, price: 200,
      },
      {
        title: "Cloud & DevOps Bootcamp",
        description: "Intensive bootcamp covering cloud infrastructure, containers and CI/CD pipelines.",
        venue: "Smart Village Hall B",
        inDays: 25, hour: 9, hours: 8, capacity: 35, price: 500,
      },
      {
        title: "Creative Product Design Lab",
        description: "Free design lab for students: prototyping, creative thinking and portfolio reviews.",
        venue: "Cairo University Innovation Lab",
        inDays: 9, hour: 13, hours: 4, capacity: 30, price: 0,
      },
      {
        title: "Founders Private Dinner",
        description: "Invite-only dinner for founders and investors to network and share ideas.",
        venue: "Downtown Rooftop",
        inDays: 18, hour: 20, hours: 3, capacity: 20, price: 800,
        visibility: "private",
        invitedEmails: ["demo@eventops.test", "sara@example.com"],
      },
      {
        title: "Winter Music Concert",
        description: "Live concert with an orchestra and guest bands performing classic and modern music.",
        venue: "Cairo Opera House",
        inDays: 40, hour: 19, hours: 3, capacity: 60, price: 350,
      },
    ];

    const events = eventSeed.map((e) => {
      const start = new Date(t + e.inDays * D);
      start.setHours(e.hour, 0, 0, 0);
      const end = new Date(start.getTime() + e.hours * H);
      const deadline = new Date(start.getTime() - 1 * D);
      return {
        _id: oid(),
        organizer: organizer._id,
        title: e.title,
        description: e.description,
        venue: e.venue,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        registrationDeadline: deadline.toISOString(),
        capacity: e.capacity,
        price: e.price,
        visibility: e.visibility || "public",
        invitedEmails: e.invitedEmails || [],
        status: "scheduled",
        createdAt: ISO(t),
        updatedAt: ISO(t),
      };
    });

    const seats = [];
    events.forEach((ev) => {
      for (let i = 0; i < ev.capacity; i++) {
        seats.push({
          _id: oid(),
          event: ev._id,
          label: "S" + (i + 1),
          status: "available",
          heldBy: null,
          holdExpiresAt: null,
          createdAt: ISO(t),
          updatedAt: ISO(t),
        });
      }
    });

    const bookings = [];
    const tickets = [];
    const payments = [];

    function issueTicketFor(booking) {
      const tk = {
        _id: oid(),
        booking: booking._id,
        event: booking.event,
        user: booking.user,
        qrToken: hex(24),
        status: "valid",
        checkedInAt: null,
        createdAt: ISO(t),
        updatedAt: ISO(t),
      };
      tickets.push(tk);
      return tk;
    }

    function seedBooking(evIndex, user, seatIndex, status) {
      const ev = events[evIndex];
      const evSeats = seats.filter((s) => s.event === ev._id);
      const seat = evSeats[seatIndex];
      if (!seat) return null;
      seat.status = status === "confirmed" ? "booked" : "held";
      seat.heldBy = status === "confirmed" ? null : user._id;
      seat.holdExpiresAt =
        status === "confirmed" ? null : ISO(t + 10 * 60 * 1000);
      seat.updatedAt = ISO(t);

      const b = {
        _id: oid(),
        event: ev._id,
        user: user._id,
        seat: seat._id,
        status,
        expiresAt: status === "confirmed" ? null : ISO(t + 10 * 60 * 1000),
        createdAt: ISO(t - 2 * H),
        updatedAt: ISO(t - 2 * H),
      };
      bookings.push(b);
      if (status === "confirmed") {
        issueTicketFor(b);
        if (Number(ev.price) > 0) {
          payments.push({
            _id: oid(),
            booking: b._id,
            provider: "mock",
            providerRef: "DEMO-" + hex(4).toUpperCase(),
            amount: ev.price,
            fee: 0,
            net: ev.price,
            status: "succeeded",
            createdAt: ISO(t - 2 * H),
            updatedAt: ISO(t - 2 * H),
          });
        }
      }
      return b;
    }

    // The demo participant already owns two tickets (one paid, one free).
    seedBooking(0, demo, 4, "confirmed");
    seedBooking(1, demo, 1, "confirmed");

    // Some other attendees so organizer pages have data.
    seedBooking(0, users[3], 9, "confirmed");
    seedBooking(0, users[4], 10, "confirmed");
    seedBooking(1, users[5], 3, "confirmed");
    seedBooking(5, users[6], 0, "confirmed");

    const organizerApplications = [
      {
        _id: oid(),
        user: users[4]._id,
        organizationName: "Mohamed Events Co.",
        status: "pending",
        reviewNotes: "",
        createdAt: ISO(t - 1 * D),
        updatedAt: ISO(t - 1 * D),
      },
    ];

    const supportTickets = [
      {
        _id: oid(),
        user: demo._id,
        subject: "How do I download my ticket?",
        message: "Hi, I booked an event but I can't find the QR code. Can you help?",
        status: "open",
        relatedBooking: bookings[0] ? bookings[0]._id : null,
        replies: [],
        createdAt: ISO(t - 3 * H),
        updatedAt: ISO(t - 3 * H),
      },
    ];

    return {
      version: 1,
      users,
      events,
      seats,
      bookings,
      tickets,
      payments,
      organizerApplications,
      supportTickets,
    };
  }

  /* ---------------------------------------------------------
     storage
     --------------------------------------------------------- */
  function loadDB() {
    let raw = null;
    try {
      raw = localStorage.getItem(DB_KEY);
    } catch {
      raw = null;
    }
    if (!raw) {
      const fresh = seed();
      saveDB(fresh);
      return fresh;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) throw new Error("old");
      return parsed;
    } catch {
      const fresh = seed();
      saveDB(fresh);
      return fresh;
    }
  }

  function saveDB(db) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn("[demo] could not save data", e);
    }
  }

  function resetDB() {
    try {
      localStorage.removeItem(DB_KEY);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch {}
    window.location.reload();
  }

  /* ---------------------------------------------------------
     auth helpers
     --------------------------------------------------------- */
  function tokenFor(user) {
    return `${TOKEN_PREFIX}.${user._id}.${hex(6)}`;
  }

  function userFromRequest(db, headers) {
    const auth = headers && (headers.get ? headers.get("authorization") : headers.Authorization);
    if (!auth) return null;
    const m = /^Bearer\s+demo\.([a-f0-9]{24})\./i.exec(String(auth));
    if (!m) return null;
    return db.users.find((u) => u._id === m[1]) || null;
  }

  function publicUser(u) {
    return {
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
    };
  }

  function adminUser(u) {
    return {
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt || ISO(nowMs()),
    };
  }

  /* ---------------------------------------------------------
     resource helpers
     --------------------------------------------------------- */
  const findEvent = (db, id) => db.events.find((e) => e._id === id) || null;
  const findSeat = (db, id) => db.seats.find((s) => s._id === id) || null;
  const findBooking = (db, id) => db.bookings.find((b) => b._id === id) || null;
  const findUser = (db, id) => db.users.find((u) => u._id === id) || null;

  function eventSeats(db, eventId) {
    return db.seats.filter((s) => s.event === eventId);
  }

  function populatedEvent(db, ev) {
    if (!ev) return null;
    const org = findUser(db, ev.organizer);
    return {
      ...ev,
      organizer: org ? { _id: org._id, name: org.name, email: org.email } : ev.organizer,
    };
  }

  function populatedBooking(db, b) {
    const ev = findEvent(db, b.event);
    const seat = findSeat(db, b.seat);
    return {
      ...b,
      event: ev ? clone(ev) : b.event,
      seat: seat ? clone(seat) : b.seat,
    };
  }

  function issueTicket(db, booking) {
    let tk = db.tickets.find((t) => t.booking === booking._id);
    if (tk) return tk;
    tk = {
      _id: oid(),
      booking: booking._id,
      event: booking.event,
      user: booking.user,
      qrToken: hex(24),
      status: "valid",
      checkedInAt: null,
      createdAt: ISO(nowMs()),
      updatedAt: ISO(nowMs()),
    };
    db.tickets.push(tk);
    return tk;
  }

  function qrUrl(token) {
    return (
      "https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=" +
      encodeURIComponent(token)
    );
  }

  function canAccessEvent(db, ev, user) {
    if (!ev) return false;
    if (ev.visibility !== "private") return true;
    if (!user) return false;
    if (user.role === "admin") return true;
    if (String(ev.organizer) === String(user._id)) return true;
    const email = (user.email || "").toLowerCase();
    return (ev.invitedEmails || []).some((e) => String(e).toLowerCase() === email);
  }

  function canManageEvent(db, ev, user) {
    if (!ev || !user) return false;
    return user.role === "admin" || String(ev.organizer) === String(user._id);
  }

  /* ---------------------------------------------------------
     query filters (events listing)
     --------------------------------------------------------- */
  function filterEvents(db, q, user) {
    let list = db.events.slice();

    const organizer = q.get("organizer");
    if (organizer === "me") {
      if (!user) return [];
      list = list.filter((e) => e.organizer === user._id);
    } else if (organizer) {
      list = list.filter((e) => e.organizer === organizer);
    }

    if (!organizer || organizer !== "me") {
      list = list.filter((e) => e.status !== "cancelled");
    }

    if (q.get("search")) {
      const s = q.get("search").toLowerCase();
      list = list.filter((e) =>
        `${e.title} ${e.description} ${e.venue}`.toLowerCase().includes(s)
      );
    }

    if (q.get("minPrice") != null && q.get("minPrice") !== "")
      list = list.filter((e) => Number(e.price) >= Number(q.get("minPrice")));
    if (q.get("maxPrice") != null && q.get("maxPrice") !== "")
      list = list.filter((e) => Number(e.price) <= Number(q.get("maxPrice")));

    if (q.get("startsAfter"))
      list = list.filter((e) => new Date(e.startsAt) >= new Date(q.get("startsAfter")));
    if (q.get("startsBefore"))
      list = list.filter((e) => new Date(e.startsAt) <= new Date(q.get("startsBefore")));

    const status = q.get("status");
    if (status) list = list.filter((e) => e.status === status);

    // Private events are only visible to their organizer / invitees.
    list = list.filter((e) => {
      if (e.visibility !== "private") return true;
      if (!user) return false;
      if (user.role === "admin") return true;
      if (String(e.organizer) === String(user._id)) return true;
      const email = (user.email || "").toLowerCase();
      return (e.invitedEmails || []).some((x) => String(x).toLowerCase() === email);
    });

    const sort = q.get("sort");
    if (sort === "price_asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") list.sort((a, b) => b.price - a.price);
    else if (sort === "date_desc") list.sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
    else list.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

    return list;
  }

  /* ---------------------------------------------------------
     report calculator (shared by reports + export)
     --------------------------------------------------------- */
  function buildReport(db, ev) {
    const bookings = db.bookings.filter((b) => b.event === ev._id);
    const count = (st) => bookings.filter((b) => b.status === st).length;
    const confirmed = count("confirmed");
    const tickets = db.tickets.filter((t) => t.event === ev._id);
    const checkedIn = tickets.filter((t) => t.status === "used").length;

    return {
      event: {
        _id: ev._id,
        title: ev.title,
        capacity: ev.capacity,
        price: ev.price,
        status: ev.status,
      },
      capacity: ev.capacity,
      bookings: {
        confirmed,
        pendingPayment: count("pending_payment"),
        cancelled: count("cancelled"),
        expired: count("expired"),
      },
      tickets: {
        issued: tickets.length,
        checkedIn,
        notCheckedIn: tickets.length - checkedIn,
      },
      revenue: confirmed * Number(ev.price || 0),
    };
  }

  /* ---------------------------------------------------------
     request router
     --------------------------------------------------------- */
  async function handle(method, path, q, body, headers) {
    const db = loadDB();
    const user = userFromRequest(db, headers);

    /* ---------- auth ---------- */
    if (method === "POST" && path === "/api/auth/signup") {
      const name = String((body && body.name) || "").trim();
      const email = String((body && body.email) || "").trim().toLowerCase();
      const password = String((body && body.password) || "");
      const role = (body && body.role) === "organizer" ? "organizer" : "user";

      if (!name) return fail(400, "Name is required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, "Enter a valid email address");
      if (password.length < 6) return fail(400, "Password must be at least 6 characters");
      if (db.users.some((u) => u.email === email)) return fail(400, "This email is already registered");

      const newUser = {
        _id: oid(),
        name,
        email,
        password,
        role,
        status: "approved", // demo: no email verification needed
        createdAt: ISO(nowMs()),
      };
      db.users.push(newUser);
      saveDB(db);

      return created(
        { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role, status: newUser.status },
        "Account created successfully"
      );
    }

    if (method === "POST" && path === "/api/auth/login") {
      const email = String((body && body.email) || "").trim().toLowerCase();
      const password = String((body && body.password) || "");
      const found = db.users.find((u) => u.email === email);

      if (!found || found.password !== password) return fail(401, "Invalid email or password");
      if (found.status === "rejected") return fail(403, "Your account has been rejected.");
      if (found.status === "blocked") return fail(403, "Your account has been blocked.");
      if (found.status === "pending")
        return fail(403, "Your account is pending approval. Please contact support.");

      return jsonResponse(200, {
        success: true,
        message: "Login successful",
        token: tokenFor(found),
        data: publicUser(found),
      });
    }

    /* ---------- profile ---------- */
    if (path === "/api/users/me") {
      if (!user) return fail(401, "Unauthorized");
      if (method === "GET")
        return ok(publicUser(user), "Profile fetched successfully");
      if (method === "PUT" || method === "PATCH") {
        if (body && body.name) user.name = String(body.name).trim();
        if (body && body.email) user.email = String(body.email).trim().toLowerCase();
        saveDB(db);
        return ok(publicUser(user), "Profile updated successfully");
      }
    }

    /* ---------- organizer applications ---------- */
    if (method === "POST" && path === "/api/organizer-applications") {
      if (!user) return fail(401, "Unauthorized");
      if (user.role === "organizer") return fail(400, "You are already an organizer");
      const pending = db.organizerApplications.find(
        (a) => a.user === user._id && a.status === "pending"
      );
      if (pending) return fail(409, "You already have a pending application");

      const app = {
        _id: oid(),
        user: user._id,
        organizationName: String((body && body.organizationName) || "My Organization"),
        status: "pending",
        reviewNotes: "",
        createdAt: ISO(nowMs()),
        updatedAt: ISO(nowMs()),
      };
      db.organizerApplications.push(app);
      saveDB(db);
      return created(app, "Application submitted successfully");
    }

    if (method === "GET" && path === "/api/organizer-applications/me") {
      if (!user) return fail(401, "Unauthorized");
      const list = db.organizerApplications
        .filter((a) => a.user === user._id)
        .map((a) => ({ ...a, user: publicUser(user) }));
      return ok(list, "Applications retrieved successfully");
    }

    /* ---------- admin ---------- */
    if (path === "/api/admin/organizer-applications") {
      if (!user || user.role !== "admin") return fail(403, "Admin access required");
      const status = q.get("status");
      const page = Math.max(1, Number(q.get("page") || 1));
      const limit = Math.max(1, Number(q.get("limit") || 10));
      let list = db.organizerApplications.slice();
      if (status) list = list.filter((a) => a.status === status);
      const total = list.length;
      list = list
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice((page - 1) * limit, page * limit)
        .map((a) => {
          const u = findUser(db, a.user);
          return { ...a, user: u ? publicUser(u) : null };
        });
      return jsonResponse(200, {
        success: true,
        message: "Applications retrieved successfully",
        data: list,
        pagination: { page, pages: Math.max(1, Math.ceil(total / limit)), total },
      });
    }

    let m = path.match(/^\/api\/admin\/organizer-applications\/([^/]+)$/);
    if (m && method === "PATCH") {
      if (!user || user.role !== "admin") return fail(403, "Admin access required");
      const app = db.organizerApplications.find((a) => a._id === m[1]);
      if (!app) return fail(404, "Application not found");
      const status = body && body.status;
      if (!["approved", "rejected", "pending"].includes(status)) return fail(400, "Invalid status");
      app.status = status;
      app.reviewNotes = (body && body.reviewNotes) || "";
      app.updatedAt = ISO(nowMs());
      const applicant = findUser(db, app.user);
      if (applicant) {
        if (status === "approved") {
          applicant.role = "organizer";
          applicant.status = "approved";
        } else if (status === "rejected") {
          applicant.status = "approved";
        }
      }
      saveDB(db);
      return ok({ ...app, user: applicant ? publicUser(applicant) : null }, "Application reviewed");
    }

    if (method === "GET" && path === "/api/admin/users") {
      if (!user || user.role !== "admin") return fail(403, "Admin access required");
      const role = q.get("role");
      const search = (q.get("search") || "").toLowerCase();
      const page = Math.max(1, Number(q.get("page") || 1));
      const limit = Math.max(1, Number(q.get("limit") || 10));
      let list = db.users.slice();
      if (role) list = list.filter((u) => u.role === role);
      if (search)
        list = list.filter((u) =>
          `${u.name} ${u.email}`.toLowerCase().includes(search)
        );
      const total = list.length;
      const pageList = list
        .slice((page - 1) * limit, page * limit)
        .map(adminUser);
      return jsonResponse(200, {
        success: true,
        message: "Users retrieved successfully",
        data: pageList,
        pagination: { page, pages: Math.max(1, Math.ceil(total / limit)), total },
      });
    }

    m = path.match(/^\/api\/admin\/users\/([^/]+)\/status$/);
    if (m && method === "PATCH") {
      if (!user || user.role !== "admin") return fail(403, "Admin access required");
      const target = findUser(db, m[1]);
      if (!target) return fail(404, "User not found");
      if (target.role === "admin") return fail(400, "Admin accounts are protected");
      target.status = (body && body.status) || "approved";
      saveDB(db);
      return ok(adminUser(target), "User status updated");
    }

    if (method === "GET" && path === "/api/admin/events") {
      if (!user || user.role !== "admin") return fail(403, "Admin access required");
      return ok(
        db.events.map((e) => {
          const org = findUser(db, e.organizer);
          return { ...e, organizer: org ? publicUser(org) : null };
        }),
        "Events retrieved successfully"
      );
    }

    if (method === "GET" && path === "/api/admin/stats") {
      if (!user || user.role !== "admin") return fail(403, "Admin access required");
      const byRole = { user: 0, organizer: 0, admin: 0 };
      const byStatus = { pending: 0, approved: 0, rejected: 0, blocked: 0 };
      db.users.forEach((u) => {
        byRole[u.role] = (byRole[u.role] || 0) + 1;
        byStatus[u.status] = (byStatus[u.status] || 0) + 1;
      });
      const eventsByStatus = { scheduled: 0, cancelled: 0, completed: 0 };
      db.events.forEach((e) => {
        eventsByStatus[e.status] = (eventsByStatus[e.status] || 0) + 1;
      });
      const appsByStatus = { pending: 0, approved: 0, rejected: 0 };
      db.organizerApplications.forEach((a) => {
        appsByStatus[a.status] = (appsByStatus[a.status] || 0) + 1;
      });

      const confirmed = db.bookings.filter((b) => b.status === "confirmed");
      const revenue = confirmed.reduce((sum, b) => {
        const ev = findEvent(db, b.event);
        return sum + Number(ev ? ev.price : 0);
      }, 0);

      const soldByEvent = {};
      confirmed.forEach((b) => {
        const ev = findEvent(db, b.event);
        if (!ev) return;
        soldByEvent[ev._id] = (soldByEvent[ev._id] || 0) + 1;
      });

      return jsonResponse(200, {
        success: true,
        message: "Statistics retrieved successfully",
        data: {
          users: { total: db.users.length, byRole, byStatus },
          events: { total: db.events.length, byStatus: eventsByStatus },
          bookings: {
            total: db.bookings.length,
            confirmed: confirmed.length,
          },
          organizerApplications: { total: db.organizerApplications.length, byStatus: appsByStatus },
          ticketsSold: db.tickets.length,
          revenue,
          revenueByMonth: [{ _id: new Date().toLocaleString("en-US", { month: "short" }), revenue }],
          recentApplications: db.organizerApplications
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5)
            .map((a) => {
              const u = findUser(db, a.user);
              return { ...a, user: u ? publicUser(u) : null };
            }),
          topEvents: db.events
            .map((e) => ({
              _id: e._id,
              title: e.title,
              price: e.price,
              sold: soldByEvent[e._id] || 0,
            }))
            .filter((e) => e.sold > 0)
            .sort((a, b) => b.sold * b.price - a.sold * a.price)
            .slice(0, 5),
        },
      });
    }

    /* ---------- events ---------- */
    if (method === "GET" && path === "/api/events") {
      return ok(filterEvents(db, q, user), "Events retrieved successfully");
    }

    if (method === "POST" && path === "/api/events") {
      if (!user) return fail(401, "Unauthorized");
      if (user.role !== "organizer" && user.role !== "admin")
        return fail(403, "Only organizers can create events");
      const b = body || {};
      const required = ["title", "description", "venue", "startsAt", "endsAt", "registrationDeadline", "capacity", "price"];
      for (const key of required) {
        if (b[key] === undefined || b[key] === null || b[key] === "") {
          return fail(400, `${key} is required`);
        }
      }
      const ev = {
        _id: oid(),
        organizer: user._id,
        title: String(b.title),
        description: String(b.description),
        venue: String(b.venue),
        startsAt: new Date(b.startsAt).toISOString(),
        endsAt: new Date(b.endsAt).toISOString(),
        registrationDeadline: new Date(b.registrationDeadline).toISOString(),
        capacity: Math.max(1, Number(b.capacity)),
        price: Math.max(0, Number(b.price)),
        visibility: b.visibility === "private" ? "private" : "public",
        invitedEmails: Array.isArray(b.invitedEmails) ? b.invitedEmails : [],
        status: "scheduled",
        createdAt: ISO(nowMs()),
        updatedAt: ISO(nowMs()),
      };
      db.events.push(ev);
      for (let i = 0; i < ev.capacity; i++) {
        db.seats.push({
          _id: oid(),
          event: ev._id,
          label: "S" + (i + 1),
          status: "available",
          heldBy: null,
          holdExpiresAt: null,
          createdAt: ISO(nowMs()),
          updatedAt: ISO(nowMs()),
        });
      }
      saveDB(db);
      return created(ev, "Event created successfully");
    }

    m = path.match(/^\/api\/events\/([^/]+)$/);
    if (m && method === "GET") {
      const ev = findEvent(db, m[1]);
      if (!ev) return fail(404, "Event not found");
      if (!canAccessEvent(db, ev, user)) return fail(403, "You do not have access to this private event");
      return ok(populatedEvent(db, ev), "Event retrieved successfully");
    }

    if (m && method === "PATCH") {
      if (!user) return fail(401, "Unauthorized");
      const ev = findEvent(db, m[1]);
      if (!ev) return fail(404, "Event not found");
      if (!canManageEvent(db, ev, user)) return fail(403, "You can only edit your own events");
      const b = body || {};
      ["title", "description", "venue", "visibility", "status"].forEach((k) => {
        if (b[k] !== undefined) ev[k] = b[k];
      });
      ["startsAt", "endsAt", "registrationDeadline"].forEach((k) => {
        if (b[k]) ev[k] = new Date(b[k]).toISOString();
      });
      if (b.capacity !== undefined) ev.capacity = Math.max(1, Number(b.capacity));
      if (b.price !== undefined) ev.price = Math.max(0, Number(b.price));
      if (Array.isArray(b.removeInvitedEmails)) {
        ev.invitedEmails = (ev.invitedEmails || []).filter(
          (e) => !b.removeInvitedEmails.map((x) => String(x).toLowerCase()).includes(String(e).toLowerCase())
        );
      }
      ev.updatedAt = ISO(nowMs());
      saveDB(db);
      return ok(populatedEvent(db, ev), "Event updated successfully");
    }

    m = path.match(/^\/api\/events\/([^/]+)\/cancel$/);
    if (m && method === "POST") {
      if (!user) return fail(401, "Unauthorized");
      const ev = findEvent(db, m[1]);
      if (!ev) return fail(404, "Event not found");
      if (!canManageEvent(db, ev, user)) return fail(403, "You can only cancel your own events");
      ev.status = "cancelled";
      ev.updatedAt = ISO(nowMs());
      db.bookings
        .filter((b) => b.event === ev._id && ["pending_payment", "confirmed"].includes(b.status))
        .forEach((b) => {
          b.status = "cancelled";
          const seat = findSeat(db, b.seat);
          if (seat) {
            seat.status = "available";
            seat.heldBy = null;
            seat.holdExpiresAt = null;
          }
        });
      saveDB(db);
      return ok(ev, "Event cancelled successfully");
    }

    m = path.match(/^\/api\/events\/([^/]+)\/invites$/);
    if (m && method === "POST") {
      if (!user) return fail(401, "Unauthorized");
      const ev = findEvent(db, m[1]);
      if (!ev) return fail(404, "Event not found");
      if (!canManageEvent(db, ev, user)) return fail(403, "You can only invite to your own events");
      const emails = Array.isArray(body && body.invitedEmails) ? body.invitedEmails : [];
      const normalized = emails
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      ev.invitedEmails = Array.from(new Set([...(ev.invitedEmails || []), ...normalized]));
      saveDB(db);
      return ok(populatedEvent(db, ev), "Invitations updated successfully");
    }

    m = path.match(/^\/api\/events\/([^/]+)\/seats$/);
    if (m && method === "GET") {
      const ev = findEvent(db, m[1]);
      if (!ev) return fail(404, "Event not found");
      if (!canAccessEvent(db, ev, user)) return fail(403, "You do not have access to this private event");
      return ok(eventSeats(db, ev._id), "Seats retrieved successfully");
    }

    m = path.match(/^\/api\/events\/([^/]+)\/participants$/);
    if (m && method === "GET") {
      if (!user) return fail(401, "Unauthorized");
      const ev = findEvent(db, m[1]);
      if (!ev) return fail(404, "Event not found");
      if (!canManageEvent(db, ev, user)) return fail(403, "You can only view participants of your own events");
      const bookings = db.bookings
        .filter((b) => b.event === ev._id && b.status === "confirmed")
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const participants = bookings.map((b) => {
        const u = findUser(db, b.user);
        const seat = findSeat(db, b.seat);
        const tk = db.tickets.find((t) => t.booking === b._id);
        return {
          booking: b._id,
          user: u ? { _id: u._id, name: u.name, email: u.email } : null,
          seat: seat ? seat.label : null,
          ticketStatus: tk ? tk.status : "not_issued",
          checkedInAt: tk ? tk.checkedInAt : null,
        };
      });
      return ok(
        {
          event: { _id: ev._id, title: ev.title, capacity: ev.capacity, startsAt: ev.startsAt },
          count: participants.length,
          participants,
        },
        "Participants retrieved successfully"
      );
    }

    m = path.match(/^\/api\/events\/([^/]+)\/check-in$/);
    if (m && method === "POST") {
      if (!user) return fail(401, "Unauthorized");
      const ev = findEvent(db, m[1]);
      if (!ev) return fail(404, "Event not found");
      if (!canManageEvent(db, ev, user)) return fail(403, "You can only check in attendees of your own events");
      const token = String((body && body.qrToken) || "").trim();
      const tk = db.tickets.find((t) => t.event === ev._id && t.qrToken === token);
      if (!tk) return fail(404, "Ticket not found for this event");
      if (tk.status === "revoked") return fail(400, "Ticket has been revoked");
      if (tk.status === "used") return fail(409, "Ticket has already been checked in");
      tk.status = "used";
      tk.checkedInAt = ISO(nowMs());
      tk.updatedAt = ISO(nowMs());
      saveDB(db);
      return ok(tk, "Check-in successful");
    }

    m = path.match(/^\/api\/events\/([^/]+)\/reports$/);
    if (m && method === "GET") {
      if (!user) return fail(401, "Unauthorized");
      const ev = findEvent(db, m[1]);
      if (!ev) return fail(404, "Event not found");
      if (!canManageEvent(db, ev, user)) return fail(403, "You can only view reports of your own events");
      return ok(buildReport(db, ev), "Report generated successfully");
    }

    m = path.match(/^\/api\/events\/([^/]+)\/reports\/export$/);
    if (m && method === "GET") {
      if (!user) return fail(401, "Unauthorized");
      const ev = findEvent(db, m[1]);
      if (!ev) return fail(404, "Event not found");
      if (!canManageEvent(db, ev, user)) return fail(403, "You can only export reports of your own events");
      const bookings = db.bookings.filter((b) => b.event === ev._id && b.status === "confirmed");
      const rows = [["Name", "Email", "Seat", "Status", "Checked in"]];
      bookings.forEach((b) => {
        const u = findUser(db, b.user);
        const seat = findSeat(db, b.seat);
        const tk = db.tickets.find((t) => t.booking === b._id);
        rows.push([
          u ? u.name : "Unknown",
          u ? u.email : "",
          seat ? seat.label : "",
          b.status,
          tk && tk.checkedInAt ? "Yes" : "No",
        ]);
      });
      const csv = rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
      return new Response(csv, {
        status: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      });
    }

    /* ---------- bookings ---------- */
    m = path.match(/^\/api\/events\/([^/]+)\/bookings$/);
    if (m && method === "POST") {
      if (!user) return fail(401, "Unauthorized");
      const ev = findEvent(db, m[1]);
      if (!ev) return fail(404, "Event not found");
      if (ev.status !== "scheduled") return fail(400, "This event is not open for booking");
      if (new Date(ev.registrationDeadline) < new Date())
        return fail(400, "Registration deadline has passed");
      if (!canAccessEvent(db, ev, user))
        return fail(403, "You are not invited to this private event");

      const active = db.bookings.find(
        (b) => b.event === ev._id && b.user === user._id && ["pending_payment", "confirmed"].includes(b.status)
      );
      if (active) return fail(409, "You already have an active booking for this event");

      const seatId = body && (body.seat || body.seatId);
      const seat = findSeat(db, seatId);
      if (!seat || seat.event !== ev._id) return fail(404, "Seat not found");
      if (seat.status !== "available") return fail(409, "Seat is not available");

      const isFree = Number(ev.price) === 0;
      seat.status = isFree ? "booked" : "held";
      seat.heldBy = isFree ? null : user._id;
      seat.holdExpiresAt = isFree ? null : ISO(nowMs() + 10 * 60 * 1000);
      seat.updatedAt = ISO(nowMs());

      const booking = {
        _id: oid(),
        event: ev._id,
        user: user._id,
        seat: seat._id,
        status: isFree ? "confirmed" : "pending_payment",
        expiresAt: isFree ? null : ISO(nowMs() + 10 * 60 * 1000),
        createdAt: ISO(nowMs()),
        updatedAt: ISO(nowMs()),
      };
      db.bookings.push(booking);
      if (isFree) {
        issueTicket(db, booking);
        if (Number(ev.price) > 0) {
          db.payments.push({
            _id: oid(),
            booking: booking._id,
            provider: "mock",
            providerRef: "DEMO-" + hex(4).toUpperCase(),
            amount: ev.price,
            fee: 0,
            net: ev.price,
            status: "succeeded",
            createdAt: ISO(nowMs()),
            updatedAt: ISO(nowMs()),
          });
        }
      }
      saveDB(db);
      return created(
        booking,
        isFree ? "Booking confirmed (free event)" : "Booking created — awaiting payment"
      );
    }

    if (method === "GET" && path === "/api/bookings/me") {
      if (!user) return fail(401, "Unauthorized");
      const list = db.bookings
        .filter((b) => b.user === user._id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((b) => populatedBooking(db, b));
      return ok(list, "Bookings retrieved successfully");
    }

    m = path.match(/^\/api\/bookings\/([^/]+)\/ticket$/);
    if (m && method === "GET") {
      if (!user) return fail(401, "Unauthorized");
      const booking = findBooking(db, m[1]);
      if (!booking) return fail(404, "Booking not found");
      if (String(booking.user) !== String(user._id) && user.role !== "admin")
        return fail(403, "You are not allowed to view this ticket");
      if (booking.status !== "confirmed")
        return fail(400, "Ticket can only be issued for a confirmed booking");
      const tk = issueTicket(db, booking);
      saveDB(db);
      return ok(
        { ...tk, qrCode: qrUrl(tk.qrToken) },
        "Ticket retrieved successfully"
      );
    }

    m = path.match(/^\/api\/bookings\/([^/]+)\/cancel$/);
    if (m && method === "PATCH") {
      if (!user) return fail(401, "Unauthorized");
      const booking = findBooking(db, m[1]);
      if (!booking) return fail(404, "Booking not found");
      if (String(booking.user) !== String(user._id)) return fail(403, "You can only cancel your own booking");
      if (!["pending_payment", "confirmed"].includes(booking.status))
        return fail(400, `This booking is already ${booking.status}`);
      const ev = findEvent(db, booking.event);
      if (ev && ev.status === "cancelled") return fail(400, "This event has been cancelled by the organizer");

      booking.status = "cancelled";
      booking.updatedAt = ISO(nowMs());
      const seat = findSeat(db, booking.seat);
      if (seat) {
        seat.status = "available";
        seat.heldBy = null;
        seat.holdExpiresAt = null;
        seat.updatedAt = ISO(nowMs());
      }
      const tk = db.tickets.find((t) => t.booking === booking._id);
      if (tk) tk.status = "revoked";
      saveDB(db);
      const refunded = ev && Number(ev.price) > 0;
      return ok(
        { booking: populatedBooking(db, booking), refunded, amount: refunded ? ev.price : 0 },
        refunded ? "Booking cancelled and refunded" : "Booking cancelled successfully"
      );
    }

    m = path.match(/^\/api\/organizer\/bookings\/([^/]+)\/cancel$/);
    if (m && method === "PATCH") {
      if (!user) return fail(401, "Unauthorized");
      const booking = findBooking(db, m[1]);
      if (!booking) return fail(404, "Booking not found");
      const ev = findEvent(db, booking.event);
      if (!ev || !canManageEvent(db, ev, user))
        return fail(403, "You can only cancel bookings for your own events");
      if (!["pending_payment", "confirmed"].includes(booking.status))
        return fail(400, `Booking is already ${booking.status}`);
      booking.status = "cancelled";
      booking.updatedAt = ISO(nowMs());
      const seat = findSeat(db, booking.seat);
      if (seat) {
        seat.status = "available";
        seat.heldBy = null;
        seat.holdExpiresAt = null;
        seat.updatedAt = ISO(nowMs());
      }
      const tk = db.tickets.find((t) => t.booking === booking._id);
      if (tk) tk.status = "revoked";
      saveDB(db);
      return ok(populatedBooking(db, booking), "Booking cancelled successfully");
    }

    /* ---------- payments ---------- */
    if (method === "POST" && path === "/api/payments/initiate") {
      if (!user) return fail(401, "Unauthorized");
      const bookingId = body && body.bookingId;
      const booking = findBooking(db, bookingId);
      if (!booking) return fail(404, "Booking not found");
      if (String(booking.user) !== String(user._id)) return fail(403, "Not your booking");

      const pending = db.payments.find(
        (p) => p.booking === bookingId && p.status === "pending"
      );
      if (pending) return fail(409, "A pending transaction already exists for this booking");

      const ev = findEvent(db, booking.event);
      const amount = Number((body && body.amount) != null ? body.amount : ev ? ev.price : 0);
      const tx = {
        _id: oid(),
        booking: bookingId,
        provider: (body && body.provider) || "mock",
        providerRef: "DEMO-" + hex(4).toUpperCase(),
        amount,
        fee: 0,
        net: amount,
        status: "pending",
        createdAt: ISO(nowMs()),
        updatedAt: ISO(nowMs()),
      };
      db.payments.push(tx);
      saveDB(db);
      return created(tx, "Payment initiated successfully");
    }

    m = path.match(/^\/api\/payments\/mock-confirm\/([^/]+)$/);
    if (m && method === "POST") {
      if (!user) return fail(401, "Unauthorized");
      const tx = db.payments.find((p) => p._id === m[1]);
      if (!tx) return fail(404, "Transaction not found");
      if (tx.status === "succeeded") return fail(409, "Transaction is already succeeded");
      if (tx.status === "failed") return fail(409, "Transaction is already failed");

      tx.status = "succeeded";
      tx.updatedAt = ISO(nowMs());

      const booking = findBooking(db, tx.booking);
      let ticket = null;
      if (booking) {
        booking.status = "confirmed";
        booking.expiresAt = null;
        booking.updatedAt = ISO(nowMs());
        const seat = findSeat(db, booking.seat);
        if (seat) {
          seat.status = "booked";
          seat.heldBy = null;
          seat.holdExpiresAt = null;
          seat.updatedAt = ISO(nowMs());
        }
        ticket = issueTicket(db, booking);
      }
      saveDB(db);
      return ok(
        {
          transaction: tx,
          booking: booking ? populatedBooking(db, booking) : null,
          ticket: ticket ? { ...ticket, qrCode: qrUrl(ticket.qrToken) } : null,
        },
        "Payment confirmed successfully (mock)"
      );
    }

    m = path.match(/^\/api\/payments\/booking\/([^/]+)$/);
    if (m && method === "GET") {
      if (!user) return fail(401, "Unauthorized");
      const tx = db.payments
        .filter((p) => p.booking === m[1])
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (!tx) return fail(404, "No transaction found for this booking");
      return ok(tx, "Transaction retrieved successfully");
    }

    m = path.match(/^\/api\/payments\/([^/]+)$/);
    if (m && method === "GET") {
      const tx = db.payments.find((p) => p._id === m[1]);
      if (!tx) return fail(404, "Transaction not found");
      return ok(tx, "Transaction retrieved successfully");
    }

    /* ---------- support tickets ---------- */
    if (path === "/api/tickets") {
      if (!user) return fail(401, "Unauthorized");
      if (method === "POST") {
        const subject = String((body && body.subject) || "").trim();
        const message = String((body && body.message) || "").trim();
        if (!subject) return fail(400, "Subject is required");
        if (!message) return fail(400, "Message is required");
        const tk = {
          _id: oid(),
          user: user._id,
          subject,
          message,
          status: "open",
          relatedBooking: (body && body.relatedBooking) || null,
          replies: [],
          createdAt: ISO(nowMs()),
          updatedAt: ISO(nowMs()),
        };
        db.supportTickets.push(tk);
        saveDB(db);
        return created(tk, "Ticket created successfully");
      }
      if (method === "GET") {
        const status = q.get("status");
        let list = db.supportTickets.filter((t) => t.user === user._id);
        if (status) list = list.filter((t) => t.status === status);
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return ok(list, "Tickets retrieved successfully");
      }
    }

    m = path.match(/^\/api\/tickets\/([^/]+)$/);
    if (m) {
      if (!user) return fail(401, "Unauthorized");
      const tk = db.supportTickets.find((t) => t._id === m[1]);
      if (!tk) return fail(404, "Ticket not found");
      if (method === "GET") return ok(tk, "Ticket retrieved successfully");
      if (method === "PATCH") {
        if (body && body.message) {
          tk.replies = tk.replies || [];
          tk.replies.push({
            message: String(body.message),
            authorRole: "user",
            createdAt: ISO(nowMs()),
          });
          tk.status = "in_progress";
          tk.updatedAt = ISO(nowMs());
          saveDB(db);
        }
        return ok(tk, "Ticket updated successfully");
      }
    }

    return fail(404, `Route not found: ${method} ${path}`);
  }

  /* ---------------------------------------------------------
     fetch interception
     --------------------------------------------------------- */
  window.fetch = async function demoFetch(input, init) {
    let rawUrl = "";
    if (typeof input === "string") rawUrl = input;
    else if (input && input.url) rawUrl = input.url;

    let url;
    try {
      url = new URL(rawUrl, window.location.href);
    } catch {
      url = null;
    }

    if (!url || !url.pathname.startsWith("/api/")) {
      if (originalFetch) return originalFetch(input, init);
      throw new Error("fetch is not available");
    }

    const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();

    let body = null;
    if (init && init.body) {
      if (typeof init.body === "string") {
        try {
          body = JSON.parse(init.body);
        } catch {
          body = null;
        }
      }
    }

    const headers = new Headers((init && init.headers) || {});
    const auth = headers.get("authorization") || localStorage.getItem("token");
    const authHeaders = new Headers(headers);
    if (auth) authHeaders.set("authorization", auth.startsWith("Bearer ") ? auth : "Bearer " + auth);

    // small delay so loading states are visible (like a real network)
    await wait(80 + Math.floor(Math.random() * 120));

    try {
      return await handle(method, url.pathname, url.searchParams, body, authHeaders);
    } catch (err) {
      console.error("[demo] request failed", err);
      return fail(500, err && err.message ? err.message : "Demo server error");
    }
  };

  /* ---------------------------------------------------------
     demo UI: badge + reset + quick login
     --------------------------------------------------------- */
  function injectDemoUI() {
    const style = document.createElement("style");
    style.textContent = `
      #demoBadge{position:fixed;left:14px;bottom:14px;z-index:99999;display:flex;gap:10px;align-items:center;
        background:#0f172a;color:#fff;font:600 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;
        padding:9px 12px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25);opacity:.92}
      #demoBadge .dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.25)}
      #demoBadge button{margin-left:6px;background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:999px;
        padding:5px 10px;font:600 11px system-ui;cursor:pointer}
      #demoBadge button:hover{background:rgba(255,255,255,.26)}
      #demoLoginHint{margin:14px 0 0;padding:14px;border:1px dashed #c7d2fe;border-radius:14px;background:#eef2ff;
        font:13px/1.5 system-ui;color:#312e81}
      #demoLoginHint b{display:block;margin-bottom:8px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#4338ca}
      #demoLoginHint .row{display:flex;flex-wrap:wrap;gap:8px}
      #demoLoginHint button{border:1px solid #c7d2fe;background:#fff;color:#3730a3;border-radius:999px;
        padding:6px 12px;font:600 12px system-ui;cursor:pointer}
      #demoLoginHint button:hover{background:#e0e7ff}
      @media(max-width:520px){#demoBadge{left:8px;bottom:8px;font-size:11px}}
    `;
    document.head.appendChild(style);

    if (!document.getElementById("demoBadge")) {
      const badge = document.createElement("div");
      badge.id = "demoBadge";
      badge.innerHTML = `<span class="dot"></span><span>Demo mode · البيانات محفوظة في المتصفح</span>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Reset";
      btn.title = "Restore the original demo data";
      btn.addEventListener("click", () => {
        if (confirm("Reset all demo data (bookings, tickets, accounts) back to the start?")) resetDemo();
      });
      badge.appendChild(btn);
      document.body.appendChild(badge);
    }

    // quick-fill demo accounts on the login page
    const pw = document.querySelector('input[type="password"]');
    const em = document.querySelector('input[type="email"]');
    if (pw && em && !document.getElementById("demoLoginHint")) {
      const hint = document.createElement("div");
      hint.id = "demoLoginHint";
      hint.innerHTML = `<b>Demo accounts — one click</b><div class="row"></div>`;
      const row = hint.querySelector(".row");
      [
        ["Participant", "demo@eventops.test"],
        ["Organizer", "organizer@eventops.test"],
        ["Admin", "admin@eventops.test"],
      ].forEach(([label, email]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.addEventListener("click", () => {
          em.value = email;
          pw.value = DEMO_PASSWORD;
          em.dispatchEvent(new Event("input", { bubbles: true }));
          pw.dispatchEvent(new Event("input", { bubbles: true }));
          em.focus();
        });
        row.appendChild(b);
      });
      const card = pw.closest("form") || pw.parentElement;
      if (card && card.parentElement) card.parentElement.insertBefore(hint, card.nextSibling);
    }
  }

  function resetDemo() {
    resetDB();
  }

  window.__EVENTOPS_DEMO__ = { reset: resetDemo, key: DB_KEY };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      try {
        loadDB(); // make sure the seed exists before the first request
        injectDemoUI();
      } catch (e) {
        console.warn("[demo] init failed", e);
      }
    });
  } else {
    try {
      loadDB();
      injectDemoUI();
    } catch (e) {
      console.warn("[demo] init failed", e);
    }
  }
})();
