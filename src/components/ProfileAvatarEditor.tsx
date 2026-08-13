import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";

import CloudSyncStatusBadge from "@/components/CloudSyncStatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAppStore } from "@/lib/AppStore";
import { getDegreeAccent } from "@/lib/degreeTheme";
import { cn } from "@/lib/utils";

const OUTPUT_SIZE = 768;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

type ImageMetrics = { width: number; height: number };

function initials(value?: string) {
  const words = (value ?? "Aluno").trim().split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? "A"}${words.length > 1 ? words.at(-1)?.[0] ?? "" : ""}`.toUpperCase();
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    image.src = source;
  });
}

async function createCroppedAvatar(source: string, zoom: number, x: number, y: number): Promise<string> {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("O browser não suporta edição de imagem.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const baseScale = Math.max(OUTPUT_SIZE / image.width, OUTPUT_SIZE / image.height);
  const scale = baseScale * zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  const overflowX = Math.max(0, width - OUTPUT_SIZE);
  const overflowY = Math.max(0, height - OUTPUT_SIZE);
  const centerX = (OUTPUT_SIZE - width) / 2;
  const centerY = (OUTPUT_SIZE - height) / 2;
  const offsetX = centerX - (x / 100) * (overflowX / 2);
  const offsetY = centerY - (y / 100) * (overflowY / 2);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  context.drawImage(image, offsetX, offsetY, width, height);
  return canvas.toDataURL("image/webp", 0.92);
}

export function ProfileAvatar({ className, editable = false }: { className?: string; editable?: boolean }) {
  const { state } = useAppStore();
  const accent = getDegreeAccent(state.degree);
  const avatarUrl = state.profile?.avatarUrl;
  const displayName = state.profile?.displayName || "Aluno";
  const isDashboardHeroAvatar = !editable && Boolean(className?.includes("h-20 w-20") && className?.includes("sm:h-24 sm:w-24"));

  const content = (
    <div className={cn("relative shrink-0", className)}>
      <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-card font-semibold" style={{ border: `3px solid ${accent.color}`, boxShadow: `0 0 0 4px ${accent.soft}` }}>
        {avatarUrl ? <img src={avatarUrl} alt={`Fotografia de ${displayName}`} className="h-full w-full object-cover object-center" /> : <span style={{ color: accent.color }}>{initials(displayName)}</span>}
      </div>
      {editable && <span className="absolute bottom-0 right-0 grid h-6 w-6 translate-x-0.5 translate-y-0.5 place-items-center rounded-full bg-card text-foreground shadow ring-1 ring-border"><Camera className="h-3.5 w-3.5" /></span>}
    </div>
  );

  if (editable) return <ProfileAvatarEditor trigger={content} />;
  if (isDashboardHeroAvatar) return <div className="flex flex-col items-center">{content}<CloudSyncStatusBadge embedded /></div>;
  return content;
}

export default function ProfileAvatarEditor({ trigger }: { trigger?: React.ReactNode }) {
  const { state, setProfile } = useAppStore();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string | null>(state.profile?.avatarUrl ?? null);
  const [metrics, setMetrics] = useState<ImageMetrics | null>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSource(state.profile?.avatarUrl ?? null);
    setMetrics(null);
    setZoom(1);
    setX(0);
    setY(0);
    setError(null);
  }, [open, state.profile?.avatarUrl]);

  useEffect(() => {
    if (!source) { setMetrics(null); return; }
    let cancelled = false;
    void loadImage(source).then(image => {
      if (!cancelled) setMetrics({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
    }).catch(() => { if (!cancelled) setMetrics(null); });
    return () => { cancelled = true; };
  }, [source]);

  const previewStyle = useMemo(() => {
    if (!metrics) return undefined;
    const frame = 224;
    const baseScale = Math.max(frame / metrics.width, frame / metrics.height);
    const scale = baseScale * zoom;
    const width = metrics.width * scale;
    const height = metrics.height * scale;
    const overflowX = Math.max(0, width - frame);
    const overflowY = Math.max(0, height - frame);
    return {
      width: `${width}px`,
      height: `${height}px`,
      maxWidth: "none",
      position: "absolute" as const,
      left: `${(frame - width) / 2 - (x / 100) * (overflowX / 2)}px`,
      top: `${(frame - height) / 2 - (y / 100) * (overflowY / 2)}px`,
    };
  }, [metrics, x, y, zoom]);

  const onFile = (file?: File) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Seleciona uma imagem JPG, PNG ou WebP."); return; }
    if (file.size > MAX_FILE_BYTES) { setError("A imagem não pode ultrapassar 12 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setSource(String(reader.result)); setZoom(1); setX(0); setY(0); };
    reader.onerror = () => setError("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!source) return;
    try {
      setBusy(true);
      setError(null);
      const avatarUrl = await createCroppedAvatar(source, zoom, x, y);
      setProfile({ avatarUrl });
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao guardar a fotografia.");
    } finally { setBusy(false); }
  };

  const remove = () => { setProfile({ avatarUrl: undefined, avatarPath: undefined }); setSource(null); setOpen(false); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button variant="outline">Alterar fotografia</Button>}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Ajustar fotografia</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="relative mx-auto h-56 w-56 overflow-hidden rounded-full border-4 border-card bg-muted shadow-inner ring-1 ring-border">
            {source ? <img src={source} alt="Pré-visualização" className="select-none object-cover" style={previewStyle} /> : <div className="grid h-full place-items-center text-center text-sm text-muted-foreground"><ImagePlus className="mx-auto mb-2 h-8 w-8" />Seleciona uma fotografia</div>}
          </div>
          <Input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
          <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />Escolher imagem</Button>
          {source && <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
            <div className="space-y-1.5"><Label>Zoom</Label><Slider min={1} max={2.5} step={0.05} value={[zoom]} onValueChange={([value]) => setZoom(value)} /></div>
            <div className="space-y-1.5"><Label>Posição horizontal</Label><Slider min={-100} max={100} step={1} value={[x]} onValueChange={([value]) => setX(value)} /></div>
            <div className="space-y-1.5"><Label>Posição vertical</Label><Slider min={-100} max={100} step={1} value={[y]} onValueChange={([value]) => setY(value)} /></div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">A pré-visualização corresponde ao recorte final. A fotografia é guardada em 768×768 WebP com compressão de alta qualidade.</p>
          </div>}
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</div>}
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="ghost" onClick={remove} disabled={!state.profile?.avatarUrl}><Trash2 className="mr-2 h-4 w-4" />Remover</Button>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="button" onClick={save} disabled={!source || busy}>{busy ? "A guardar..." : "Guardar"}</Button></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
