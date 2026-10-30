# Lataria — gestão para funilaria e pintura

Sistema web (instalável no celular) para orçamentos, ordens de serviço e acompanhamento do veículo pelo cliente.

## O que já funciona

- **Configurações da empresa:** logo, dados, endereço (com busca de CEP), PIX, parcelamento, textos de garantia e condições, mensagens de WhatsApp, numeração e etapas da OS. Esses dados formam o cabeçalho dos documentos.
- **Clientes e veículos**, cadastrados também direto no orçamento, com busca por nome, telefone ou placa.
- **Orçamentos** detalhados ou simplificados:
  - Fotos tiradas na hora ou escolhidas da galeria, comprimidas automaticamente.
  - Forma de pagamento: PIX com QR Code, entrada e parcelas.
  - **Seguradora (opcional):** sinistro, franquia e divisão entre o que a seguradora paga e o que o cliente paga.
  - Impressão/PDF em A4, envio pelo WhatsApp, link e QR Code. O cliente **aprova ou recusa online**.
  - Botão **Transformar em OS**, além de duplicar, arquivar e renovar a validade.
- **Ordens de serviço:**
  - Tudo o que o orçamento tem, mais etapas com histórico e previsão de entrega.
  - **Checklist de entrada opcional** com desenho do carro para marcar avarias, combustível, km, itens e objetos, e assinatura na tela.
  - Recebimentos parciais com estorno (nunca apagados), custos da OS, recibo em A4 e assinatura na entrega.
- **Página do cliente** (`/c/<token>`): etapa atual, linha do tempo, fotos públicas, previsão, valores/saldo, PIX e botão de WhatsApp. Atualiza sozinha a cada 30 segundos. O link pode ser desativado ou trocado a qualquer momento.
- **Painel**, **Produção** (veículos por etapa) e **Catálogo** de serviços.

## Rodar no computador (modo local de teste)

```bash
npm install
npm run dev
```

Sem configurar a nuvem, o app roda em **modo local**: os dados ficam só naquele navegador. Serve para experimentar.

## Usar de verdade (nuvem, celular + computador)

1. Crie um projeto gratuito em https://supabase.com.
2. Em **SQL Editor**, cole e rode o conteúdo de `supabase/migrations/0001_init.sql`.
3. Em **Project Settings → API**, copie a *Project URL* e a *anon public key*.
4. Crie um arquivo `.env` (veja `.env.example`):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. Publique, por exemplo na Vercel: importe o repositório e cadastre as duas variáveis acima. O `vercel.json` já está pronto.
6. Abra o site, crie sua conta e informe o nome da oficina. Depois, no celular, use "Adicionar à tela inicial".

A *anon key* pode ficar no frontend: a segurança vem das políticas RLS do banco. **Nunca** coloque a `service_role` key no app.

## Testes

```bash
npm test
```

```bash
npm run test:sql
```

```bash
npm run build && npx vite preview --port 4173
```

```bash
npm run test:e2e
```

- `npm test` testa os cálculos, o PIX e as validações.
- `npm run test:sql` aplica a migração num PostgreSQL local e testa isolamento entre oficinas, numeração, totais, pagamentos e página pública.
- `npm run test:e2e` (com o preview do comando anterior rodando) percorre o fluxo completo num celular simulado.

## Decisões técnicas

- React + TypeScript + Vite + Tailwind; Supabase (Postgres, Auth, Storage).
- Valores em **centavos**. O banco recalcula os totais por trigger, então o frontend não consegue gravar um total errado.
- Multiempresa desde já: `organization_id` em todas as tabelas, com **RLS** e chaves estrangeiras compostas que impedem ligar dados de oficinas diferentes.
- Itens, condições de pagamento, seguradora e checklist ficam em JSONB dentro do orçamento/OS. Isso é mais simples que tabelas separadas e suficiente enquanto não houver relatórios por item.
- A página pública lê os dados por uma função SQL (`public_document`) que só devolve campos permitidos. As fotos ficam em bucket privado, com URLs temporárias.
- O PDF usa a impressão do navegador sobre uma folha A4 com tamanho fixo em milímetros. O resultado é igual no celular e no computador; no celular, escolha "Salvar como PDF".
- Documentos guardam um retrato dos dados da empresa quando são enviados ou entregues, para não mudarem depois.

## Próximos passos sugeridos

Contas a pagar e fluxo de caixa, estoque de tintas/materiais, agenda, relatórios, aprovação online de itens extras na OS, envio automático pela API do WhatsApp, funcionários com permissões e cobrança por assinatura (SaaS).
