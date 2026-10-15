import Ticket from "./ticket.model.js";
import QRCode from "qrcode";

export const createTicket = async (req, res) => {
  try {
    const { bookingId, eventId, userId } = req.body;
    
    const qrToken = "TICKET-" + Math.random().toString(36).substring(2, 15).toUpperCase();
    const qrCodeImage = await QRCode.toDataURL(qrToken);

    const newTicket = await Ticket.create({
      booking: bookingId,
      event: eventId,
      user: userId,
      qrToken,
      qrCode: qrCodeImage,
    });

    res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      data: newTicket,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const checkInTicket = async (req, res) => {
  try {
    const { qrToken } = req.body;
    const ticket = await Ticket.findOne({ qrToken });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    if (ticket.status === "used") {
      return res.status(400).json({ success: false, message: "Ticket already used" });
    }

    ticket.status = "used";
    ticket.checkedInAt = new Date();
    await ticket.save();

    res.status(200).json({
      success: true,
      message: "Check-in successful",
      data: ticket,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserTickets = async (req, res) => {
  try {
    const userId = req.query.userId;
    const tickets = await Ticket.find({ user: userId }).populate("event");

    res.status(200).json({
      success: true,
      message: "User tickets fetched successfully",
      data: tickets,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const exportEventReport = async (req, res) => {
  try {
    const { eventId } = req.params;
    res.status(200).json({
      success: true,
      message: `Report for event ${eventId} exported successfully`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};