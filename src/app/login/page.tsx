import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="py-6">
      <Suspense fallback={<p className="text-center text-sm text-[var(--muted)]">جارٍ التحميل...</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
