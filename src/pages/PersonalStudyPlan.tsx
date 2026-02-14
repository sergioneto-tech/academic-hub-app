import { useState, useMemo, useCallback } from "react";
import { useAppStore } from "@/lib/AppStore";
import type { StudyBlock, StudyBlockStatus } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Download, Plus, Trash2, BookOpen, PenLine, RotateCcw, Target, MoreHorizontal, ArrowLeft, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

const ACTIVITY_LABELS: Record<StudyBlock["activity"], { label: string; icon: typeof BookOpen }> = {
  reading: { label: "📖 Leitura", icon: BookOpen },
  exercises: { label: "✏️ Exercícios", icon: PenLine },
  revision: { label: "🔄 Revisão", icon: RotateCcw },
  efolio: { label: "🎯 e-fólio", icon: Target },
  other: { label: "📋 Outro", icon: MoreHorizontal },
};

const STATUS_CONFIG: Record<StudyBlockStatus, { label: string; color: string; bg: string; dropBg: string }> = {
  todo: { label: "Por fazer", color: "text-muted-foreground", bg: "bg-muted/50 border-border", dropBg: "bg-muted/20" },
  in_progress: { label: "Em progresso", color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning)/0.08)] border-[hsl(var(--warning)/0.3)]", dropBg: "bg-[hsl(var(--warning)/0.05)]" },
  done: { label: "Feito", color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success)/0.08)] border-[hsl(var(--success)/0.3)]", dropBg: "bg-[hsl(var(--success)/0.05)]" },
};

const COLUMNS: StudyBlockStatus[] = ["todo", "in_progress", "done"];

