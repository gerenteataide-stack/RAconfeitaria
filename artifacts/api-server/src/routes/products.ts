import { Router, type IRouter } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

const router: IRouter = Router();

function hasCloudinaryConfig() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

async function uploadToCloudinary(file: Express.Multer.File, productId: number) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "ra-confeitaria/produtos";
  const publicId = `produto-${productId}-${timestamp}`;
  const signaturePayload = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signaturePayload).digest("hex");

  const arrayBuffer = new ArrayBuffer(file.buffer.byteLength);
  new Uint8Array(arrayBuffer).set(file.buffer);
  const form = new FormData();
  form.append("file", new Blob([arrayBuffer], { type: file.mimetype }), file.originalname);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Cloudinary upload failed: ${detail}`);
  }
  const data = await response.json() as { secure_url?: string };
  if (!data.secure_url) throw new Error("Cloudinary did not return secure_url");
  return data.secure_url;
}

function saveLocalUpload(file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
  const filename = `product-${Date.now()}${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
  return `/api/uploads/${filename}`;
}

function saveInlineImage(file: Express.Multer.File) {
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("A foto precisa ter no maximo 2 MB enquanto o Cloudinary nao estiver configurado");
  }
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

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
  const [current] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!current) { res.status(404).json({ error: "Product not found" }); return; }

  let imageUrl: string;
  try {
    if (hasCloudinaryConfig()) {
      imageUrl = await uploadToCloudinary(req.file, id);
    } else {
      imageUrl = process.env.VERCEL ? saveInlineImage(req.file) : saveLocalUpload(req.file);
    }
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Image upload failed" });
    return;
  }

  const [p] = await db.update(productsTable).set({ imageUrl }).where(eq(productsTable.id, id)).returning();
  res.json(formatProduct(p as Record<string, unknown>));
});

export default router;
