export type ShopProductStatus = "active" | "draft";

export interface ShopProduct {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: "CAD";
  category?: string;
  images: string[];
  status: ShopProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ShopOrderStatus = "pending" | "processing" | "shipped" | "cancelled";

export interface ShopOrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface ShopOrder {
  id: string;
  customerId: string;
  items: ShopOrderItem[];
  totalAmount: number;
  currency: "CAD";
  status: ShopOrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopCustomer {
  id: string;
  displayName: string;
  email: string;
  isProMember: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
  lastOrderId?: string;
}

export interface IntegrationSettings {
  id: "printful" | "stripe";
  enabled: boolean;
  publicLabel?: string;
  updatedAt: Date;
}
