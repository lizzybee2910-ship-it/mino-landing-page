import { Router, type IRouter } from "express";
import { db, waitlistSignupsTable } from "@workspace/db";
import { CreateWaitlistSignupBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/waitlist", async (req, res): Promise<void> => {
  const parsed = CreateWaitlistSignupBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      { errors: parsed.error.issues },
      "Invalid waitlist signup body",
    );
    res.status(400).json({ error: "Please check the form and try again." });
    return;
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const name = parsed.data.name.trim();
  const notes = parsed.data.notes?.trim() ? parsed.data.notes.trim() : null;

  if (name.length === 0 || normalizedEmail.length === 0) {
    res.status(400).json({ error: "Please check the form and try again." });
    return;
  }

  try {
    await db
      .insert(waitlistSignupsTable)
      .values({
        name,
        email: normalizedEmail,
        role: parsed.data.role,
        notes,
      });

    res.status(200).json({ message: "Thanks for your interest." });
  } catch (err) {
    const extractCode = (e: unknown): string | undefined => {
      if (typeof e !== "object" || e === null) return undefined;
      const direct = (e as { code?: unknown }).code;
      if (typeof direct === "string") return direct;
      const cause = (e as { cause?: unknown }).cause;
      return extractCode(cause);
    };

    const code = extractCode(err);

    if (code === "23505") {
      req.log.info(
        { email: normalizedEmail },
        "Duplicate waitlist signup silently acknowledged",
      );
      res.status(200).json({ message: "Thanks for your interest." });
      return;
    }

    req.log.error({ err }, "Failed to create waitlist signup");
    throw err;
  }
});

export default router;
