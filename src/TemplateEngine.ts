/**
 * Interface que abstrai o processador de documentos (Docs/Slides)
 * para unificar a substituição de tags.
 */
interface DocumentProcessor {
  replaceText(target: string, replacement: string): void;
  close(): void;
}

/**
 * Processador para Documentos do Google (Docs)
 */
class GoogleDocProcessor implements DocumentProcessor {
  private doc: GoogleAppsScript.Document.Document;

  constructor(id: string) {
    this.doc = DocumentApp.openById(id);
  }

  public replaceText(target: string, replacement: string): void {
    const body = this.doc.getBody();
    body.replaceText(target, replacement);
  }

  public close(): void {
    this.doc.saveAndClose();
  }
}

/**
 * Processador para Apresentações do Google (Slides)
 */
class GoogleSlideProcessor implements DocumentProcessor {
  private presentation: GoogleAppsScript.Slides.Presentation;

  constructor(id: string) {
    this.presentation = SlidesApp.openById(id);
  }

  public replaceText(target: string, replacement: string): void {
    this.presentation.replaceAllText(target, replacement);
  }

  public close(): void {
    // Apresentações salvam automaticamente. Sem método saveAndClose() necessário.
  }
}

/**
 * Engine responsável por carregar o template, fazer a cópia e realizar a substituição de tags.
 */
class TemplateEngine {
  /**
   * Cria um novo documento com base no template e substitui os marcadores pelos dados da linha.
   * 
   * @param templateId ID do Google Doc ou Slide modelo.
   * @param templateType Tipo do template ('DOC' ou 'SLIDE').
   * @param rowData Dados da linha atual da planilha (mapeados Header -> Valor).
   * @param mappingConfig Configurações de tags (Tag -> Nome da Coluna).
   * @param destinationFolderId ID da pasta de destino no Google Drive (opcional).
   * @param outputName Nome customizado para o arquivo de saída (opcional).
   * @returns O objeto GoogleAppsScript.Drive.File correspondente ao arquivo gerado.
   */
  public static generateDocument(
    templateId: string,
    templateType: 'DOC' | 'SLIDE',
    rowData: Record<string, string>,
    mappingConfig: Record<string, string>,
    destinationFolderId?: string,
    outputName?: string
  ): GoogleAppsScript.Drive.File {
    if (!templateId) {
      throw new Error('O ID do template não foi fornecido.');
    }

    const templateFile = DriveApp.getFileById(templateId);
    let destFolder: GoogleAppsScript.Drive.Folder;

    // Determinar a pasta de destino
    if (destinationFolderId) {
      try {
        destFolder = DriveApp.getFolderById(destinationFolderId);
      } catch (e) {
        console.warn(`Pasta de destino ${destinationFolderId} não encontrada. Salvando no mesmo diretório do template.`, e);
        destFolder = TemplateEngine.getFileParentFolder(templateFile);
      }
    } else {
      destFolder = TemplateEngine.getFileParentFolder(templateFile);
    }

    // Criar o nome do arquivo resultante
    const finalName = outputName || `Mandacaru - ${templateFile.getName()} - ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')}`;

    // Fazer a cópia do template para a pasta de destino
    const copiedFile = templateFile.makeCopy(finalName, destFolder);
    const copiedId = copiedFile.getId();

    try {
      // Instanciar o processador de acordo com o tipo
      let processor: DocumentProcessor;
      if (templateType === 'DOC') {
        processor = new GoogleDocProcessor(copiedId);
      } else if (templateType === 'SLIDE') {
        processor = new GoogleSlideProcessor(copiedId);
      } else {
        throw new Error(`Tipo de template não suportado: ${templateType}`);
      }

      // Realizar a substituição das tags
      for (const [tag, columnName] of Object.entries(mappingConfig)) {
        const value = rowData[columnName] || '';
        
        // Suporta marcadores no formato <<tag>> ou {{tag}}
        processor.replaceText(`<<${tag}>>`, value);
        processor.replaceText(`{{${tag}}}`, value);
      }

      // Salvar e fechar o processador
      processor.close();

      return copiedFile;
    } catch (error) {
      // Em caso de erro, excluir a cópia inacabada para não poluir o Drive
      try {
        copiedFile.setTrashed(true);
      } catch (cleanupError) {
        console.error('Falha ao excluir arquivo temporário após falha na compilação:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Obtém a pasta mãe de um arquivo. Se não existir, retorna a raiz do Drive.
   */
  private static getFileParentFolder(file: GoogleAppsScript.Drive.File): GoogleAppsScript.Drive.Folder {
    const parents = file.getParents();
    if (parents.hasNext()) {
      return parents.next();
    }
    return DriveApp.getRootFolder();
  }
}
