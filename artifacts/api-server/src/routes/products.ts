import { Router, type IRouter } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import fs from "fs";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";
import {
  CreateProductBody,
  UpdateProductBody,
  ListProductsQueryParams,
  GetProductParams,
  UpdateProductParams,
  DeleteProductParams,
} from "@workspace/api-zod";

const uploadsDir = path.join(
  process.env.VERCEL ? os.tmpdir() : process.cwd(),
  "uploads",
);
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `product-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

const router: IRouter = Router();

function formatProduct(p: Record<string, unknown>, catName?: string | null) {
  const price = Number(p.price);
  const cost = p.cost ? Number(p.cost) : null;
  const cmvPercent = cost && price > 0 ? (cost / price) * 100 : null;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    categoryId: p.categoryId ?? null,
    categoryName: catName ?? null,
    price,
    cost,
    imageUrl: p.imageUrl ?? null,
    available: p.available,
    unit: p.unit ?? null,
    minStock: p.minStock ?? null,
    cmvPercent,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
}

router.get("/products", async (req, res): Promise<void> => {
  const qp = ListProductsQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const rows = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      description: productsTable.description,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      price: productsTable.price,
      cost: productsTable.cost,
      imageUrl: productsTable.imageUrl,
      available: productsTable.available,
      unit: productsTable.unit,
      minStock: productsTable.minStock,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(
      and(
        qp.data.categoryId ? eq(productsTable.categoryId, qp.data.categoryId) : undefined,
        qp.data.available !== undefined ? eq(productsTable.available, qp.data.available) : undefined,
        qp.data.search ? ilike(productsTable.name, `%${qp.data.search}%`) : undefined,
      )
    )
    .orderBy(productsTable.name);

  res.json(rows.map((r) => formatProduct(r as Record<string, unknown>, r.categoryName)));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [p] = await db.insert(productsTable).values({
    ...parsed.data,
    price: String(parsed.data.price),
    cost: parsed.data.cost !== undefined ? String(parsed.data.cost) : undefined,
  }).returning();
  res.status(201).json(formatProduct(p as Record<string, unknown>));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const rows = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      description: productsTable.description,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      price: productsTable.price,
      cost: productsTable.cost,
      imageUrl: productsTable.imageUrl,
      available: productsTable.available,
      unit: productsTable.unit,
      minStock: productsTable.minStock,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, params.data.id));

  if (!rows[0]) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(formatProduct(rows[0] as Record<string, unknown>, rows[0].categoryName));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.price !== undefined) updateData.price = String(parsed.data.price);
  if (parsed.data.cost !== undefined) updateData.cost = String(parsed.data.cost);

  const [p] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, params.data.id)).returning();
  if (!p) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(formatProduct(p as Record<string, unknown>));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [p] = await db.delete(productsTable).where(eq(productsTable.id, params.data.id)).returning();
  if (!p) { res.status(404).json({ error: "Product not found" }); return; }
  res.sendStatus(204);
});

router.post("/products/:id/image", upload.single("image"), async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  if (!req.file) { res.status(400).json({ error: "No image file provided" }); return; }
  const imageUrl = `/api/uploads/${req.file.filename}`;
  const [p] = await db.update(productsTable).set({ imageUrl }).where(eq(productsTable.id, id)).returning();
  if (!p) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(formatProduct(p as Record<string, unknown>));
});

export default router;
