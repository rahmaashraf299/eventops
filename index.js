
import 'dotenv/config';
import express from 'express';
import dbConnection from './db/dbConnection.js';
import { userRoutes } from './src/modules/users/users.routes.js';

const app = express();
app.use(express.json());

app.use(userRoutes);

app.get('/', (req, res) => {
    res.send('EventOps Backend is running! ');
});

dbConnection()
    .then(() => {
        app.listen(3000, () => {
            console.log('Server is running on port 3000 ');
        });
    })
    .catch((err) => {
        console.error('Database Connection Failed:', err.message);
    });