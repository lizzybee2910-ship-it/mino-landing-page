import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  req.log.error({ err }, "Unhandled error in request");

  if (res.headersSent) {
    return;
  }

  res.status(500).json({ error: "Something went wrong. Please try again." });
};
