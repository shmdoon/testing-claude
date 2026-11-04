import { PageHeader } from "@/components/layout/area-shell";
import { Gallery } from "@/components/dashboard/gallery";
import { requireArea } from "@/lib/auth/dal";

export const metadata = { title: "Gallery" };

export default async function ParentGalleryPage() {
  await requireArea("parent", "/parent/gallery");
  return (
    <div className="space-y-6">
      <PageHeader title="Project gallery" description="Approved projects shared by students with their parent's permission. First names only." />
      <Gallery />
    </div>
  );
}
