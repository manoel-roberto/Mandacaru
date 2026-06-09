# Guia de Contribuição 🌵

Seja bem-vindo ao projeto **Mandacaru**! Este guia descreve as etapas necessárias para configurar o ambiente de desenvolvimento local em sistemas baseados em Linux (como Ubuntu, Linux Mint e derivados), as regras de codificação, deploy e boas práticas de versionamento no Git.

---

> [!IMPORTANT]
> ### 🚨 PRÉ-REQUISITO OBRIGATÓRIO: Habilitar a API do Apps Script
> Antes de tentar rodar qualquer comando do `clasp` localmente (login, clone ou push), você **DEVE** habilitar o acesso à API na sua conta do Google:
> 1. Acesse o painel de configurações do Apps Script: [script.google.com/home/usersettings](https://script.google.com/home/usersettings).
> 2. Role a página até encontrar a opção **"API do Google Apps Script"** (Google Apps Script API).
> 3. Altere o seletor para **Ativado** (Enabled).
> 
> Se este passo não for realizado, o comando `npx clasp login` ou `npx clasp push` retornará um erro de permissão OAuth2 ou bloqueio de requisição.

---

## 🛠️ Pré-requisitos Locais

Para manter a consistência e isolamento do ambiente, evite instalar dependências globais ou usar privilégios de administrador (`sudo`).

### 1. Node.js e NVM
Recomendamos a instalação do Node.js LTS utilizando o **nvm** (Node Version Manager) para evitar problemas de permissões no diretório global do npm.

```bash
# Instalar o nvm (caso não possua)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Carregar variáveis no terminal atual
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Instalar e ativar a versão Node.js LTS
nvm install --lts
nvm use --lts
```

### 2. A importância da versão do Clasp (2.5.0)
Este repositório está rigidamente configurado para utilizar a versão **`2.5.0`** do `@google/clasp`. 

> [!WARNING]
> **Por que a versão 2.5.0?**
> A partir das versões `3.x` do `clasp`, o suporte nativo a transpilação imediata de arquivos TypeScript (`.ts`) para JavaScript (`.gs`) foi removido. Para evitar a complexidade de adicionar compiladores/empacotadores locais (como Vite ou esbuild), o projeto trava o `clasp` localmente na versão `2.5.0` para manter a transpilação nativa sob demanda do compilador `typescript` instalado no projeto.
>
> **Sempre execute comandos do clasp prefixados com `npx`** para garantir que a versão do projeto seja chamada, e não a versão global instalada no seu sistema.

---

## 🚀 Instalação e Configuração

Siga os passos abaixo para configurar o repositório local:

```bash
# 1. Clonar o repositório
git clone https://github.com/manoel-roberto/Mandacaru.git
cd mandacaru

# 2. Instalar dependências locais (inclui tsc, @types e clasp 2.5.0)
npm install
```

---

## 🔑 Autenticação e Sincronização (Deploy)

### Passo 1: Login
Gere as credenciais OAuth2 corretas e compatíveis com o formato esperado pela versão `2.5.0` executando o login local:

```bash
npx clasp login
```
*Um link abrirá no seu navegador. Conceda as permissões requeridas utilizando a mesma conta proprietária da planilha/documento de testes.*

### Passo 2: Verificação de Status
Para checar quais arquivos locais serão compilados e enviados, utilize:

```bash
npx clasp status
```
*O retorno esperado deve listar todos os arquivos da pasta `src/` como "Not ignored files".*

### Passo 3: Envio de Arquivos (Deploy)
Para enviar o código local e atualizado para o Google Drive:

```bash
npx clasp push
```
*O clasp compilará os arquivos TypeScript locais em tempo de execução e submeterá os equivalentes `.gs` para a nuvem.*

---

## 📐 Padrões de Código e Tipagem

O projeto utiliza tipagem estrita de TypeScript para as classes nativas do Google Workspace através do pacote `@types/google-apps-script`.

### Validação Estrita Local
Antes de realizar commits ou pushes, execute a checagem estrita do compilador TS local para garantir que não existam erros de sintaxe ou de atribuição de tipos no código:

```bash
npx tsc --noEmit
```

*Nota: Esse comando analisa o arquivo `tsconfig.json` e realiza o lint estático sem gerar arquivos JavaScript físicos no seu Workspace.*

---

## 🌿 Fluxo de Trabalho Git (Git Workflow)

Para manter o histórico do repositório organizado e facilitar revisões de código, siga o padrão de ramificação abaixo:

### 1. Nomenclatura de Branches
Crie sempre ramificações curtas com objetivos claros a partir da branch principal (`main` ou `master`):
* Correção de bugs: `fix/nome-do-bug`
* Novas funcionalidades: `feature/nome-da-funcionalidade`
* Refatoração/Infraestrutura: `refactor/detalhe-da-refatoracao`

```bash
# Exemplo para criar e entrar em uma branch de correção
git checkout -b fix/slides-pdf-sync
```

### 2. Mensagens de Commit Semânticas
Adote o padrão clássico de commits semânticos para descrever de forma direta o impacto da alteração:
* `fix: ...` (correções de bugs)
* `feat: ...` (novas funcionalidades)
* `docs: ...` (alteração em documentações)
* `cleanup: ...` (limpeza de código e formatações de estilo)

*Exemplo:*
```bash
git commit -m "fix: resolve UTF-8 email encoding and sheet display values"
```

---

Qualquer dúvida técnica na configuração do ambiente pode ser enviada diretamente para o e-mail: **manoelrobertoms@gmail.com**. Bons commits! 🌵
