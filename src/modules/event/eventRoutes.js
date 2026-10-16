import express from "express";

import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  cancelEvent,
} from "./eventController.js";


import {
  validateCreateEvent,
  validateUpdateEvent,
  validateEventQuery,
} from "../../middleware/eventMiddleware.js";



import {
  verifyToken,
  verifyTokenIfPresent,
  verifyOrganizer,
} from "../../middleware/auth.middleware.js";
const router = express.Router();

router.post(
  "/",
  verifyToken,
  verifyOrganizer,
  validateCreateEvent,
  createEvent,
);
router.get("/", validateEventQuery, getAllEvents);

router.get("/:id", verifyTokenIfPresent, getEventById);

router.patch(
  "/:id",
  verifyToken,
  verifyOrganizer,
  validateUpdateEvent,
  updateEvent,
);
router.post("/:id/cancel", verifyToken, verifyOrganizer, cancelEvent);

export default router;
