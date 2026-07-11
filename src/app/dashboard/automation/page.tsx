import AutomationQueue from "@/components/AutomationQueue";
import AutomationStatus from "@/components/AutomationStatus";
import GlassPanel from "@/components/premium/GlassPanel";
import PageHeader from "@/components/premium/PageHeader";

export default function AutomationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="Autopilot"
        title="Automation queue"
        subtitle="Queued posts publish on a conservative cadence. Engagement history tracks likes, follows, and delayed DMs so the system avoids duplicates."
      />
      <GlassPanel delay={0}>
        <AutomationQueue />
      </GlassPanel>
      <AutomationStatus />
    </div>
  );
}
