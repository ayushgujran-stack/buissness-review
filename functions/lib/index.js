"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDemoData = exports.razorpayWebhook = exports.verifyRazorpayPayment = exports.createRazorpayOrder = exports.submitCustomerReview = exports.resolvePublicQrToken = exports.createBranch = void 0;
const functions = __importStar(require("firebase-functions"));
const branch_1 = require("./branch");
Object.defineProperty(exports, "createBranch", { enumerable: true, get: function () { return branch_1.createBranch; } });
const reviews_1 = require("./reviews");
Object.defineProperty(exports, "resolvePublicQrToken", { enumerable: true, get: function () { return reviews_1.resolvePublicQrToken; } });
Object.defineProperty(exports, "submitCustomerReview", { enumerable: true, get: function () { return reviews_1.submitCustomerReview; } });
const payments_1 = require("./payments");
Object.defineProperty(exports, "createRazorpayOrder", { enumerable: true, get: function () { return payments_1.createRazorpayOrder; } });
Object.defineProperty(exports, "verifyRazorpayPayment", { enumerable: true, get: function () { return payments_1.verifyRazorpayPayment; } });
Object.defineProperty(exports, "razorpayWebhook", { enumerable: true, get: function () { return payments_1.razorpayWebhook; } });
const seed_1 = require("./seed");
/**
 * Callable function for Super Admin / Dev mode to seed the Raj demo environment
 */
exports.seedDemoData = functions.https.onCall(async (data, context) => {
    // Allow if running in emulator or user is Super Admin
    const isSuperAdmin = context.auth?.token?.role === 'SUPER_ADMIN' || !context.auth;
    if (!isSuperAdmin && process.env.NODE_ENV === 'production') {
        throw new functions.https.HttpsError('permission-denied', 'Only Super Admin can trigger demo data seeding.');
    }
    const result = await (0, seed_1.runDemoSeed)();
    return result;
});
//# sourceMappingURL=index.js.map