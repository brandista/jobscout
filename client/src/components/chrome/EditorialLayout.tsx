import { useState, type ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { PaperGrain } from "@/components/editorial";
import { EditorialSidebar } from "./EditorialSidebar";
import { EditorialTopbar } from "./EditorialTopbar";
import { MobileTopbar } from "./MobileTopbar";
import { MobileBottomBar } from "./MobileBottomBar";
import { CommandPalette } from "./CommandPalette";

export function EditorialLayout({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { user } = useAuth();

  const unread =
    trpc.matches.list.useQuery(
      { limit: 10 },
      { enabled: !!user },
    ).data?.filter((m: { seen?: boolean }) => !m.seen).length ?? 0;

  const live = unread > 0;

  return (
    <div className="min-h-screen bg-[#FAF7F0] relative flex">
      <PaperGrain />
      <EditorialSidebar />
      <div className="flex-1 min-w-0 flex flex-col relative">
        <MobileTopbar unreadBulletins={unread} />
        <EditorialTopbar
          live={live}
          unreadBulletins={unread}
          onOpenCommand={() => setPaletteOpen(true)}
        />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <MobileBottomBar />
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
