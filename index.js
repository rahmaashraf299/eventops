import 'dotenv/config';
import express from 'express';
import dbConnection from './db/dbConnection.js';
import eventRoutes from './src/modules/event/eventRoutes.js';
import { userRoutes } from './src/modules/users/users.routes.js';
import paymentRoutes from './src/modules/payments/paymentRoutes.js';
import bookingRoutes from './src/modules/booking/booking.routes.js';

import { userRoutes } from './src/modules/users/users.routes.js';
import { organizerApplicationRoutes } from './src/modules/organizerApplication/organizerApplication.routes.js';
import adminRoutes from './src/modules/admin/admin.routes.js';
import eventRoutes from './src/modules/event/eventRoutes.js';
import bookingRoutes from './src/modules/booking/booking.routes.js';
import { errorHandler } from './src/middleware/auth.middleware.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("EventOps Backend is Running! 🚀");
});

// Routes
app.use('/api/events', eventRoutes);
app.use(userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/bookings', bookingRoutes);

const startServer = async () => {
  try {
    await dbConnection();
    app.listen(port, () => {
      console.log(`Server is running on port ${port}...`);
    });
  } catch (err) {
    console.error("Server could not start because the database connection failed.");
    process.exit(1);
  }
};

startServer();
// Routes
app.use(userRoutes);
app.use(organizerApplicationRoutes);
app.use(adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api', bookingRoutes);

// Home route
app.get('/', (req, res) => {
    res.send('EventOps Backend is running!');
});

// Handle routes that do not exist
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// Handle other errors
app.use(errorHandler);

// Database Connection and Server
dbConnection()
    .then(() => {
        const server = app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use by another process.`);
            } else {
                console.error('Server error:', err.message);
            }
        });
    })
    .catch((err) => {
        console.error('Database Connection Failed:', err.message);
    });
