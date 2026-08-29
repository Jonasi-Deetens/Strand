import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { type Status } from "@/domain/types";
import { saveBinaryFile, saveTextFile } from "@/lib/files";
import { useLanguage, useT } from "@/i18n/useT";
import { useProjectStore } from "@/store/useProjectStore";
import { pngFileName, stagePng } from "./png";
import { exportProjectFile } from "./projectFile";

export function ExportMenu() {
  const t = useT();
  const lang = useLanguage();
  const doc = useProjectStore((state) => state.doc);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!doc) return null;

  const run = async (task: () => Promise<string | null>) => {
    setOpen(false);
    try {
      const name = await task();
      if (name) setMessage(t("exporting.done", { name }));
    } catch (error) {
      setMessage(t("exporting.failed", { error: String(error) }));
    }
  };

  // The DXF and PDF writers are heavy libraries, so they load on first use
  // rather than with the editor.
  const items = [
    {
      icon: "file",
      label: t("exporting.dxf"),
      run: async () => {
        const { buildDxf, dxfFileName } = await import("./dxf");
        return saveTextFile(
          buildDxf(doc, { lang }),
          dxfFileName(doc),
          ["dxf"],
          "image/vnd.dxf",
        );
      },
    },
    {
      icon: "download",
      label: t("exporting.pdf"),
      run: async () => {
        const { buildPdf, pdfFileName } = await import("./pdf");
        const pdf = buildPdf(doc, {
          lang,
          statusLabel: (status) => t(`status.${status as Status}`),
          labels: {
            drawingTitle: t("exporting.drawingTitle"),
            legend: t("exporting.legend"),
            schedule: t("exporting.schedule"),
            scale: t("exporting.scale"),
            date: t("exporting.date"),
            drawnBy: t("exporting.drawnBy"),
            north: t("exporting.north"),
            qty: t("common.qty"),
            status: t("common.status"),
            budget: t("procurement.budget"),
            quoted: t("procurement.bestQuote"),
            total: t("common.total"),
            plot: t("editor.plot"),
            sheet: t("exporting.sheet"),
            interior: t("editor.interior"),
          },
        });
        const bytes = new Uint8Array(pdf.output("arraybuffer"));
        return saveBinaryFile(
          bytes,
          pdfFileName(doc),
          ["pdf"],
          "application/pdf",
        );
      },
    },
    {
      icon: "palette",
      label: t("exporting.png"),
      run: async () => {
        const bytes = stagePng();
        if (!bytes) return null;
        return saveBinaryFile(
          bytes,
          pngFileName(doc.project.name),
          ["png"],
          "image/png",
        );
      },
    },
    {
      icon: "copy",
      label: t("exporting.project"),
      run: () => exportProjectFile(doc),
    },
  ];

  return (
    <div ref={containerRef} className="relative">
      <Button variant="primary" onClick={() => setOpen(!open)}>
        <Icon name="download" size={14} /> {t("editor.exportMenu")}
      </Button>

      {open && (
        <div className="panel absolute right-0 z-30 mt-1 w-56 overflow-hidden p-1 shadow-xl">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => void run(item.run)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-sea-500/10"
            >
              <Icon name={item.icon} size={15} />
              {item.label}
            </button>
          ))}
        </div>
      )}

      {message && (
        <div className="panel absolute right-0 z-30 mt-1 w-72 p-2.5 text-[11px] shadow-xl">
          {message}
        </div>
      )}
    </div>
  );
}
