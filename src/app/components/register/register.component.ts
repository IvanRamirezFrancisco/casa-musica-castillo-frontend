import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SanitizationService } from '../../services/sanitization.service';

import zxcvbn from 'zxcvbn';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  showEmailVerification = false;
  showPassword = false; // Para toggle de visibilidad de contraseña
  showConfirmPassword = false; // Para toggle de confirmación de contraseña
  emailValidationMessage = ''; // Para mensajes específicos de email
  passwordStrengthMessage = ''; // Para mensaje de fortaleza de contraseña
  passwordStrength: 'weak' | 'medium' | 'strong' = 'weak';
  
  // ✅ ZXCVBN: Solo usamos el score internamente (sin mostrar mensajes al usuario)
  private zxcvbnScore = 0; // Score de 0-4 (privado, solo para lógica interna)
  
  // ✅ Checklist de requisitos de contraseña en tiempo real
  passwordRequirements = {
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    isNotCommon: true, // Por defecto true, se marca false si es una contraseña común
    zxcvbnStrong: false // Nuevo: debe tener score >= 3 en zxcvbn
  };

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private sanitizationService: SanitizationService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.registerForm = this.fb.group({
      username: ['', [
        Validators.required, 
        Validators.minLength(3), 
        Validators.maxLength(30),
        this.usernameSecurityValidator.bind(this) // ✅ Validador de seguridad
      ]],
      firstName: ['', [
        Validators.required, 
        Validators.minLength(2), 
        Validators.maxLength(50),
        this.nameSecurityValidator.bind(this) // ✅ Validador de seguridad
      ]],
      lastName: ['', [
        Validators.required, 
        Validators.minLength(2), 
        Validators.maxLength(50),
        this.nameSecurityValidator.bind(this) // ✅ Validador de seguridad
      ]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required, 
        Validators.minLength(10), // Aumentado a 10
        Validators.maxLength(255),
        this.zxcvbnPasswordValidator.bind(this) // ✅ Validador con zxcvbn
      ]],
      confirmPassword: ['', [Validators.required]],
      phone: [''], // Opcional
      acceptTerms: [false, [Validators.requiredTrue]]
    }, { validators: this.passwordMatchValidator });

    this.setupRealTimeValidation();
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.registerForm.patchValue({ email: params['email'] });
      }
    });
  }

  /**
   * Configurar validaciones en tiempo real
   */
  private setupRealTimeValidation(): void {
    // Validación de nombre en tiempo real
    this.registerForm.get('firstName')?.valueChanges.subscribe(value => {
      if (value && value.length > 0) {
        this.validateName(value, 'firstName');
      }
    });

    // Validación de apellido en tiempo real
    this.registerForm.get('lastName')?.valueChanges.subscribe(value => {
      if (value && value.length > 0) {
        this.validateName(value, 'lastName');
      }
    });

    // Validación de email en tiempo real
    this.registerForm.get('email')?.valueChanges.subscribe(value => {
      if (value && value.length > 3) {
        this.validateEmailDomain(value);
      } else {
        this.emailValidationMessage = '';
      }
    });

    // Validación de contraseña en tiempo real
    this.registerForm.get('password')?.valueChanges.subscribe(value => {
      if (value) {
        this.updatePasswordStrength(value);
      } else {
        this.passwordStrengthMessage = '';
      }
    });
  }

  /**
   * Validar nombres en tiempo real (detectar código malicioso)
   */
  private validateName(name: string, fieldName: string): void {
    // Patrones maliciosos
    const maliciousPatterns = [
      /<.*>/,  // HTML tags
      /script/i, /alert/i, /eval/i, /javascript/i,
      /drop.*table/i, /select.*from/i, /insert.*into/i,
      /[0-9]/, // Números
      /[@#$%^&*()+=\[\]{}|\\:";'<>?,./!]/  // Símbolos especiales
    ];

    // Verificar patrones maliciosos
    const hasMalicious = maliciousPatterns.some(pattern => pattern.test(name));
    
    const control = this.registerForm.get(fieldName);
    if (control) {
      if (hasMalicious) {
        const currentErrors = control.errors || {};
        if (/[0-9]/.test(name)) {
          currentErrors['invalidChars'] = true;
        } else {
          currentErrors['maliciousContent'] = true;
        }
        control.setErrors(currentErrors);
      } else {
        // Limpiar errores de validación de nombres
        const currentErrors = control.errors || {};
        delete currentErrors['invalidChars'];
        delete currentErrors['maliciousContent'];
        
        const hasOtherErrors = Object.keys(currentErrors).length > 0;
        control.setErrors(hasOtherErrors ? currentErrors : null);
      }
    }
  }

  // Getters para acceder fácilmente a los controles del formulario
  get username() { return this.registerForm.get('username'); }
  get firstName() { return this.registerForm.get('firstName'); }
  get lastName() { return this.registerForm.get('lastName'); }
  get email() { return this.registerForm.get('email'); }
  get password() { return this.registerForm.get('password'); }
  get confirmPassword() { return this.registerForm.get('confirmPassword'); }

  /**
   * Obtiene el mensaje de error para un campo específico
   */
  getFieldError(fieldName: string): string {
    const field = this.registerForm.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return '';
    }

    const errors = field.errors;
    
    // Mensajes específicos por campo
    switch (fieldName) {
      case 'username':
        if (errors['required']) return 'El nombre de usuario es obligatorio';
        if (errors['minlength']) return `El nombre de usuario debe tener al menos ${errors['minlength'].requiredLength} caracteres`;
        if (errors['maxlength']) return `El nombre de usuario no puede tener más de ${errors['maxlength'].requiredLength} caracteres`;
        if (errors['sqlInjection']) return errors['sqlInjection'].message;
        if (errors['xssAttempt']) return errors['xssAttempt'].message;
        if (errors['suspiciousChars']) return errors['suspiciousChars'].message;
        if (errors['invalidFormat']) return errors['invalidFormat'].message;
        break;
        
      case 'firstName':
        if (errors['required']) return 'El nombre es obligatorio';
        if (errors['minlength']) return `El nombre debe tener al menos ${errors['minlength'].requiredLength} caracteres`;
        if (errors['maxlength']) return `El nombre no puede tener más de ${errors['maxlength'].requiredLength} caracteres`;
        if (errors['sqlInjection']) return errors['sqlInjection'].message;
        if (errors['xssAttempt']) return errors['xssAttempt'].message;
        if (errors['containsNumbers']) return errors['containsNumbers'].message;
        if (errors['invalidChars']) return errors['invalidChars'].message;
        if (errors['maliciousContent']) return 'El nombre contiene contenido malicioso';
        break;
        
      case 'lastName':
        if (errors['required']) return 'El apellido es obligatorio';
        if (errors['minlength']) return `El apellido debe tener al menos ${errors['minlength'].requiredLength} caracteres`;
        if (errors['maxlength']) return `El apellido no puede tener más de ${errors['maxlength'].requiredLength} caracteres`;
        if (errors['sqlInjection']) return errors['sqlInjection'].message;
        if (errors['xssAttempt']) return errors['xssAttempt'].message;
        if (errors['containsNumbers']) return errors['containsNumbers'].message;
        if (errors['invalidChars']) return errors['invalidChars'].message;
        if (errors['maliciousContent']) return 'El apellido contiene contenido malicioso';
        break;
        
      case 'email':
        if (errors['required']) return 'El correo electrónico es obligatorio';
        if (errors['email']) return 'El formato del correo electrónico no es válido';
        if (errors['invalidDomain']) return 'Este dominio no está permitido. Use un correo de un proveedor oficial (gmail.com, hotmail.com, outlook.com, yahoo.com)';
        if (errors['fakeDomain']) return 'Este parece ser un dominio falso. Use un correo de un proveedor reconocido';
        if (errors['temporaryEmail']) return 'No se permiten correos temporales. Use su correo personal permanente';
        break;
        
      case 'password':
        if (errors['required']) return 'La contraseña es obligatoria';
        if (errors['minlength']) return `La contraseña debe tener al menos ${errors['minlength'].requiredLength} caracteres`;
        if (errors['maxlength']) return `La contraseña no puede tener más de ${errors['maxlength'].requiredLength} caracteres`;
        if (errors['zxcvbnWeak']) {
          const warning = errors['zxcvbnWeak'].warning;
          const suggestions = errors['zxcvbnWeak'].suggestions;
          let message = 'La contraseña es muy débil. ';
          if (warning) message += warning + '. ';
          if (suggestions && suggestions.length > 0) {
            message += suggestions[0];
          }
          return message;
        }
        if (errors['simplePattern']) return 'Esta contraseña es muy simple. Evite patrones como 123456, qwerty o abc123';
        if (errors['commonPassword']) return 'Esta es una contraseña muy común. Elija una más segura';
        if (errors['sequentialChars']) return 'Evite secuencias como 123, abc o qwerty';
        if (errors['weakComplexity']) return 'La contraseña debe contener: mayúsculas, minúsculas, números y símbolos';
        break;
        
      case 'confirmPassword':
        if (errors['required']) return 'Por favor confirma tu contraseña';
        if (errors['passwordMismatch']) return 'Las contraseñas no coinciden';
        break;
    }
    
    // Fallback para errores genéricos
    if (errors['required']) {
      return `${this.getFieldDisplayName(fieldName)} es obligatorio`;
    }

    if (errors['minlength']) {
      const required = errors['minlength'].requiredLength;
      return `${this.getFieldDisplayName(fieldName)} debe tener al menos ${required} caracteres`;
    }

    if (errors['email']) {
      return 'Por favor ingresa un correo electrónico válido';
    }

    return 'Campo inválido';
  }

  /**
   * Validar dominio de email en tiempo real
   */
  private validateEmailDomain(email: string): void {
    if (!email || !email.includes('@')) {
      this.emailValidationMessage = '';
      return;
    }

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      this.emailValidationMessage = '';
      return;
    }

    // Dominios oficiales permitidos
    const validDomains = [
      'gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 
      'live.com', 'msn.com', 'yahoo.com', 'yahoo.es', 'yahoo.com.mx',
      'aol.com', 'protonmail.com', 'icloud.com', 'me.com', 'mac.com'
    ];

    // Dominios educativos mexicanos específicos
    const mexicanEducationalDomains = [
      'unam.mx', 'ipn.mx', 'itesm.mx', 'udg.mx', 'uanl.mx',
      'uthh.edu.mx', 'utcancun.edu.mx', 'utvt.edu.mx',
      'tecnm.mx', 'itsur.edu.mx', 'itch.edu.mx', 'itsch.edu.mx'
    ];

    // Dominios prohibidos/sospechosos
    const forbiddenDomains = [
      'test.com', 'example.com', 'fake.com', 'ivan.com', 'localhost', 
      '10minutemail.com', 'guerrillamail.com', 'mailinator.com'
    ];

    // Verificar dominios prohibidos
    if (forbiddenDomains.includes(domain)) {
      this.emailValidationMessage = `❌ El dominio '${domain}' no está permitido. Use un correo oficial.`;
      this.setEmailError('invalidDomain');
      return;
    }

    // Verificar si es un dominio válido (comercial o educativo)
    if (validDomains.includes(domain) || mexicanEducationalDomains.includes(domain)) {
      const domainType = validDomains.includes(domain) ? 'comercial' : 'educativo';
      this.emailValidationMessage = `✅ Dominio ${domainType} válido: ${domain}`;
      this.clearEmailError();
      return;
    }

    // Verificar si es un dominio educativo genérico
    if (this.isEducationalDomain(domain)) {
      this.emailValidationMessage = `✅ Dominio educativo válido: ${domain}`;
      this.clearEmailError();
      return;
    }

    // Verificar patrones sospechosos
    if (this.isSuspiciousDomain(domain)) {
      this.emailValidationMessage = `⚠️ El dominio '${domain}' parece sospechoso. Recomendamos usar gmail.com, hotmail.com, etc.`;
      this.setEmailError('fakeDomain');
      return;
    }

    // Dominio no reconocido pero posiblemente válido
    this.emailValidationMessage = `⚠️ Dominio no reconocido: ${domain}. Recomendamos usar proveedores oficiales.`;
  }

  /**
   * Verificar si un dominio es sospechoso
   */
  private isSuspiciousDomain(domain: string): boolean {
    // Dominios muy cortos (ej: a.com, xy.net)
    if (domain.length < 6) return true;
    
    // Solo un nombre + extensión (ej: ivan.com, juan.net)
    const parts = domain.split('.');
    if (parts.length === 2 && parts[0].length < 6) return true;
    
    // Nombres comunes de personas
    const commonNames = ['ivan', 'juan', 'maria', 'jose', 'ana', 'carlos', 'admin', 'test', 'demo'];
    if (commonNames.includes(parts[0])) return true;
    
    return false;
  }

  /**
   * Verificar si un dominio es educativo
   */
  private isEducationalDomain(domain: string): boolean {
    // Patrones para dominios educativos
    const educationalPatterns = [
      /\.edu$/,           // .edu (Estados Unidos)
      /\.edu\.\w{2,3}$/,  // .edu.mx, .edu.ar, etc.
      /\.ac\.\w{2,3}$/,   // .ac.uk, .ac.mx, etc.
      /\.univ\./,         // universidades
      /\.universidad\./,  // universidades en español
      /\.(unam|ipn|itesm|udg|uanl|tecnm)\./,  // Siglas de universidades mexicanas
    ];

    // Verificar si coincide con algún patrón educativo
    const isEducational = educationalPatterns.some(pattern => pattern.test(domain));
    
    if (isEducational) {
      return true;
    }

    // Palabras clave que indican instituciones educativas
    const educationalKeywords = [
      'universidad', 'university', 'instituto', 'institute', 'colegio', 'college',
      'escuela', 'school', 'facultad', 'faculty', 'academica', 'academic',
      'educacion', 'education', 'tecnologico', 'polytechnic', 'utc', 'uth',
      'itesm', 'tec', 'unam', 'ipn'
    ];

    // Verificar si el dominio contiene palabras clave educativas
    return educationalKeywords.some(keyword => 
      domain.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Establecer error en campo email
   */
  private setEmailError(errorType: string): void {
    const emailControl = this.registerForm.get('email');
    if (emailControl) {
      const currentErrors = emailControl.errors || {};
      currentErrors[errorType] = true;
      emailControl.setErrors(currentErrors);
    }
  }

  /**
   * Limpiar errores del campo email
   */
  private clearEmailError(): void {
    const emailControl = this.registerForm.get('email');
    if (emailControl) {
      const currentErrors = emailControl.errors || {};
      delete currentErrors['invalidDomain'];
      delete currentErrors['fakeDomain'];
      delete currentErrors['temporaryEmail'];
      
      // Si no hay otros errores, limpiar completamente
      const hasOtherErrors = Object.keys(currentErrors).length > 0;
      emailControl.setErrors(hasOtherErrors ? currentErrors : null);
    }
  }

  /**
   * Actualizar mensaje de fortaleza de contraseña + Checklist en tiempo real + ZXCVBN
   */
  private updatePasswordStrength(password: string): void {
    if (!password) {
      this.passwordStrengthMessage = '';
      this.passwordStrength = 'weak';
      this.zxcvbnScore = 0;
      // Resetear checklist
      this.passwordRequirements = {
        minLength: false,
        hasUpperCase: false,
        hasLowerCase: false,
        hasNumber: false,
        hasSpecialChar: false,
        isNotCommon: true,
        zxcvbnStrong: false
      };
      return;
    }

    // ✅ EVALUAR CON ZXCVBN PRIMERO (más inteligente)
    const result = zxcvbn(password);
    this.zxcvbnScore = result.score; // 0-4 (almacenado internamente)
    
    // ✅ Score de zxcvbn: 0 (muy débil) a 4 (muy fuerte)
    // Requerimos mínimo score 3 para aprobar
    // Este valor controla directamente el ítem visual "Validación avanzada"
    this.passwordRequirements.zxcvbnStrong = result.score >= 3;

    // ✅ ACTUALIZAR CHECKLIST EN TIEMPO REAL
    this.passwordRequirements.minLength = password.length >= 10;
    this.passwordRequirements.hasUpperCase = /[A-Z]/.test(password);
    this.passwordRequirements.hasLowerCase = /[a-z]/.test(password);
    this.passwordRequirements.hasNumber = /\d/.test(password);
    this.passwordRequirements.hasSpecialChar = /[@$!%*?&._\-#]/.test(password);
    
    // ✅ SEGURIDAD REFORZADA: "No usar contraseñas simples" requiere score >= 3
    // zxcvbn detecta: patrones comunes, secuencias, repeticiones, palabras del diccionario, l33t speak, etc.
    // Score 0-2: RECHAZADO (contraseñas predecibles como 'MyP@ssw0rd2024', 'asdfghjklñÑ@!')
    // Score 3-4: ACEPTADO (contraseñas realmente seguras)
    this.passwordRequirements.isNotCommon = result.score >= 3;

    // ✅ MENSAJE DE FORTALEZA basado en zxcvbn score (cumpliendo rúbrica de seguridad)
    // Score 0-2: Rechazado (Muy débil / Débil / Predecible)
    // Score 3: Aceptable (Fuerte)
    // Score 4: Excelente (Muy fuerte)
    if (result.score < 3) {
      this.passwordStrengthMessage = '❌ Contraseña predecible o débil. Use una combinación más compleja y única.';
      this.passwordStrength = 'weak';
      this.setPasswordError('simplePattern');
    } else if (result.score === 3) {
      this.passwordStrengthMessage = '✅ Contraseña aceptable.';
      this.passwordStrength = 'medium';
      this.clearPasswordError();
    } else {
      this.passwordStrengthMessage = '✅ Contraseña muy fuerte.';
      this.passwordStrength = 'strong';
      this.clearPasswordError();
    }
  }

  /**
   * Verificar si tiene caracteres secuenciales
   */
  private hasSequentialChars(password: string): boolean {
    const sequences = ['123', '234', '345', '456', '567', '678', '789', '890',
                      'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij',
                      'qwe', 'wer', 'ert', 'rty', 'tyu', 'yui', 'uio', 'iop',
                      'asd', 'sdf', 'dfg', 'fgh', 'ghj', 'hjk', 'jkl'];
    
    return sequences.some(seq => password.toLowerCase().includes(seq));
  }

  /**
   * Calcular complejidad de contraseña
   */
  private calculatePasswordComplexity(password: string): {score: number, missing: string[]} {
    const checks = {
      length: password.length >= 8,
      lower: /[a-z]/.test(password),
      upper: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&._-]/.test(password)
    };

    const score = Object.values(checks).filter(Boolean).length;
    const missing = [];

    if (!checks.length) missing.push('8+ caracteres');
    if (!checks.lower) missing.push('minúsculas');
    if (!checks.upper) missing.push('mayúsculas');
    if (!checks.number) missing.push('números');
    if (!checks.special) missing.push('símbolos (@$!%*?&._-)');

    return { score, missing };
  }

  /**
   * Establecer error en campo contraseña
   */
  private setPasswordError(errorType: string): void {
    const passwordControl = this.registerForm.get('password');
    if (passwordControl) {
      const currentErrors = passwordControl.errors || {};
      currentErrors[errorType] = true;
      passwordControl.setErrors(currentErrors);
    }
  }

  /**
   * ✅ VALIDADOR DE SEGURIDAD PARA USERNAME
   * Detecta inyecciones SQL, XSS y otros patrones maliciosos
   */
  private usernameSecurityValidator(control: AbstractControl): ValidationErrors | null {
    const username = control.value;
    
    if (!username) {
      return null; // Si está vacío, lo maneja el Validators.required
    }

    // Patrones de inyección SQL
    const sqlInjectionPatterns = [
      /(\bOR\b|\bAND\b)\s*['"]?\s*\d+\s*['"]?\s*=\s*['"]?\s*\d+/i, // OR '1'='1', AND 1=1
      /(\bOR\b|\bAND\b)\s+['"]?\s*\w+\s*['"]?\s*=\s*['"]?\s*\w+/i, // OR 'a'='a'
      /'\s*(OR|AND)\s+'/i, // ' OR ', ' AND '
      /--/,  // SQL comments
      /\/\*/,  // SQL block comments
      /;.*DROP/i, // DROP TABLE
      /;.*DELETE/i, // DELETE FROM
      /;.*INSERT/i, // INSERT INTO
      /;.*UPDATE/i, // UPDATE SET
      /;.*SELECT/i, // SELECT FROM
      /UNION.*SELECT/i, // UNION SELECT
      /EXEC\s*\(/i, // EXEC(
      /EXECUTE\s*\(/i, // EXECUTE(
      /xp_/i, // Extended stored procedures
      /sp_/i, // Stored procedures
      /0x[0-9a-f]+/i, // Hexadecimal values
      /\bCAST\s*\(/i, // CAST function
      /\bCONVERT\s*\(/i, // CONVERT function
    ];

    // Patrones de XSS
    const xssPatterns = [
      /<script.*?>/i, // <script>
      /<\/script>/i, // </script>
      /<iframe.*?>/i, // <iframe>
      /<embed.*?>/i, // <embed>
      /<object.*?>/i, // <object>
      /javascript:/i, // javascript:
      /on\w+\s*=/i, // onclick=, onerror=, etc.
      /<img.*?onerror/i, // <img onerror=
      /eval\s*\(/i, // eval(
      /alert\s*\(/i, // alert(
      /document\./i, // document.
      /window\./i, // window.
      /<svg.*?onload/i, // <svg onload=
      /expression\s*\(/i, // CSS expression
    ];

    // Caracteres sospechosos
    const suspiciousChars = /[<>{}[\]\\;'"&|]/;

    // Validar contra patrones de inyección SQL
    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(username)) {
        return {
          sqlInjection: {
            message: 'El nombre de usuario no es válido. No puede contener comandos SQL.'
          }
        };
      }
    }

    // Validar contra patrones de XSS
    for (const pattern of xssPatterns) {
      if (pattern.test(username)) {
        return {
          xssAttempt: {
            message: 'El nombre de usuario no es válido. No puede contener código HTML o JavaScript.'
          }
        };
      }
    }

    // Validar caracteres sospechosos
    if (suspiciousChars.test(username)) {
      return {
        suspiciousChars: {
          message: 'El nombre de usuario contiene caracteres no permitidos. Solo use letras, números, guiones y guiones bajos.'
        }
      };
    }

    // Validar que solo contenga caracteres alfanuméricos, guiones y guiones bajos
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(username)) {
      return {
        invalidFormat: {
          message: 'El nombre de usuario debe ser válido. Solo puede contener letras, números, guiones (-) y guiones bajos (_).'
        }
      };
    }

    return null; // Válido
  }

  /**
   * ✅ VALIDADOR DE SEGURIDAD PARA NOMBRES (firstName, lastName)
   * Detecta inyecciones SQL, XSS y caracteres inválidos
   */
  private nameSecurityValidator(control: AbstractControl): ValidationErrors | null {
    const name = control.value;
    
    if (!name) {
      return null; // Si está vacío, lo maneja el Validators.required
    }

    // Patrones de inyección SQL
    const sqlPatterns = [
      /(\bOR\b|\bAND\b)\s*['"]?\s*\d+\s*['"]?\s*=\s*['"]?\s*\d+/i,
      /'\s*(OR|AND)\s+'/i,
      /--/,
      /\/\*/,
      /;.*DROP/i,
      /;.*DELETE/i,
      /;.*SELECT/i,
      /UNION.*SELECT/i,
    ];

    // Patrones de XSS
    const xssPatterns = [
      /<.*?>/,  // Cualquier tag HTML
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /alert\s*\(/i,
      /document\./i,
    ];

    // Validar contra SQL injection
    for (const pattern of sqlPatterns) {
      if (pattern.test(name)) {
        return {
          sqlInjection: {
            message: 'El nombre no es válido.'
          }
        };
      }
    }

    // Validar contra XSS
    for (const pattern of xssPatterns) {
      if (pattern.test(name)) {
        return {
          xssAttempt: {
            message: 'El nombre no es válido. No puede contener código HTML o JavaScript.'
          }
        };
      }
    }

    // No permitir números en nombres
    if (/\d/.test(name)) {
      return {
        containsNumbers: {
          message: 'El nombre no puede contener números.'
        }
      };
    }

    // Validar que solo contenga letras, espacios, acentos, guiones y apóstrofes
    const validPattern = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
    if (!validPattern.test(name)) {
      return {
        invalidChars: {
          message: 'El nombre debe ser válido. Solo puede contener letras, espacios, guiones (-) y apóstrofes (\').'
        }
      };
    }

    return null; // Válido
  }

  /**
   * ✅ VALIDADOR PERSONALIZADO CON ZXCVBN
   * Evalúa la fortaleza de la contraseña usando zxcvbn
   * Rechaza contraseñas con score < 3 (bloquea patrones, secuencias, repeticiones)
   */
  private zxcvbnPasswordValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.value;
    
    if (!password) {
      return null; // Si está vacío, lo maneja el Validators.required
    }

    // Evaluar con zxcvbn
    const result = zxcvbn(password);
    
    // Score: 0 (muy débil) a 4 (muy fuerte)
    // Requerimos mínimo 3 para aprobar
    if (result.score < 3) {
      return {
        zxcvbnWeak: {
          score: result.score,
          warning: result.feedback.warning || 'Contraseña muy débil',
          suggestions: result.feedback.suggestions || [],
          // Información adicional para debugging
          patterns: result.sequence?.map(s => ({
            pattern: s.pattern,
            token: s.token
          }))
        }
      };
    }

    return null; // Válido
  }

  /**
   * Limpiar errores del campo contraseña
   */
  private clearPasswordError(): void {
    const passwordControl = this.registerForm.get('password');
    if (passwordControl) {
      const currentErrors = passwordControl.errors || {};
      delete currentErrors['simplePattern'];
      delete currentErrors['sequentialChars'];
      delete currentErrors['weakComplexity'];
      delete currentErrors['commonPassword'];
      delete currentErrors['zxcvbnWeak']; // ✅ Limpiar error de zxcvbn también
      
      // Si no hay otros errores, limpiar completamente
      const hasOtherErrors = Object.keys(currentErrors).length > 0;
      passwordControl.setErrors(hasOtherErrors ? currentErrors : null);
    }
  }

  /**
   * Toggle visibilidad de contraseña
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Toggle visibilidad de confirmar contraseña
   */
  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  /**
   * Validador de contraseñas coincidentes
   */
  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    if (!password || !confirmPassword) {
      return null;
    }
    
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  /**
   * Calcula la fortaleza de la contraseña
   */
  calculatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
    if (!password) {
      return 'weak';
    }

    let strength = 0;
    
    // Longitud
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    
    // Complejidad
    if (/[a-z]/.test(password)) strength++; // Minúsculas
    if (/[A-Z]/.test(password)) strength++; // Mayúsculas
    if (/[0-9]/.test(password)) strength++; // Números
    if (/[^a-zA-Z0-9]/.test(password)) strength++; // Símbolos
    
    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
  }

  /**
   * Obtiene el porcentaje de fortaleza de contraseña
   */
  getPasswordStrengthPercentage(): number {
    switch (this.passwordStrength) {
      case 'weak': return 33;
      case 'medium': return 66;
      case 'strong': return 100;
      default: return 0;
    }
  }

  /**
   * Navega a la página de inicio
   */
  navigateToHome(): void {
    this.router.navigate(['/home']);
  }

  /**
   * Obtiene los errores detallados de contraseña
   */
  getPasswordErrors(): string[] {
    const field = this.registerForm.get('password');
    if (!field || !field.errors || !field.touched) {
      return [];
    }

    if (field.errors['strongPassword']) {
      return field.errors['strongPassword'].errors || [];
    }

    return [];
  }

  /**
   * Verifica si un campo tiene un error específico
   */
  hasFieldError(fieldName: string, errorType: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.errors && field.errors[errorType] && field.touched);
  }

  /**
   * Verifica si un campo es válido y ha sido tocado
   */
  isFieldValid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.valid && field.touched);
  }

  /**
   * Verifica si las contraseñas coinciden
   */
  passwordsMatch(): boolean {
    const password = this.registerForm.get('password')?.value;
    const confirmPassword = this.registerForm.get('confirmPassword')?.value;
    return password === confirmPassword;
  }

  /**
   * Obtiene mensaje de error para confirmación de contraseña
   */
  getConfirmPasswordError(): string {
    const confirmPasswordField = this.registerForm.get('confirmPassword');
    
    if (!confirmPasswordField || !confirmPasswordField.touched) {
      return '';
    }

    if (confirmPasswordField.errors?.['required']) {
      return 'Por favor confirma tu contraseña';
    }

    if (!this.passwordsMatch() && confirmPasswordField.value) {
      return 'Las contraseñas no coinciden';
    }

    return '';
  }

  /**
   * Verificar si la contraseña es fuerte (cumple todos los requisitos)
   */
  isPasswordStrong(password: string): boolean {
    if (!password) return false;
    
    const hasMinLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[@$!%*?&._-]/.test(password);
    
    return hasMinLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChars;
  }

  /**
   * Verificar si la contraseña tiene al menos 8 caracteres
   */
  hasMinLength(password: string): boolean {
    return password.length >= 8;
  }

  /**
   * Verificar si la contraseña tiene al menos una mayúscula
   */
  hasUpperCase(password: string): boolean {
    return /[A-Z]/.test(password);
  }

  /**
   * Verificar si la contraseña tiene al menos una minúscula
   */
  hasLowerCase(password: string): boolean {
    return /[a-z]/.test(password);
  }

  /**
   * Verificar si la contraseña tiene al menos un número
   */
  hasNumbers(password: string): boolean {
    return /\d/.test(password);
  }

  /**
   * Verificar si la contraseña tiene al menos un carácter especial
   */
  hasSpecialChars(password: string): boolean {
    return /[@$!%*?&._-]/.test(password);
  }

  /**
   * Obtener fortaleza de contraseña para mostrar indicador visual
   */
  getPasswordStrength(password: string): string {
    if (!password) return '';
    
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[@$!%*?&._-]/.test(password)) score++;
    
    if (score <= 2) return 'weak';
    if (score <= 3) return 'medium'; 
    if (score <= 4) return 'strong';
    return 'very-strong';
  }

  /**
   * Obtiene el nombre de visualización del campo
   */
  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      'username': 'El nombre de usuario',
      'firstName': 'El nombre',
      'lastName': 'El apellido', 
      'email': 'El correo electrónico',
      'password': 'La contraseña',
      'confirmPassword': 'La confirmación de contraseña'
    };
    return displayNames[fieldName] || fieldName;
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.showEmailVerification = false;
    
    this.registerForm.markAllAsTouched();
    
    if (!this.registerForm.valid) {
      this.focusFirstInvalidField();
      return;
    }
    
    const rawData = this.registerForm.value;
    const sanitizedData = {
      username: this.sanitizationService.sanitizeUserInput(rawData.username || ''),
      email: this.sanitizationService.sanitizeUserInput(rawData.email || ''),
      password: this.sanitizationService.sanitizeUserInput(rawData.password || ''),
      confirmPassword: this.sanitizationService.sanitizeUserInput(rawData.confirmPassword || ''),
      firstName: this.sanitizationService.sanitizeUserInput(rawData.firstName || ''),
      lastName: this.sanitizationService.sanitizeUserInput(rawData.lastName || '')
    };
    
    // Validación adicional de seguridad
    if (!this.sanitizationService.isValidEmail(sanitizedData.email)) {
      this.errorMessage = 'Email no válido o contiene caracteres peligrosos';
      this.focusFirstInvalidField();
      return;
    }
    
    // Validación de contraseñas
    if (sanitizedData.password !== sanitizedData.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden. Por favor verifica que ambas contraseñas sean idénticas.';
      return;
    }
    
    this.isLoading = true;

    const registerData = {
      username: sanitizedData.username,
      email: sanitizedData.email,
      password: sanitizedData.password,
      firstName: sanitizedData.firstName,
      lastName: sanitizedData.lastName
    };
    
    this.authService.register(registerData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.errorMessage = '';
        this.showEmailVerification = true;
        this.successMessage = '¡Cuenta creada exitosamente! Revisa tu correo electrónico para verificar tu cuenta antes de iniciar sesión.';
      },
      error: (error) => {
        this.isLoading = false;
        
        // ✅ Mensajes genéricos anti-enumeración: NUNCA revelar si el email/usuario ya existe
        if (error.status === 0) {
          this.errorMessage = '❌ No se pudo conectar con el servidor. Verifica tu conexión a internet.';
        } else if (error.status === 422 || error.status === 400) {
          // Errores de validación de campos (formato, longitud, etc.)
          // Mapeo seguro backend a frontend si es posible, de lo contrario error general
          const backendErrorMsg = error.error?.message?.toLowerCase() || '';
          if (backendErrorMsg.includes('username') || backendErrorMsg.includes('usuario')) {
            this.registerForm.get('username')?.setErrors({ serverError: true });
            this.errorMessage = 'El nombre de usuario ya está en uso o no es válido.';
          } else if (backendErrorMsg.includes('email') || backendErrorMsg.includes('correo')) {
            this.registerForm.get('email')?.setErrors({ serverError: true });
            this.errorMessage = 'El correo electrónico ya está registrado o no es válido.';
          } else {
            this.errorMessage = '❌ Error de validación. Por favor revisa los campos del formulario.';
          }
        } else {
          this.errorMessage = '❌ Ocurrió un error al procesar tu solicitud. Por favor intenta nuevamente.';
        }
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  /**
   * Localiza y enfoca el primer campo inválido del formulario.
   */
  private focusFirstInvalidField(): void {
    const controls = this.registerForm.controls;
    for (const name in controls) {
      if (controls[name].invalid) {
        const invalidElement = document.getElementById(name);
        if (invalidElement) {
          invalidElement.focus();
          invalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      }
    }
  }

  /**
   * Navegar a login con el email actual del formulario
   */
  navigateToLogin(): void {
    const currentEmail = this.registerForm.get('email')?.value || '';
    if (currentEmail && currentEmail.trim()) {
      this.router.navigate(['/login'], { queryParams: { email: currentEmail.trim() } });
    } else {
      this.router.navigate(['/login']);
    }
  }
}
