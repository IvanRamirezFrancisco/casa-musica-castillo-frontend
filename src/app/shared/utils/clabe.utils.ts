import { MEXICAN_BANKS, MexicanBank } from '../catalogs/mexican-banks.catalog';

export class ClabeUtils {
  private static readonly WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];

  /**
   * Sanitiza la entrada dejando únicamente los dígitos.
   */
  static sanitizeNumeric(input: string | null | undefined): string {
    if (!input) return '';
    return input.replace(/[^0-9]/g, '');
  }

  /**
   * Formatea la CLABE para su visualización (ej. 012 345 67890 123456 7)
   */
  static formatClabe(clabe: string | null | undefined): string {
    const clean = this.sanitizeNumeric(clabe);
    if (clean.length === 0) return '';
    
    // Formato: 3 (Banco) - 3 (Plaza) - 11 (Cuenta) - 1 (Dígito verificador)
    let formatted = '';
    if (clean.length > 0) formatted += clean.substring(0, 3);
    if (clean.length > 3) formatted += ' ' + clean.substring(3, 6);
    if (clean.length > 6) formatted += ' ' + clean.substring(6, 17);
    if (clean.length > 17) formatted += ' ' + clean.substring(17, 18);
    
    return formatted;
  }

  /**
   * Valida matemáticamente que la CLABE sea correcta usando el algoritmo módulo 10.
   */
  static validateClabeChecksum(clabe: string): boolean {
    const cleanClabe = this.sanitizeNumeric(clabe);
    if (cleanClabe.length !== 18) return false;

    let totalSum = 0;
    for (let i = 0; i < 17; i++) {
      const digit = parseInt(cleanClabe.charAt(i), 10);
      const sum = (digit * this.WEIGHTS[i]) % 10;
      totalSum += sum;
    }

    const expectedCheckDigit = (10 - (totalSum % 10)) % 10;
    const actualCheckDigit = parseInt(cleanClabe.charAt(17), 10);

    return expectedCheckDigit === actualCheckDigit;
  }

  /**
   * Detecta el banco basado en los primeros 3 dígitos de la CLABE.
   */
  static detectBankFromClabe(clabe: string): MexicanBank | null {
    const cleanClabe = this.sanitizeNumeric(clabe);
    if (cleanClabe.length < 3) return null;

    const bankCode = cleanClabe.substring(0, 3);
    const bank = MEXICAN_BANKS.find(b => b.code === bankCode);
    return bank || null;
  }
}
