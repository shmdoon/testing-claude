import { PageHeader } from "@/components/layout/area-shell";
import { Card } from "@/components/ui/card";
import { CourseForm } from "@/components/studio/course-form";

export const metadata = { title: "New course" };

export default function NewCoursePage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="New course" description="You can add modules and lessons after creating it." />
      <Card>
        <CourseForm />
      </Card>
    </div>
  );
}
