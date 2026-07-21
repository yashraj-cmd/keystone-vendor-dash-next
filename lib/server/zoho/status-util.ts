import { InvoiceStatus } from "@shared";

/** Map a Zoho bill/invoice status to the dashboard's InvoiceStatus. null → skip (void/cancelled). */
export function mapZohoStatus(zohoStatus: string): InvoiceStatus | null {
  switch (zohoStatus.trim().toLowerCase()) {
    case "paid":
      return InvoiceStatus.PAID;
    case "overdue":
      return InvoiceStatus.OVERDUE;
    case "open":
    case "sent":
    case "partially_paid":
    case "draft":
    case "unpaid":
      return InvoiceStatus.UNPAID;
    case "void":
    case "voided":
    case "cancelled":
      return null;
    default:
      return InvoiceStatus.UNPAID;
  }
}
