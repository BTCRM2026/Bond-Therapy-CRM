type ProductForCalculation = { id: string; unitPrice: unknown; gstRate: unknown };
type RequestedItem = { productId: string; quantity: number };

const paise = (value: unknown) => Math.round(Number(value || 0) * 100);
const money = (value: number) => Number((value / 100).toFixed(2));

export function calculateOrder(items: RequestedItem[], products: ProductForCalculation[], discountAmount: number, defaultGstRate: number, interstate: boolean) {
  const source = items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) throw new Error(`Missing product ${item.productId}`);
    const gross = paise(product.unitPrice) * item.quantity;
    return { ...item, product, gross };
  });
  const subtotalPaise = source.reduce((sum, item) => sum + item.gross, 0);
  const requestedDiscount = Math.min(paise(discountAmount), subtotalPaise);
  let allocatedDiscount = 0;
  const calculated = source.map((item, index) => {
    const discount = index === source.length - 1 ? requestedDiscount - allocatedDiscount : Math.round(requestedDiscount * (item.gross / Math.max(1, subtotalPaise)));
    allocatedDiscount += discount;
    const taxable = item.gross - discount;
    const gstRate = Number(item.product.gstRate ?? defaultGstRate);
    const tax = Math.round(taxable * gstRate / 100);
    return { productId: item.productId, quantity: item.quantity, unitPrice: money(paise(item.product.unitPrice)), discountAmount: money(discount), taxableAmount: money(taxable), gstRate, taxAmount: money(tax), lineTotal: money(taxable + tax) };
  });
  const taxablePaise = calculated.reduce((sum, item) => sum + paise(item.taxableAmount), 0);
  const taxPaise = calculated.reduce((sum, item) => sum + paise(item.taxAmount), 0);
  const cgstPaise = interstate ? 0 : Math.floor(taxPaise / 2);
  const sgstPaise = interstate ? 0 : taxPaise - cgstPaise;
  return { items: calculated, subtotal: money(subtotalPaise), discountAmount: money(requestedDiscount), taxableAmount: money(taxablePaise), taxAmount: money(taxPaise), cgstAmount: money(cgstPaise), sgstAmount: money(sgstPaise), igstAmount: interstate ? money(taxPaise) : 0, totalAmount: money(taxablePaise + taxPaise) };
}
