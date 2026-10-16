import express from "express";
import connectDB from "./config/db.connection.js";
import {
  eventTicketRoutes,
  bookingTicketRoutes,
} from "./modules/tickets/ticket.routes.js";

const app = express();

app.use(express.json());

// استدعاء ملف الاتصال بقاعدة البيانات مرة واحدة فقط
connectDB();

// ربط مسارات التذاكر والحضور والتقارير
app.use("/api/events", eventTicketRoutes);
app.use("/api/bookings", bookingTicketRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
