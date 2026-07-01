# Academic Hub v0.2.6 — ficheiros corrigidos

Aplicar na raiz do repositório `academic-hub-app`, substituindo os ficheiros existentes.

Correções:
- Marcar cadeira como concluída regressa automaticamente ao Dashboard.
- Sincronização cloud reforçada: upload usa o estado local mais recente; download normaliza e aplica o estado recebido.
- Dashboard mostra sempre cartões do Calendário Académico UAb 2026/2027, mesmo fora da janela de alerta urgente.
- Versão alinhada para v0.2.6 em APP_VERSION, sw.js e release-notes.json.
- package-lock.json sincronizado após `npm install` para evitar futuras falhas com `npm ci`.

Validação realizada:
- `npm install --no-audit --no-fund`
- `npm run build`
