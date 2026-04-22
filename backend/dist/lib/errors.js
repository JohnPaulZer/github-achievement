"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.isAppError = isAppError;
class AppError extends Error {
    constructor(statusCode, code, message, details) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}
exports.AppError = AppError;
function isAppError(error) {
    return error instanceof AppError;
}
//# sourceMappingURL=errors.js.map