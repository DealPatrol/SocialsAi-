import AutomationQueue from "@/components/AutomationQueue";
import GlassPanel from "@/components/premium/GlassPanel";
import PageHeader from "@/components/premium/PageHeader";

export default function AutomationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        badge="Review pipeline"
        title="Approval queue"
        subtitle="Every AI draft passes through here before it goes live. Approve only what sounds like you."
      />
      <GlassPanel delay={0}>
        <AutomationQueue />
      </GlassPanel>
    </div>
  );
}
