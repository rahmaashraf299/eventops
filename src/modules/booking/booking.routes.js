import express from "express";

import {
  getSeats,
  createBooking,
  getMyBookings,
  cancelBooking,
} from "./booking.controller.js";

import {
  validateEventId,
  validateCreateBooking,
  validateCancelBooking,
} from "../../middleware/booking.middleware.js";

import {
  verifyToken,
  verifyOrganizer,
} from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/events/:id/seats", validateEventId, getSeats);

router.post(
  "/events/:id/bookings",
  verifyToken,
  validateEventId,
  validateCreateBooking,
  createBooking,
);

router.get("/bookings/me", verifyToken, getMyBookings);

router.patch(
  "/organizer/bookings/:id/cancel",
  verifyToken,
  verifyOrganizer,
  validateCancelBooking,
  cancelBooking,
);

export default router;
