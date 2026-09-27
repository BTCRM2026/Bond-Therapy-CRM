import { PartnerOrderConfirmation } from "@/components/partner-order-confirmation";

export default async function PartnerOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PartnerOrderConfirmation token={token} />;
}
