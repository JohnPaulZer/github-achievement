"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'backend', timestamp: new Date().toISOString() });
});
async function startServer() {
    if (mongoUri) {
        try {
            await mongoose_1.default.connect(mongoUri);
            console.log('MongoDB connected');
        }
        catch (error) {
            console.warn('MongoDB connection failed, continuing without DB connection.');
            console.warn(error);
        }
    }
    else {
        console.warn('MONGODB_URI is not set. Running without a database connection.');
    }
    app.listen(port, () => {
        console.log(`Backend server running on http://localhost:${port}`);
    });
}
startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
//# sourceMappingURL=server.js.map