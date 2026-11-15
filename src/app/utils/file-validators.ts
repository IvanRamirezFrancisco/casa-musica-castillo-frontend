export interface FileValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

export class FileValidators {
  private static readonly MAX_SIZE_MB = 5;
  private static readonly MAX_SIZE_BYTES = FileValidators.MAX_SIZE_MB * 1024 * 1024;
  private static readonly ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  private static readonly ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  private static readonly BLOCKED_EXTENSIONS = new Set(['.pdf', '.svg', '.gif', '.exe', '.zip', '.rar', '.html', '.js', '.php', '.jar']);

  /**
   * Valida exhaustivamente un archivo de imagen.
   * Retorna isValid: true si es seguro subirlo.
   */
  static validateImageFile(file: File): FileValidationResult {
    if (!file) {
      return { isValid: false, errorMessage: 'No se seleccionó ningún archivo.' };
    }

    if (!this.isAllowedImageType(file)) {
      return { isValid: false, errorMessage: 'Formato no permitido. Solo se aceptan JPG, PNG y WEBP.' };
    }

    if (!this.isAllowedImageExtension(file.name)) {
      return { isValid: false, errorMessage: 'Extensión no permitida o sospechosa.' };
    }

    if (file.size > this.MAX_SIZE_BYTES) {
      return { isValid: false, errorMessage: `El archivo supera el tamaño máximo de ${this.MAX_SIZE_MB}MB.` };
    }

    return { isValid: true };
  }

  /**
   * Verifica si el MIME type del archivo está en la lista blanca
   */
  static isAllowedImageType(file: File): boolean {
    return this.ALLOWED_TYPES.has(file.type);
  }

  /**
   * Verifica si la extensión del archivo está en la lista blanca y no es de un tipo bloqueado
   */
  static isAllowedImageExtension(filename: string): boolean {
    const lowerName = filename.toLowerCase();
    
    // Verificación de bloqueos
    for (const ext of this.BLOCKED_EXTENSIONS) {
      if (lowerName.endsWith(ext)) {
        return false;
      }
    }

    // Verificación de permitidos
    for (const ext of this.ALLOWED_EXTENSIONS) {
      if (lowerName.endsWith(ext)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Crea una URL de objeto temporal para previsualizaciones.
   */
  static createPreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  /**
   * Libera memoria asociada a la URL temporal.
   */
  static revokePreviewUrl(url: string | null | undefined): void {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}
