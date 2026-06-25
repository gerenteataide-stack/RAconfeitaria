import { Router, type IRouter, type RequestHandler } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import productionRouter from "./production";
import stockRouter from "./stock";
import recipesRouter from "./recipes";
import financialRouter from "./financial";
import operationsRouter from "./operations";
import { requireAuth, requirePermission } from "../lib/auth";

const router: IRouter = Router();

function protectPrefix(prefix: string, permission: string): RequestHandler {
  return (req, res, next) => {
    if (!req.path.startsWith(prefix)) {
      next();
      return;
    }
    requireAuth(req, res, () => requirePermission(permission)(req, res, next));
  };
}

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(customersRouter);
router.use(ordersRouter);
router.use(protectPrefix("/production", "production"));
router.use(productionRouter);
router.use(protectPrefix("/stock", "stock"));
router.use(stockRouter);
router.use(protectPrefix("/recipes", "recipes"));
router.use(recipesRouter);
router.use(protectPrefix("/financial", "financial"));
router.use(financialRouter);
router.use(operationsRouter);

export default router;
