import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import productionRouter from "./production";
import stockRouter from "./stock";
import recipesRouter from "./recipes";
import financialRouter from "./financial";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(customersRouter);
router.use(ordersRouter);
router.use(productionRouter);
router.use(stockRouter);
router.use(recipesRouter);
router.use(financialRouter);

export default router;
