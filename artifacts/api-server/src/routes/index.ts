import { Router, type IRouter } from "express";
import healthRouter from "./health";
import waitlistRouter from "./waitlist";
import authRouter from "./auth";
import learnRouter from "./learn";

const router: IRouter = Router();

router.use(healthRouter);
router.use(waitlistRouter);
router.use(authRouter);
router.use(learnRouter);

export default router;
