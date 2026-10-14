import 'dotenv/config';
import express from 'express';
import dbConnection from './db/dbConnection.js';
import { userRoutes } from './src/modules/users/users.routes.js';
import { organizerApplicationRoutes } from './src/modules/organizerApplication/organizerApplication.routes.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use(userRoutes);
app.use(organizerApplicationRoutes);

app.get('/', (req, res) => {
    res.send('EventOps Backend is running! ');
});

dbConnection()
    .then(() => {
        const server = app.listen(port, () => {
            console.log(`Server is running on port ${port} `);
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