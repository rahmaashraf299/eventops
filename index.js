
import "dotenv/config";
import express from "express";
import dbConnection from "./db/dbConnection.js";
import eventRoutes from "./src/modules/event/eventRoutes.js";
import { userRoutes } from "./src/modules/users/users.routes.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("EventOps Backend is Running!");
});

app.use("/api/events", eventRoutes);
app.use(userRoutes);

const startServer = async () => {
  try {
    await dbConnection();

    app.listen(port, () => {
      console.log(`Server is running on port ${port}...`);
    });
  } catch (err) {
    console.error(
      "Server could not start because the database connection failed.",
    );
    process.exit(1);
  }
};

startServer();
