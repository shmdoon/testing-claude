import { PageHeader } from "@/components/layout/area-shell";
import { Gallery } from "@/components/dashboard/gallery";
import { requireArea } from "@/lib/auth/dal";

export const metadata = { title: "Gallery" };

export default async function LearnGalleryPage() {
  await requireArea("learn", "/learn/gallery");
  return (
    <div className="space-y-6">
      <PageHeader title="Project gallery" description="Projects other students chose to share, with their parent's permission. First names only." />
      <Gallery />
    </div>
  );
}
