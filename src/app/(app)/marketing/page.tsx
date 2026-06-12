import { moduleConfigs } from "@/features/modules/module-config";
import { ModuleListPage } from "@/features/modules/module-pages";

export default function MarketingPage() {
  return (
    <ModuleListPage
      config={moduleConfigs.marketingCampaigns}
      description="Plan campaigns, link listings, track budget, leads, channels, and conversion performance."
      title="Marketing"
    />
  );
}
