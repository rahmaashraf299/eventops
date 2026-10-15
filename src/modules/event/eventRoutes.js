import express from "express";

import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  cancelEvent,
} from "./eventController.js";

import { validateCreateEvent } from "../../middleware/validateCreateEvent.js";
import { validateUpdateEvent } from "../../middleware/validateUpdateEvent.js";

import { verifyToken, verifyOrganizer } from "../../middleware/auth.middleware.js";
import { validateEventQuery } from "./validateEventQuery.js";
const router = express.Router();

router.post(
  "/",
  verifyToken,
  verifyOrganizer,
  validateCreateEvent,
  createEvent,
);
router.get("/", validateEventQuery, getAllEvents);

router.get("/:id", getEventById);

router.patch(
  "/:id",
  verifyToken,
  verifyOrganizer,
  validateUpdateEvent,
  updateEvent,
);
router.post("/:id/cancel", verifyToken, verifyOrganizer, cancelEvent);

export default router;
