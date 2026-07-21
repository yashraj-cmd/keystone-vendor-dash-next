export const VendorStage = {
  IN_TALKS: "IN_TALKS",
  CATALOGUE_RECEIVED: "CATALOGUE_RECEIVED",
  PURCHASE_MADE: "PURCHASE_MADE",
} as const;
export type VendorStage = (typeof VendorStage)[keyof typeof VendorStage];

export const VENDOR_STAGE_ORDER: VendorStage[] = [
  VendorStage.IN_TALKS,
  VendorStage.CATALOGUE_RECEIVED,
  VendorStage.PURCHASE_MADE,
];

/** Plain-language stage names shown in the UI (avoids raw enum jargon). */
export const VENDOR_STAGE_LABELS: Record<VendorStage, string> = {
  IN_TALKS: "In Discussion",
  CATALOGUE_RECEIVED: "Catalogue Received",
  PURCHASE_MADE: "Purchased",
};

/** One-line explanation of what each stage means, for tooltips/hints. */
export const VENDOR_STAGE_HINTS: Record<VendorStage, string> = {
  IN_TALKS: "Talking to the vendor — no catalogue yet.",
  CATALOGUE_RECEIVED: "Catalogue received — ready to raise a purchase order.",
  PURCHASE_MADE: "A purchase has been made from this vendor.",
};

export const VendorStatus = {
  ACTIVE: "ACTIVE",
  ON_HOLD: "ON_HOLD",
  BLACKLISTED: "BLACKLISTED",
} as const;
export type VendorStatus = (typeof VendorStatus)[keyof typeof VendorStatus];

export const VendorCategory = {
  RAW_MATERIALS: "RAW_MATERIALS",
  LOGISTICS: "LOGISTICS",
  IT_SERVICES: "IT_SERVICES",
  PACKAGING: "PACKAGING",
  CONSULTING: "CONSULTING",
  OFFICE_SUPPLIES: "OFFICE_SUPPLIES",
  MARKETING: "MARKETING",
} as const;
export type VendorCategory = (typeof VendorCategory)[keyof typeof VendorCategory];

export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  RAW_MATERIALS: "Raw Materials",
  LOGISTICS: "Logistics",
  IT_SERVICES: "IT Services",
  PACKAGING: "Packaging",
  CONSULTING: "Consulting",
  OFFICE_SUPPLIES: "Office Supplies",
  MARKETING: "Marketing",
};

export const InvoiceStatus = {
  PAID: "PAID",
  UNPAID: "UNPAID",
  OVERDUE: "OVERDUE",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const DocumentSource = {
  MANUAL_UPLOAD: "MANUAL_UPLOAD",
  DRIVE_SYNC: "DRIVE_SYNC",
  ZOHO_SYNC: "ZOHO_SYNC",
} as const;
export type DocumentSource = (typeof DocumentSource)[keyof typeof DocumentSource];

export const PurchaseOrderStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type PurchaseOrderStatus = (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

/** Which Zoho Books module invoices are read from. Bills = money vendors charge Keystone (default). */
export const ZohoInvoiceSource = {
  BILLS: "bills",
  INVOICES: "invoices",
} as const;
export type ZohoInvoiceSource = (typeof ZohoInvoiceSource)[keyof typeof ZohoInvoiceSource];

export const UserRole = {
  ADMIN: "ADMIN",
  PROCUREMENT_MEMBER: "PROCUREMENT_MEMBER",
  VIEWER: "VIEWER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
