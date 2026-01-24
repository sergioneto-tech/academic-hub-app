import { useState, useRef } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAppStore } from "@/lib/AppStore";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Download, Upload, RotateCcw, Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { Course } from "@/types";

export default function Settings() {
  const { state, exportData, importData, resetData, addCatalogCourse, updateCatalogCourse, removeCatalogCourse, setCourseActive } = useAppStore();
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newCourse, setNewCourse] = useState({
    code: "",
    name: "",
    year: 1,
    semester: 1,
  });

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gestor-academico-uab-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Dados exportados",
      description: "O ficheiro JSON foi descarregado.",
    });
  };

  const handleImport = () => {
    try {
      const success = importData(importText);
      if (success) {
        toast({
          title: "Dados importados",
          description: "Os dados foram carregados com sucesso.",
        });
        setImportText("");
        setShowImport(false);
      } else {
        throw new Error("Invalid format");
      }
    } catch {
      toast({
        title: "Erro na importação",
        description: "O formato do ficheiro é inválido.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImportText(event.target?.result as string);
        setShowImport(true);
      };
      reader.readAsText(file);
    }
  };

  const handleReset = () => {
    resetData();
    toast({
      title: "Dados resetados",
      description: "Todos os dados foram repostos ao estado inicial.",
    });
  };

  const handleAddCourse = () => {
    if (!newCourse.code || !newCourse.name) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o código e nome da cadeira.",
        variant: "destructive",
      });
      return;
    }
    addCatalogCourse(newCourse);
    setNewCourse({ code: "", name: "", year: 1, semester: 1 });
    setShowAddCourse(false);
    toast({
      title: "Cadeira adicionada",
      description: `${newCourse.name} foi adicionada ao catálogo.`,
    });
  };

  const handleUpdateCourse = () => {
    if (!editingCourse) return;
    const { id, ...rest } = editingCourse;
    updateCatalogCourse(id, rest);
    setEditingCourse(null);
    toast({
      title: "Cadeira atualizada",
      description: "As alterações foram guardadas.",
    });
  };

  const handleDeleteCourse = (course: Course) => {
    removeCatalogCourse(course.id);
    toast({
      title: "Cadeira removida",
      description: `${course.name} foi removida do catálogo.`,
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Definições</h1>
      
      {/* Export/Import */}
      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
          <CardDescription>
            Exporte ou importe os seus dados para backup ou transferência.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar Ficheiro
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <RotateCcw className="h-4 w-4 mr-2" />
                Resetar Dados
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Resetar todos os dados?</DialogTitle>
                <DialogDescription>
                  Esta ação irá apagar todos os seus dados e repor o estado
                  inicial. Esta ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="destructive" onClick={handleReset}>
                  Confirmar Reset
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Dados</DialogTitle>
            <DialogDescription>
              Cole o conteúdo JSON ou verifique os dados do ficheiro.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Cole aqui o JSON..."
            rows={10}
            className="font-mono text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport}>Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Catalog Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Catálogo de Cadeiras</CardTitle>
            <CardDescription>
              Adicione ou edite cadeiras no catálogo.
            </CardDescription>
          </div>
          <Dialog open={showAddCourse} onOpenChange={setShowAddCourse}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Cadeira
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Cadeira</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    value={newCourse.code}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, code: e.target.value })
                    }
                    placeholder="21001"
                  />
                </div>
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={newCourse.name}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, name: e.target.value })
                    }
                    placeholder="Introdução à Programação"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="year">Ano</Label>
                    <Input
                      id="year"
                      type="number"
                      min="1"
                      max="5"
                      value={newCourse.year}
                      onChange={(e) =>
                        setNewCourse({
                          ...newCourse,
                          year: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="semester">Semestre</Label>
                    <Input
                      id="semester"
                      type="number"
                      min="1"
                      max="2"
                      value={newCourse.semester}
                      onChange={(e) =>
                        setNewCourse({
                          ...newCourse,
                          semester: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddCourse}>Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.courses.map((course) => (
            <div
              key={course.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{course.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {course.code} • {course.year}º ano • {course.semester}º sem
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm mr-2">
                  <Checkbox
                    checked={!!course.isActive}
                    disabled={course.isCompleted}
                    onCheckedChange={(v) => setCourseActive(course.id, Boolean(v))}
                  />
                  Em curso
                </label>
                <Dialog
                  open={editingCourse?.id === course.id}
                  onOpenChange={(open) =>
                    setEditingCourse(open ? course : null)
                  }
                >
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar Cadeira</DialogTitle>
                    </DialogHeader>
                    {editingCourse && (
                      <div className="space-y-4">
                        <div>
                          <Label>Código</Label>
                          <Input
                            value={editingCourse.code}
                            onChange={(e) =>
                              setEditingCourse({
                                ...editingCourse,
                                code: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Nome</Label>
                          <Input
                            value={editingCourse.name}
                            onChange={(e) =>
                              setEditingCourse({
                                ...editingCourse,
                                name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Ano</Label>
                            <Input
                              type="number"
                              min="1"
                              max="5"
                              value={editingCourse.year}
                              onChange={(e) =>
                                setEditingCourse({
                                  ...editingCourse,
                                  year: parseInt(e.target.value) || 1,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Semestre</Label>
                            <Input
                              type="number"
                              min="1"
                              max="2"
                              value={editingCourse.semester}
                              onChange={(e) =>
                                setEditingCourse({
                                  ...editingCourse,
                                  semester: parseInt(e.target.value) || 1,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    <DialogFooter>
                      <Button onClick={handleUpdateCourse}>Guardar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDeleteCourse(course)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
