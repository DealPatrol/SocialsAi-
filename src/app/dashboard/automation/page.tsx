import AutomationQueue from "@/components/AutomationQueue";

export default function AutomationPage() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold text-white mb-2">Approval queue</h2>
        <p className="text-sm text-gray-400 mb-4">
          Review AI-drafted replies and follow suggestions before they go live. Approve
          only what sounds like you.
        </p>
        <AutomationQueue />
      </section>
    </div>
  );
}