function BlockCard({ block, courseName, onStatusChange, onDelete, index }: {
  block: StudyBlock;
  courseName: string;
  onStatusChange: (status: StudyBlockStatus) => void;
  onDelete: () => void;
  index: number;
}) {
  const activity = ACTIVITY_LABELS[block.activity];
  const nextStatus: StudyBlockStatus | null =
    block.status === "todo" ? "in_progress" : block.status === "in_progress" ? "done" : null;

  const timeLabel = block.startTime || block.endTime
    ? `${block.startTime || "—"} → ${block.endTime || "—"}`
    : null;

  return (
    <Draggable draggableId={block.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`p-3 rounded-lg border space-y-2 transition-shadow ${STATUS_CONFIG[block.status].bg} ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/30" : ""}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{block.title}</p>
              <p className="text-xs text-muted-foreground">{courseName}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{activity.label}</Badge>
            <span className="text-xs text-muted-foreground">
              {block.startDate} → {block.endDate}
            </span>
          </div>
          {timeLabel && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {timeLabel}
            </div>
          )}
          {block.notes && <p className="text-xs text-muted-foreground italic">{block.notes}</p>}
          {nextStatus && (
            <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => onStatusChange(nextStatus)}>
              Mover para: {STATUS_CONFIG[nextStatus].label}
            </Button>
          )}
        </div>
      )}
    </Draggable>
  );
}

export default function PersonalStudyPlan() {
  const { state, addStudyBlock, updateStudyBlock, removeStudyBlock } = useAppStore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    courseId: "",
    title: "",
    activity: "reading" as StudyBlock["activity"],
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    notes: "",
  });

  const activeCourses = useMemo(
    () => state.courses.filter((c) => c.isActive && !c.isCompleted),
    [state.courses]
  );

  const courseNameMap = useMemo(() => {
    const map = new Map<string, string>();
    state.courses.forEach((c) => map.set(c.id, `${c.code} — ${c.name}`));
    return map;
  }, [state.courses]);

  const blocks = state.studyBlocks ?? [];

  const blocksByStatus = useMemo(() => {
    const map: Record<StudyBlockStatus, StudyBlock[]> = { todo: [], in_progress: [], done: [] };
    for (const b of blocks) {
      (map[b.status] ?? map.todo).push(b);
    }
    for (const key of COLUMNS) {
      map[key].sort((a, b) => a.startDate.localeCompare(b.startDate));
    }
    return map;
  }, [blocks]);

  const handleAdd = useCallback(() => {
    if (!form.courseId || !form.title.trim() || !form.startDate || !form.endDate) {
      toast({ title: "Preenche todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    addStudyBlock({
      courseId: form.courseId,
      title: form.title.trim(),
      activity: form.activity,
      startDate: form.startDate,
      endDate: form.endDate,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      status: "todo",
      notes: form.notes.trim() || undefined,
    });
    setForm({ courseId: "", title: "", activity: "reading", startDate: "", endDate: "", startTime: "", endTime: "", notes: "" });
    setDialogOpen(false);
    toast({ title: "Bloco de estudo criado" });
  }, [form, addStudyBlock, toast]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as StudyBlockStatus;
    const blockId = result.draggableId;
    updateStudyBlock(blockId, { status: newStatus });
  }, [updateStudyBlock]);

  const handleExportIcs = useCallback(() => {
    if (blocks.length === 0) {
      toast({ title: "Sem blocos para exportar", variant: "destructive" });
      return;
    }

    const lines: string[] = [];
    lines.push("BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN", "PRODID:-//Academic Hub//Study Plan//PT", "X-WR-CALNAME:Plano de Estudo Pessoal");

    const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    for (const b of blocks) {
      if (b.status === "done") continue;
      const courseName = courseNameMap.get(b.courseId) ?? "Cadeira";
      const actLabel = ACTIVITY_LABELS[b.activity].label;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:study-${b.id}@academic-hub.local`);
      lines.push(`DTSTAMP:${now}`);
      lines.push(`SUMMARY:${actLabel} — ${b.title}`);
      lines.push(`DESCRIPTION:${courseName}${b.notes ? "\\n" + b.notes : ""}`);

      if (b.startTime) {
        // Timed event
        const dtStart = b.startDate.replace(/-/g, "") + "T" + (b.startTime.replace(":", "") + "00");
        const endTime = b.endTime || b.startTime;
        const dtEnd = b.endDate.replace(/-/g, "") + "T" + (endTime.replace(":", "") + "00");
        lines.push(`DTSTART:${dtStart}`);
        lines.push(`DTEND:${dtEnd}`);
      } else {
        // All-day event
        const dtStart = b.startDate.replace(/-/g, "");
        const endDate = new Date(b.endDate);
        endDate.setDate(endDate.getDate() + 1);
        const dtEndPlusOne = endDate.toISOString().slice(0, 10).replace(/-/g, "");
        lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
        lines.push(`DTEND;VALUE=DATE:${dtEndPlusOne}`);
      }

      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:PT9H", `DESCRIPTION:${actLabel} — ${b.title}`, "END:VALARM");
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");

    const content = lines.join("\r\n") + "\r\n";
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plano-estudo-${new Date().toISOString().slice(0, 10)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ title: "Ficheiro .ics exportado" });
  }, [blocks, courseNameMap, toast]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/plano"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Plano de Estudo Pessoal</h1>
            <p className="text-sm text-muted-foreground mt-1">Organiza as tuas semanas de estudo — arrasta blocos entre colunas</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportIcs}>
            <Download className="h-4 w-4 mr-2" /> Exportar .ics
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Novo bloco</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo bloco de estudo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Cadeira *</Label>
                  <Select value={form.courseId} onValueChange={(v) => setForm((f) => ({ ...f, courseId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleciona uma cadeira" /></SelectTrigger>
                    <SelectContent>
                      {activeCourses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input placeholder="Ex: Ler Capítulo 3" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Atividade</Label>
                  <Select value={form.activity} onValueChange={(v) => setForm((f) => ({ ...f, activity: v as StudyBlock["activity"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Data início *</Label>
                    <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data fim *</Label>
                    <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Hora início</Label>
                    <Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora fim</Label>
                    <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea placeholder="Notas opcionais..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
                </div>
                <Button className="w-full" onClick={handleAdd}>Criar bloco</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban columns with drag & drop */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((status) => {
            const config = STATUS_CONFIG[status];
            const columnBlocks = blocksByStatus[status];
            return (
              <Card key={status} className="min-h-[200px]">
                <CardHeader className="pb-3">
                  <CardTitle className={`text-sm font-semibold flex items-center gap-2 ${config.color}`}>
                    <span className={`w-3 h-3 rounded-full ${
                      status === "todo" ? "bg-muted-foreground" :
                      status === "in_progress" ? "bg-[hsl(var(--warning))]" :
                      "bg-[hsl(var(--success))]"
                    }`} />
                    {config.label}
                    <Badge variant="outline" className="ml-auto text-xs">{columnBlocks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <CardContent
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-3 min-h-[100px] rounded-b-lg transition-colors ${snapshot.isDraggingOver ? config.dropBg + " ring-2 ring-inset ring-primary/20" : ""}`}
                    >
                      {columnBlocks.length === 0 && !snapshot.isDraggingOver ? (
                        <p className="text-xs text-muted-foreground text-center py-8">Sem blocos</p>
                      ) : (
                        columnBlocks.map((block, index) => (
                          <BlockCard
                            key={block.id}
                            block={block}
                            index={index}
                            courseName={courseNameMap.get(block.courseId) ?? "—"}
                            onStatusChange={(s) => updateStudyBlock(block.id, { status: s })}
                            onDelete={() => removeStudyBlock(block.id)}
                          />
                        ))
                      )}
                      {provided.placeholder}
                    </CardContent>
                  )}
                </Droppable>
              </Card>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
