# EventOps Backend

Backend لمشروع **EventOps** باستخدام Node.js + Express + MongoDB (Mongoose).

## التشغيل

```bash
npm install
npm run dev     # nodemon
# أو
npm start       # node index.js
```

> محتاج ملف `.env` فيه `MONGO_URI` و (اختياري) `JWT_SECRET` وبيانات الإيميل.

## Flow المشروع الأساسي

```
Signup → Login → Create Event → View Seats → Book Seat → Mock Payment
→ Confirm Booking → Generate Ticket/QR → Check-in
```

---

## الشخص 6 — Tickets, Check-in & Reports

مسؤول عن: `Ticket` Model، إنشاء التذكرة بعد تأكيد الحجز والدفع، توليد `QR Code`،
التحقق من الـ QR وتسجيل الحضور مرة واحدة، قائمة المشاركين، التقارير وتصدير Excel،
وإرسال إيميل التأكيد.

### الملفات

| ملف | الوصف |
|---|---|
| `src/modules/tickets/ticket.model.js` | Ticket Schema |
| `src/modules/tickets/ticket.controller.js` | الـ Logic |
| `src/modules/tickets/ticket.routes.js` | المسارات |
| `src/modules/tickets/ticket.validation.js` | التحقق من المدخلات (Joi) |
| `src/service/email.service.js` | إرسال إيميل التذكرة (Nodemailer) |

### Ticket Schema

| Field | Type | Rules |
|---|---|---|
| `booking` | ObjectId | ref `Booking`, required, unique |
| `event` | ObjectId | ref `Event`, required |
| `user` | ObjectId | ref `User`, required |
| `qrToken` | String | required, unique, مولّد بشكل آمن (`crypto`) |
| `status` | String | enum: `valid`, `used`, `revoked` |
| `checkedInAt` | Date | optional |

### الـ Endpoints

| Method | Route | الصلاحية | الوصف |
|---|---|---|---|
| `GET` | `/api/bookings/:id/ticket` | صاحب الحجز / Admin | يجيب التذكرة + صورة الـ QR (يتولّد بعد تأكيد الحجز) |
| `GET` | `/api/events/:id/participants` | Organizer (صاحب الفعالية) | قائمة المشاركين المؤكدين |
| `POST` | `/api/events/:id/check-in` | Organizer (صاحب الفعالية) | التحقق من `qrToken` وتسجيل الحضور مرة واحدة |
| `GET` | `/api/events/:id/reports` | Organizer (صاحب الفعالية) | ملخّص التقرير (حجوزات/حضور/إيراد) |
| `GET` | `/api/events/:id/reports/export` | Organizer (صاحب الفعالية) | تصدير التقرير كملف Excel (ExcelJS) |

### أمثلة

**Check-in**

```http
POST /api/events/6512.../check-in
Authorization: Bearer <token>
Content-Type: application/json

{ "qrToken": "3f9c...d41" }
```

**استجابة نجاح**

```json
{ "success": true, "message": "Check-in successful", "data": { "status": "used", "checkedInAt": "2026-10-16T12:00:00.000Z" } }
```

**قواعد مطبّقة**

- التذكرة بتتولّد بس لو الحجز حالته `confirmed`.
- الـ `qrToken` مولّد بـ `crypto.randomBytes` (مش `Math.random`).
- تسجيل الحضور ذرّي (Atomic) فمستحيل يتسجل مرتين حتى مع طلبات متزامنة.
- الـ Check-in بيتأكد إن التذكرة تخص نفس الفعالية وإن الحجز مؤكد.
- الإيميل بيتبعت لحد مرة واحدة عند أول إنشاء للتذكرة.
