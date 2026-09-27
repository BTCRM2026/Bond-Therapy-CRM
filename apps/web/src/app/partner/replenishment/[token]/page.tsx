import { PartnerReplenishmentConfirmation } from "@/components/partner-replenishment-confirmation";
export default async function PartnerReplenishmentPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <PartnerReplenishmentConfirmation token={token} />; }
