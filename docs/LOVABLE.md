# Como colocar o Lataria no Lovable (com Lovable Cloud)

O código está em **https://github.com/viniciusrigo136/chapgest360** (branch `main`).

**Caminho mais simples:** se a sua tela do Lovable tiver a opção de **importar um repositório do GitHub**, escolha `chapgest360` e pule para o Passo 3. Se não tiver, siga os passos abaixo.

O prompt completo do banco, já com o SQL dentro, está em [`PROMPT_BANCO_LOVABLE.md`](PROMPT_BANCO_LOVABLE.md).

O Lovable **não importa um repositório GitHub que já existe**: ao conectar o GitHub, ele sempre cria um repositório novo. Por isso a ordem é esta:

1. Criar o projeto no Lovable e ativar o Lovable Cloud.
2. Conectar o projeto ao GitHub, e o Lovable cria o repositório.
3. Enviar o código do Lataria para esse repositório.
4. Pedir ao Lovable que crie o banco (Prompt 2).

---

## Passo 1 — Criar o projeto no Lovable

1. Em lovable.dev, crie um projeto novo com um prompt curto, por exemplo: `Projeto em branco chamado Lataria.`
2. Ative o **Lovable Cloud** no projeto (aba Cloud). Isso cria o banco e o arquivo `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Clique em **GitHub → Connect** e deixe o Lovable criar o repositório. Anote a URL dele, por exemplo `https://github.com/seu-usuario/lataria`.

## Passo 2 — Enviar o código para o repositório do Lovable

Você precisa do Git instalado. No Windows, use o *Git Bash*. Baixe o projeto e envie para o repositório que o Lovable criou:

```bash
git clone https://github.com/viniciusrigo136/chapgest360.git
```

```bash
cd chapgest360
```

```bash
bash scripts/enviar-para-lovable.sh https://github.com/viniciusrigo136/NOME-DO-REPO-DO-LOVABLE.git
```

O script:

- apaga o projeto em branco do Lovable;
- coloca o Lataria no lugar;
- **mantém** o `.env` e o `supabase/config.toml` do Lovable Cloud;
- faz o push.

Em poucos segundos, o Lovable mostra o código novo.

> Se preferir, me passe a URL do repositório que o Lovable criou e eu faço esse envio daqui.

## Passo 3 — Prompt 1 (colar no chat do Lovable)

```
Este projeto foi substituído pelo código do sistema "Lataria" (gestão para funilaria e pintura), enviado pelo GitHub. O código já está completo e testado. NÃO reescreva, NÃO reorganize pastas, NÃO troque bibliotecas e NÃO converta para shadcn/ui.

Detalhes importantes do projeto:
- Vite 5 + React 18 + TypeScript + Tailwind CSS v4 (via @tailwindcss/vite, sem tailwind.config e sem postcss.config; as cores e fontes ficam no bloco @theme de src/index.css). Não crie tailwind.config.ts nem postcss.config.js.
- Modo escuro: classe "dark" no <html>, cores em variáveis no src/index.css. Não converta para outro sistema de temas.
- Ícones: lucide-react. Fontes: Plus Jakarta Sans e Barlow Condensed (Google Fonts, no index.html).
- O acesso ao banco fica em src/lib/cloudBackend.ts e é escolhido em src/lib/db.ts pelas variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY. Não crie outra camada de dados e não use src/integrations/supabase no lugar dela.
- Sem essas variáveis o app roda em "modo local" (IndexedDB), com a faixa amarela "Modo local de teste".
- Rotas com react-router (BrowserRouter). A rota pública do cliente é /c/:token e não exige login.

Tarefa: apenas instale as dependências do package.json, confirme que o preview abre sem erros no console e me diga se aparece a tela de login (modo nuvem) ou a faixa amarela de modo local. Se houver erro de build, corrija só o necessário, explique o que mudou e não altere a lógica do sistema.
```

## Passo 4 — Prompt 2: criar o banco no Lovable Cloud

Use a versão completa, com o SQL dentro, de [`PROMPT_BANCO_LOVABLE.md`](PROMPT_BANCO_LOVABLE.md). A versão abaixo lê o arquivo do repositório.

```
Configure o banco de dados do Lovable Cloud para este projeto usando EXATAMENTE o SQL dos arquivos de supabase/migrations/ (20261030000000_lataria_init.sql e depois 20261031000000_lataria_clientes_veiculos.sql), sem alterar nada.

1. Execute esse arquivo como uma migração (ele cria as tabelas organizations, memberships, counters, customers, vehicles, quotes, work_orders, stage_events, payments, photos, catalog_items e costs; os triggers de numeração, totais e proteção de pagamentos; as políticas RLS; as funções create_organization, public_document e public_decision; e o bucket privado de Storage "photos" com suas políticas). Não crie tabelas extras e não mude nomes de colunas: o frontend depende deles.
2. Confirme que o arquivo .env tem VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY do projeto Cloud. O código lê exatamente esses nomes em src/lib/db.ts.
3. Autenticação: deixe ativo o login por e-mail e senha. Ative a confirmação automática de e-mail (auto-confirm), pois o único usuário por enquanto é o dono da oficina.
4. Não gere edge functions nem altere a camada de dados (src/lib/cloudBackend.ts).

Depois, teste no preview e me confirme cada item:
- Criar conta → aparece "Qual o nome da sua oficina?" → depois abre Configurações.
- Salvar as configurações da empresa.
- Criar um orçamento com cliente, veículo, 1 item e 1 foto da galeria → o número aparece como ORC-ANO-0001.
- Botão "WhatsApp / Link" → "Abrir página do cliente" abre /c/... SEM login e mostra a foto.
- "Transformar em ordem de serviço" → cria OS-ANO-0001 com a foto copiada.
- Registrar um recebimento menor que o saldo. Tentar um maior que o saldo deve mostrar erro.
Se algum passo falhar, mostre o erro exato do console ou da API antes de mudar qualquer coisa.
```

## Depois de publicado

- Abra o site publicado no celular e use "Adicionar à tela inicial" para ter o ícone como um app.
- Os links enviados aos clientes usam o domínio publicado. Publique o projeto antes de mandar links reais.
