import { PageHeader } from "@/components/layout/area-shell";
import { ReviewQueue, parseReviewFilters } from "@/components/dashboard/review-queue";
import { requireArea } from "@/lib/auth/dal";

export const metadata = { title: "Submissions" };

export default async function StudioSubmissions({ searchParams }: PageProps<"/studio/submissions">) {
  await requireArea("studio", "/studio/submissions");
  return (
    <div className="space-y-5">
      <PageHeader title="Student submissions" description="Approving a submission completes that step of the lesson. Students see your feedback." />
      <ReviewQueue basePath="/studio/submissions" filters={parseReviewFilters(await searchParams)} />
    </div>
  );
}
