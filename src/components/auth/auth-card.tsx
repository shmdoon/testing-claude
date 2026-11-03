import { Card } from "@/components/ui/card";

export function AuthCard({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <Card className="gap-6 p-6 sm:p-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </Card>
      {footer && <p className="mt-6 text-center text-muted-foreground">{footer}</p>}
    </div>
  );
}
