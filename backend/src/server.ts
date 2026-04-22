import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res
    .status(200)
    .json({
      ok: true,
      service: "backend",
      timestamp: new Date().toISOString(),
    });
});

async function startServer() {
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      console.log("MongoDB connected");
    } catch (error) {
      console.warn(
        "MongoDB connection failed, continuing without DB connection.",
      );
      console.warn(error);
    }
  } else {
    console.warn(
      "MONGODB_URI is not set. Running without a database connection.",
    );
  }

  app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
