import express from "express";
import {
  createTicket,
  checkInTicket,
  getUserTickets,
  exportEventReport,
} from "./ticket.controller.js";

const router = express.Router();

router.post("/", createTicket);
router.post("/check-in", checkInTicket);
router.get("/my-tickets", getUserTickets);
router.get("/:eventId/reports/export", exportEventReport);

export default router;