#!/usr/bin/env bash
# Copia este projeto para o repositório GitHub criado pelo Lovable, preservando
# os arquivos de conexão do Lovable Cloud (.env e supabase/config.toml).
#
# Uso (rode dentro da pasta do projeto Lataria):
#   bash scripts/enviar-para-lovable.sh https://github.com/SEU_USUARIO/SEU_REPO_DO_LOVABLE.git
set -euo pipefail
REPO="${1:?Informe a URL do repositório criado pelo Lovable}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"

git clone "$REPO" "$TMP/lovable"
cd "$TMP/lovable"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Guarda o que o Lovable criou para a conexão com o banco
mkdir -p "$TMP/keep/supabase"
[ -f .env ] && cp .env "$TMP/keep/.env"
[ -f supabase/config.toml ] && cp supabase/config.toml "$TMP/keep/supabase/config.toml"

# Remove o projeto em branco do Lovable e coloca o Lataria no lugar
git rm -rq . || true
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
(cd "$SRC" && git archive HEAD) | tar -x -C .

[ -f "$TMP/keep/.env" ] && cp "$TMP/keep/.env" .env
[ -f "$TMP/keep/supabase/config.toml" ] && cp "$TMP/keep/supabase/config.toml" supabase/config.toml

git add -A
git add -f .env 2>/dev/null || true
git commit -m "Importa o sistema Lataria"
git push origin "$BRANCH"
echo "Pronto: código enviado para $REPO ($BRANCH). Abra o projeto no Lovable."
