import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleEditPage } from "@/features/modules/module-pages";

export default async function EditMarketingCampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  return <ModuleEditPage config={moduleConfigs.marketingCampaigns} id={campaignId} />;
}
