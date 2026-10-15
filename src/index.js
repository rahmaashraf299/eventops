import express from "express";
import connectDB from "./config/db.connection.js";
import ticketRoutes from "./modules/tickets/ticket.routes.js";

const app = express();

app.use(express.json());

// استدعاء ملف الاتصال بقاعدة البيانات مرة واحدة فقط
connectDB();

// ربط مسارات التذاكر
app.use("/api/tickets", ticketRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});