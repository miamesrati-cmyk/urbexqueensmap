import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";
import type {
  IntegrationSettings,
  ShopCustomer,
  ShopOrder,
  ShopOrderStatus,
  ShopProduct,
  ShopProductStatus,
} from "../types/shop";

const PRODUCTS = collection(db, "shopProducts");
const ORDERS = collection(db, "shopOrders");
const CUSTOMERS = collection(db, "shopCustomers");
const INTEGRATIONS = collection(db, "shopIntegrations");

function toDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  return new Date(value);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// PRODUCTS
export function listenProducts(cb: (products: ShopProduct[]) => void, onError?: (error: unknown) => void) {
  const q = query(PRODUCTS, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const items: ShopProduct[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        items.push({
          id: doc.id,
          name: data.name,
          slug: data.slug,
          description: data.description,
          price: data.price ?? 0,
          currency: "CAD",
          category: data.category,
          images: Array.isArray(data.images) ? data.images : [],
          status: (data.status as ShopProductStatus) ?? "draft",
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        });
      });
      cb(items);
    },
    onError
  );
}

export async function addProduct(input: {
  name: string;
  description?: string;
  price: number;
  category?: string;
  image?: string;
  status: ShopProductStatus;
}) {
  ensureWritesAllowed();
  const slug = slugify(input.name);
  await addDoc(PRODUCTS, {
    name: input.name,
    slug,
    description: input.description ?? "",
    price: input.price,
    currency: "CAD",
    category: input.category || "",
    images: input.image ? [input.image] : [],
    status: input.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProduct(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    price: number;
    category: string;
    image: string;
    status: ShopProductStatus;
  }>
) {
  ensureWritesAllowed();
  const updates: Record<string, any> = { updatedAt: serverTimestamp() };
  if (input.name !== undefined) {
    updates.name = input.name;
    updates.slug = slugify(input.name);
  }
  if (input.description !== undefined) updates.description = input.description;
  if (input.price !== undefined) updates.price = input.price;
  if (input.category !== undefined) updates.category = input.category;
  if (input.status !== undefined) updates.status = input.status;
  if (input.image !== undefined) {
    updates.images = input.image ? [input.image] : [];
  }
  await updateDoc(doc(PRODUCTS, id), updates);
}

// CUSTOMERS
export function listenCustomers(cb: (customers: ShopCustomer[]) => void, onError?: (error: unknown) => void) {
  const q = query(CUSTOMERS, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const items: ShopCustomer[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        items.push({
          id: doc.id,
          displayName: data.displayName ?? "Client",
          email: data.email ?? "",
          isProMember: !!data.isProMember,
          createdAt: toDate(data.createdAt),
          lastLoginAt: toDate(data.lastLoginAt),
          lastOrderId: data.lastOrderId ?? undefined,
        });
      });
      cb(items);
    },
    onError
  );
}

export async function addCustomer(input: {
  id?: string;
  displayName: string;
  email: string;
  isProMember: boolean;
  lastLoginAt?: Date;
}) {
  ensureWritesAllowed();
  const ref = input.id ? doc(CUSTOMERS, input.id) : doc(CUSTOMERS);
  await setDoc(
    ref,
    {
      displayName: input.displayName,
      email: input.email,
      isProMember: input.isProMember,
      createdAt: serverTimestamp(),
      lastLoginAt: input.lastLoginAt ?? serverTimestamp(),
    },
    { merge: true }
  );
}

export async function ensureShopCustomerFromAuth(user: { uid: string; displayName: string | null; email: string | null }, isProMember: boolean) {
  ensureWritesAllowed();
  const ref = doc(CUSTOMERS, user.uid);
  await setDoc(
    ref,
    {
      displayName: user.displayName ?? user.email ?? "Client",
      email: user.email ?? "",
      isProMember,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function touchCustomerLastLogin(uid: string, isProMember?: boolean) {
  ensureWritesAllowed();
  const ref = doc(CUSTOMERS, uid);
  const payload: Record<string, any> = { lastLoginAt: serverTimestamp() };
  if (typeof isProMember === "boolean") {
    payload.isProMember = isProMember;
  }
  await setDoc(ref, payload, { merge: true });
}

// ORDERS
export function listenOrders(cb: (orders: ShopOrder[]) => void, onError?: (error: unknown) => void) {
  const q = query(ORDERS, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const items: ShopOrder[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        items.push({
          id: doc.id,
          customerId: data.customerId,
          items: Array.isArray(data.items) ? data.items : [],
          totalAmount: data.totalAmount ?? 0,
          currency: "CAD",
          status: (data.status as ShopOrderStatus) ?? "pending",
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        });
      });
      cb(items);
    },
    onError
  );
}

export async function createTestOrder() {
  ensureWritesAllowed();
  const productsSnap = await getDocs(PRODUCTS);
  const customersSnap = await getDocs(CUSTOMERS);
  const productDocs = productsSnap.docs;
  const customerDocs = customersSnap.docs;
  const product = productDocs[0];
  const customer = customerDocs[0];
  if (!product || !customer) return;
  const data = product.data() as any;
  const itemPrice = data.price ?? 0;
  await addDoc(ORDERS, {
    customerId: customer.id,
    items: [
      {
        productId: product.id,
        quantity: 1,
        unitPrice: itemPrice,
      },
    ],
    totalAmount: itemPrice,
    currency: "CAD",
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateOrderStatus(orderId: string, status: ShopOrderStatus) {
  ensureWritesAllowed();
  await updateDoc(doc(ORDERS, orderId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

// INTEGRATIONS
export function listenIntegrations(
  cb: (integrations: IntegrationSettings[]) => void,
  onError?: (error: unknown) => void
) {
  return onSnapshot(
    INTEGRATIONS,
    (snap) => {
      const items: IntegrationSettings[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        items.push({
          id: doc.id as IntegrationSettings["id"],
          enabled: !!data.enabled,
          publicLabel: data.publicLabel ?? "",
          updatedAt: toDate(data.updatedAt),
        });
      });
      cb(items);
    },
    onError
  );
}

export async function setIntegrationEnabled(id: IntegrationSettings["id"], enabled: boolean) {
  ensureWritesAllowed();
  await setDoc(
    doc(INTEGRATIONS, id),
    {
      enabled,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
