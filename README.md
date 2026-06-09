# 🌵 Mandacaru V1

O **Mandacaru** é um Google Sheets Add-on avançado projetado para automação robusta, geração de documentos/slides em lote (como relatórios, certificados, contratos e faturas) e envio de e-mails em massa com anexos em PDF sincronizados. 

Desenvolvido inteiramente em **TypeScript** e executado nativamente no Google Apps Script, o Mandacaru foi concebido para ser uma alternativa moderna, aberta e altamente resiliente a ferramentas conhecidas do mercado como o *AutoCrat*.

---

## 📋 Visão Geral

### O Problema que Resolve
Processos manuais de geração de documentos e envio de e-mails com base em dados de planilhas são lentos, propensos a erros e difíceis de escalar. Ferramentas legadas no ecossistema do Google Workspace costumam sofrer com falhas silenciosas de sincronização no Google Drive, imagens quebradas em PDFs resultantes ou perda de formatação de valores da planilha (como datas exibidas como carimbos de data/hora brutos do JS ou moedas sem símbolo).

### Diferenciais do Mandacaru
* **Resiliência contra Latência de Sincronização:** Implementa salvamentos síncronos explícitos (`saveAndClose()`) combinados com atrasos estratégicos de sincronização (`Utilities.sleep`) para garantir que os buffers de imagens e textos estejam 100% gravados no Drive antes de qualquer conversão para PDF.
* **Fidelidade de Formatação:** Lê os dados visuais reais da planilha (`getDisplayValues()`), respeitando formatações personalizadas de datas, moedas, números decimais e porcentagens aplicadas pelo usuário diretamente no Sheets.
* **Suporte Rico a HTML e Emojis:** Motor de e-mails com suporte total a codificação UTF-8 (sem corrupção de emojis nas configurações) e renderização rica de templates HTML com quebras de linha (`<br>`) e injeções de tags (como negritos ou links).
* **Rollback Automático na Lixeira:** Em caso de falha no preenchimento de templates, o arquivo temporário gerado é enviado à lixeira para evitar poluir o Google Drive do usuário.

---

## 🏛️ Arquitetura do Sistema

O projeto é modular e está organizado no diretório `src/`. Cada arquivo possui responsabilidade única e bem definida:

```
src/
├── appsscript.json      # Configuração de escopos e manifesto do Add-on
├── Code.ts              # Ponto de entrada, menu e camada de comunicação RPC
├── ConfigStore.ts       # Abstração de persistência segura via PropertiesService
├── TemplateEngine.ts    # Mecanismo polimórfico de substituição de tags
├── MergeProcessor.ts    # Orquestrador de fluxo de dados da planilha
├── MailService.ts       # Validador de e-mails, conversor PDF e motor de envio
├── TriggerManager.ts    # Gerenciador de gatilhos automáticos (onFormSubmit)
└── sidebar.html         # Interface gráfica do Add-on (painel lateral)
```

### Detalhamento dos Componentes

#### 1. [Code.ts](file:///home/manoel/Projects/mandacaru/src/Code.ts)
Ponto de entrada do Add-on. Gerencia o evento `onOpen` para renderizar o menu personalizado na planilha ("🌵 Mandacaru") e expõe a camada RPC (*Remote Procedure Call*) que permite que a interface HTML (`sidebar.html`) interaja com as APIs internas de forma segura.

#### 2. [ConfigStore.ts](file:///home/manoel/Projects/mandacaru/src/ConfigStore.ts)
Encapsula o acesso ao `PropertiesService` do Google Apps Script (escopo de documento). Garante a persistência e a recuperação segura de configurações de mapeamento de tags, credenciais de e-mail e IDs de templates estruturados no formato JSON.

#### 3. [TemplateEngine.ts](file:///home/manoel/Projects/mandacaru/src/TemplateEngine.ts)
Aplica polimorfismo através da interface `DocumentProcessor` para suportar diferentes tipos de documentos do Workspace.
* **Google Docs:** Utiliza `Body.replaceText()` para preencher os marcadores.
* **Google Slides:** Utiliza `Presentation.replaceAllText()` e executa a persistência explícita via `saveAndClose()`.
* **Mecanismo de Rollback:** Se ocorrer um erro durante a escrita no arquivo temporário, o motor move automaticamente o arquivo criado para a lixeira do Drive, evitando acúmulo de arquivos corrompidos.

#### 4. [MergeProcessor.ts](file:///home/manoel/Projects/mandacaru/src/MergeProcessor.ts)
O orquestrador do fluxo. Ele lê os dados formatados do Sheets utilizando `.getDisplayValues()`, mapeia os cabeçalhos dinamicamente, dispara o preenchimento de templates pelo `TemplateEngine` e solicita o envio de e-mails pelo `MailService`. Ao final de cada linha processada, injeta um status visual estilizado na planilha (verde para sucesso, vermelho com a mensagem descritiva em caso de erro).

#### 5. [MailService.ts](file:///home/manoel/Projects/mandacaru/src/MailService.ts)
Gerencia o ciclo de vida do e-mail e geração de PDF. Valida sintaticamente o e-mail de destino, aplica uma trava de segurança de sincronização (`Utilities.sleep(3000)`) para tolerar latências do Drive, converte o arquivo para Blob PDF e despacha o e-mail via `GmailApp` configurando tanto o corpo textual bruto quanto a propriedade `htmlBody` (com substituição de `\n` por `<br>`).

#### 6. [TriggerManager.ts](file:///home/manoel/Projects/mandacaru/src/TriggerManager.ts)
Gerencia a criação e exclusão programática do gatilho de formulário (`onFormSubmit`). Permite a automação em tempo real: sempre que uma nova resposta é submetida na planilha, o fluxo de mesclagem é acionado automaticamente.

#### 7. [sidebar.html](file:///home/manoel/Projects/mandacaru/src/sidebar.html)
A interface de usuário responsiva. Construída em HTML5 puro, CSS Vanilla (seguindo a identidade visual limpa do Google Material Design) e JavaScript nativo para manipulação do DOM e comunicação assíncrona.

---

## ⚡ Camada de Comunicação RPC (google.script.run)

A interface lateral (`sidebar.html`) e o backend em Apps Script (`Code.ts`) comunicam-se de forma assíncrona via ponte RPC. Abaixo estão descritos os principais endpoints expostos no backend:

### `getSpreadsheetHeaders(): string[]`
Busca e retorna a primeira linha da planilha ativa contendo a lista ordenada de cabeçalhos de colunas para popular os seletores de mapeamento de tags da interface.

### `getSavedConfigJson(): string`
Recupera a string JSON de configurações persistida no `PropertiesService` correspondente ao documento ativo, preenchendo os campos do formulário ao abrir a aba lateral.

### `saveConfigJson(configJson: string): string`
Valida e salva a string de configurações JSON contendo os mapeamentos, IDs de templates e informações de e-mail. Retorna uma mensagem de confirmação em texto em caso de sucesso.

---

## 📄 Licença

Este projeto está licenciado sob a **Licença MIT** - consulte o arquivo [LICENSE](LICENSE) para obter mais detalhes.

---

## ✉️ Contato & Suporte

Desenvolvido por **Manoel Roberto**  
* E-mail: [manoelrobertoms@gmail.com](mailto:manoelrobertoms@gmail.com)  

---

Desenvolvido com tecnologia e resiliência em Feira de Santana, Bahia - Brasil 🌵
