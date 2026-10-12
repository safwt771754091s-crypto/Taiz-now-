import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { roleHasPermission } from "@/lib/rbac";
import MapView from "@/components/MapView";
import MarkerForm from "@/components/MarkerForm";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  verified: "موثق",
  rumor: "شائعة",
  correction: "تصحيح",
  incident: "حادثة",
  general: "عام",
};

export default async function MapsPage() {
  const session = await auth();
  const canVerifyGeo = roleHasPermission(session?.user?.role, "geo:verify");
  const markers = await prisma.mapMarker.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="space-y-6">
      <header className="card p-6">
        <h1 className="text-2xl font-black">الخرائط والتحقق الجغرافي</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          مواقع الأحداث والادعاءات على الخريطة، مع تصنيف كل موقع ودرجة ثقته. يساعد التحقق الجغرافي
          على مطابقة الصور والفيديو مع المكان والزمان المزعومين.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <span key={key} className="chip">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: { verified: "#34d399", rumor: "#fb923c", correction: "#38bdf8", incident: "#f87171", general: "#94a3b8" }[key] }}
              />
              {label}
            </span>
          ))}
        </div>
      </header>

      <MapView
        markers={markers.map((m) => ({
          id: m.id,
          label: m.label,
          lat: m.lat,
          lng: m.lng,
          category: m.category,
          description: m.description,
          confidence: m.confidence,
        }))}
      />

      {markers.length === 0 && (
        <p className="text-center text-sm text-[var(--muted)]">
          لا توجد مواقع مضافة بعد. يضيف محللو الجغرافيا المواقع بعد التحقق.
        </p>
      )}

      {canVerifyGeo && <MarkerForm />}
    </div>
  );
}
