import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: "draft" | "published" | "archived" }) {
  return <Badge variant={status === "published" ? "success" : status === "draft" ? "warning" : "outline"}>{status}</Badge>;
}
