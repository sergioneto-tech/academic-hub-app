import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAppStore } from "@/lib/AppStore";
import { getDegreeAccent } from "@/lib/degreeTheme";
import { cn } from "@/lib/utils";

const OUTPUT_SIZE = 512;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

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

  const baseScale = Math.max(OUTPUT_SIZE / image.width, OUTPUT_SIZE / image.height);
  const scale = baseScale * zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  const maxX = Math.max(0, (width - OUTPUT_SIZE) / 2);
  const maxY = Math.max(0, (height - OUTPUT_SIZE) / 2);
  const offsetX = -maxX + ((x + 100) / 200) * maxX * 2;
  const offsetY = -maxY + ((y + 100) / 200) * maxY * 2;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  context.drawImage(image, offsetX, offsetY, width, height);
  return canvas.toDataURL("image/webp", 0.86);
}

export function ProfileAvatar({ className, editable = false }: { className?: string; editable?: boolean }) {
  const { state } = useAppStore();
  const accent = getDegreeAccent(state.degree);
  const avatarUrl = state.profile?.avatarUrl;
  const displayName = state.profile?.displayName || "Aluno";

  const content = (
    <div className={cn("relative shrink-0", className)}>
      <div
        className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-card font-semibold"
        style={{ border: `3px solid ${accent.color}`, boxShadow: `0 0 0 4px ${accent.soft}` }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={`Fotografia de ${displayName}`} className="h-full w-full object-cover" />
        ) : (
          <span style={{ color: accent.color }}>{initials(displayName)}</span>
        )}
      </div>
      {editable && (
        <span className="absolute bottom-0 right-0 grid h-6 w-6 translate-x-0.5 translate-y-0.5 place-items-center rounded-full bg-card text-foreground shadow ring-1 ring-border">
          <Camera className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );

  return editable ? <ProfileAvatarEditor trigger={content} /> : content;
}

export default function ProfileAvatarEditor({ trigger }: { trigger?: React.ReactNode }) {
  const { state, setProfile } = useAppStore();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string | null>(state.profile?.avatarUrl ?? null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSource(state.profile?.avatarUrl ?? null);
    setZoom(1);
    setX(0);
    setY(0);
    setError(null);
  }, [open, state.profile?.avatarUrl]);

  const previewStyle = useMemo(() => ({
    transform: `translate(${x / 2}px, ${y / 2}px) scale(${zoom})`,
  }), [x, y, zoom]);

  const onFile = (file?: File) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Seleciona uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("A imagem não pode ultrapassar 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSource(String(reader.result));
      setZoom(1);
      setX(0);
      setY(0);
    };
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
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    setProfile({ avatarUrl: undefined, avatarPath: undefined });
    setSource(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button variant="outline">Alterar fotografia</Button>}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar fotografia</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="mx-auto h-56 w-56 overflow-hidden rounded-full border-4 border-card bg-muted shadow-inner ring-1 ring-border">
            {source ? (
              <img src={source} alt="Pré-visualização" className="h-full w-full object-cover transition-transform" style={previewStyle} />
            ) : (
              <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
                <ImagePlus className="mx-auto mb-2 h-8 w-8" />
                Seleciona uma fotografia
              </div>
            )}
          </div>

          <Input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => onFile(event.target.files?.[0])}
          />

          <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" />
            Escolher imagem
          </Button>

          {source && (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label>Zoom</Label>
                <Slider min={1} max={2.5} step={0.05} value={[zoom]} onValueChange={([value]) => setZoom(value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Posição horizontal</Label>
                <Slider min={-100} max={100} step={1} value={[x]} onValueChange={([value]) => setX(value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Posição vertical</Label>
                <Slider min={-100} max={100} step={1} value={[y]} onValueChange={([value]) => setY(value)} />
              </div>
            </div>
          )}

          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</div>}

          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="ghost" onClick={remove} disabled={!state.profile?.avatarUrl}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remover
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="button" onClick={save} disabled={!source || busy}>{busy ? "A guardar..." : "Guardar"}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}