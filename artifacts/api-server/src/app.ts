import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { rateLimit } from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/error-handler";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();

// Trust the first reverse-proxy hop so rate-limiting and IP-based logic
// operate on the real client IP rather than the proxy's IP. Without this,
// all requests originating through the Replit proxy appear to come from
// a single IP, making per-IP rate limits effectively global.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Only allow credentialed cross-origin requests from the same Replit domain.
// Mobile / server-to-server callers that omit the Origin header are unaffected.
const replitDevDomain = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : null;

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Same-origin requests (no Origin header) are always allowed.
      if (!origin) {
        callback(null, true);
        return;
      }
      // Allow requests from the same Replit workspace domain.
      if (replitDevDomain && origin === replitDevDomain) {
        callback(null, origin);
        return;
      }
      // Deny all other cross-origin credentialed requests.
      callback(null, false);
    },
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(authMiddleware);

const waitlistLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

app.use("/api/waitlist", waitlistLimiter);
app.use("/api", router);

app.use(errorHandler);

export default app;
