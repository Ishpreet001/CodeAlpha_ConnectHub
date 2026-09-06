import { Router, type IRouter } from "express";
import healthRouter from "./health";
import connecthubRouter from "./connecthub";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(connecthubRouter);
router.use(storageRouter);

export default router;
