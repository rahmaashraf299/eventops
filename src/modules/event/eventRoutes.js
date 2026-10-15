import express from "express";

import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  cancelEvent,
} from "./eventController.js";

import { validateCreateEvent } from "../../middlewares/validateCreateEvent.js";
import { validateUpdateEvent } from "../../middlewares/validateUpdateEvent.js";
const router = express.Router();

router.post("/", validateCreateEvent, createEvent);

router.get("/", getAllEvents);

router.get("/:id", getEventById);

router.patch("/:id", validateUpdateEvent, updateEvent);

router.post("/:id/cancel", cancelEvent);


export default router;
