/**
 * Serviço de gerenciamento de configurações persistentes do Mandacaru.
 * Utiliza o PropertiesService.getDocumentProperties() para salvar configurações no escopo da planilha.
 */
class ConfigStore {
  private static readonly KEYS = {
    TEMPLATE_ID: 'MANDACARU_TEMPLATE_ID',
    TEMPLATE_TYPE: 'MANDACARU_TEMPLATE_TYPE',
    DESTINATION_FOLDER_ID: 'MANDACARU_DEST_FOLDER_ID',
    EMAIL_COLUMN: 'MANDACARU_EMAIL_COLUMN',
    EMAIL_SUBJECT: 'MANDACARU_EMAIL_SUBJECT',
    EMAIL_BODY: 'MANDACARU_EMAIL_BODY',
    EMAIL_TEMPLATE_ID: 'MANDACARU_EMAIL_TEMPLATE_ID',
    USE_DOC_AS_EMAIL_BODY: 'MANDACARU_USE_DOC_AS_EMAIL_BODY',
    MAPPING_CONFIG: 'MANDACARU_MAPPING_CONFIG'
  };

  /**
   * Salva todas as configurações em um único lote.
   */
  public static saveConfig(config: {
    templateId: string;
    templateType: 'DOC' | 'SLIDE';
    destinationFolderId: string;
    emailColumn: string;
    emailSubject: string;
    emailBody: string;
    emailTemplateId: string;
    useDocAsEmailBody: boolean;
    mappingConfig: Record<string, string>;
  }): void {
    const props = PropertiesService.getDocumentProperties();
    props.setProperties({
      [ConfigStore.KEYS.TEMPLATE_ID]: config.templateId,
      [ConfigStore.KEYS.TEMPLATE_TYPE]: config.templateType,
      [ConfigStore.KEYS.DESTINATION_FOLDER_ID]: config.destinationFolderId,
      [ConfigStore.KEYS.EMAIL_COLUMN]: config.emailColumn,
      [ConfigStore.KEYS.EMAIL_SUBJECT]: config.emailSubject,
      [ConfigStore.KEYS.EMAIL_BODY]: config.emailBody,
      [ConfigStore.KEYS.EMAIL_TEMPLATE_ID]: config.emailTemplateId,
      [ConfigStore.KEYS.USE_DOC_AS_EMAIL_BODY]: String(config.useDocAsEmailBody),
      [ConfigStore.KEYS.MAPPING_CONFIG]: JSON.stringify(config.mappingConfig)
    });
  }

  /**
   * Obtém todas as configurações armazenadas.
   */
  public static getConfig() {
    const props = PropertiesService.getDocumentProperties().getProperties();
    
    let mappingConfig: Record<string, string> = {};
    try {
      const rawMapping = props[ConfigStore.KEYS.MAPPING_CONFIG];
      if (rawMapping) {
        mappingConfig = JSON.parse(rawMapping);
      }
    } catch (e) {
      console.error('Erro ao fazer parse do mapeamento de tags:', e);
    }

    return {
      templateId: props[ConfigStore.KEYS.TEMPLATE_ID] || '',
      templateType: (props[ConfigStore.KEYS.TEMPLATE_TYPE] as 'DOC' | 'SLIDE') || 'DOC',
      destinationFolderId: props[ConfigStore.KEYS.DESTINATION_FOLDER_ID] || '',
      emailColumn: props[ConfigStore.KEYS.EMAIL_COLUMN] || '',
      emailSubject: props[ConfigStore.KEYS.EMAIL_SUBJECT] || '',
      emailBody: props[ConfigStore.KEYS.EMAIL_BODY] || '',
      emailTemplateId: props[ConfigStore.KEYS.EMAIL_TEMPLATE_ID] || '',
      useDocAsEmailBody: props[ConfigStore.KEYS.USE_DOC_AS_EMAIL_BODY] === 'true',
      mappingConfig
    };
  }

  /**
   * Limpa todas as configurações salvas do Mandacaru na planilha atual.
   */
  public static clearConfig(): void {
    const props = PropertiesService.getDocumentProperties();
    props.deleteProperty(ConfigStore.KEYS.TEMPLATE_ID);
    props.deleteProperty(ConfigStore.KEYS.TEMPLATE_TYPE);
    props.deleteProperty(ConfigStore.KEYS.DESTINATION_FOLDER_ID);
    props.deleteProperty(ConfigStore.KEYS.EMAIL_COLUMN);
    props.deleteProperty(ConfigStore.KEYS.EMAIL_SUBJECT);
    props.deleteProperty(ConfigStore.KEYS.EMAIL_BODY);
    props.deleteProperty(ConfigStore.KEYS.EMAIL_TEMPLATE_ID);
    props.deleteProperty(ConfigStore.KEYS.USE_DOC_AS_EMAIL_BODY);
    props.deleteProperty(ConfigStore.KEYS.MAPPING_CONFIG);
  }
}
