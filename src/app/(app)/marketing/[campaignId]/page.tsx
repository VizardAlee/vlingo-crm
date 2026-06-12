import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleDetailPage } from "@/features/modules/module-pages";

export default async function MarketingCampaignDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  return <ModuleDetailPage config={moduleConfigs.marketingCampaigns} id={campaignId} />;
}
