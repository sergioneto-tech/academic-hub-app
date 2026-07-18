import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Como usar a aplicação</h1>
        <p className="text-xs text-muted-foreground">
          Manual de utilização do Academic Hub
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🎓 1. Escolher licenciatura</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Vai a <strong>Definições</strong> e seleciona o teu curso na lista de licenciaturas da UAb.</p>
          <p>Clica em <strong>"Guardar"</strong> e depois em <strong>"Carregar cadeiras (plano automático)"</strong> — as cadeiras do plano de estudos oficial são importadas automaticamente com ECTS e Área Científica.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">✅ 2. Ativar cadeiras do semestre</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Em <strong>Definições → Catálogo de cadeiras</strong>, ativa o toggle <strong>"Ativa"</strong> nas cadeiras que estás a frequentar este semestre.</p>
          <p>Ao ativar, são criados automaticamente os campos de avaliação: e-fólio A, e-fólio B, g-fólio e recurso. No detalhe da cadeira, podes adicionar outros e-fólios quando o PUC assim o exigir.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📝 3. Registar notas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>No separador <strong>Cadeiras</strong>, clica numa cadeira ativa para abrir o detalhe.</p>
          <p>Define o valor real de cada e-fólio e introduz as respetivas notas. A soma dos e-fólios e do g-fólio deve totalizar 20 pontos; a aplicação atualiza automaticamente os totais e a nota final.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📊 4. Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>O <strong>Dashboard</strong> mostra um resumo com:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Cadeiras ativas</strong> — quantas estás a frequentar</li>
            <li><strong>Concluídas</strong> — quantas já terminaste</li>
            <li><strong>Média</strong> — média ponderada das cadeiras concluídas</li>
            <li><strong>ECTS concluídos</strong> — total de créditos obtidos</li>
            <li><strong>Eventos</strong> — próximas datas de avaliação</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📋 5. Plano de Estudos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>O separador <strong>Plano</strong> mostra o progresso global do curso por ano/semestre.</p>
          <p>Cada cadeira mostra os ECTS e a Área Científica. As cadeiras concluídas ficam numa secção recolhível no final.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📅 6. Plano de Estudo Pessoal</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Em <strong>Plano → Plano de Estudo Pessoal</strong>, organiza as tuas semanas de estudo com um quadro Kanban.</p>
          <p>Cria blocos de estudo com data, cadeira e estado (Por fazer, Em progresso, Feito).</p>
          <p>Exporta para o teu calendário (Google, Outlook, Apple) via ficheiro <strong>.ics</strong>.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">☁️ 7. Sincronização</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Em <strong>Definições → Conta e sincronização</strong>:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Cria uma conta com email e password</li>
            <li>Confirma o email clicando no link recebido</li>
            <li>Faz login na app</li>
            <li>Ativa a sincronização — os dados são enviados automaticamente para a cloud sempre que fazes alterações</li>
            <li>Noutro dispositivo, faz login e clica em "Carregar da cloud"</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💾 8. Backups</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Em <strong>Definições → Backups</strong>, podes exportar todos os teus dados num ficheiro JSON.</p>
          <p>Útil antes de atualizar a app ou trocar de dispositivo. Podes importar o ficheiro a qualquer momento para restaurar os dados.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🌙 9. Tema e instalação</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Usa o botão no cabeçalho para alternar entre <strong>modo claro</strong> e <strong>modo escuro</strong>.</p>
          <p>Se o browser suportar, podes <strong>instalar a app</strong> como PWA para acesso rápido sem precisar de abrir o browser.</p>
        </CardContent>
      </Card>
    </div>
  );
}
