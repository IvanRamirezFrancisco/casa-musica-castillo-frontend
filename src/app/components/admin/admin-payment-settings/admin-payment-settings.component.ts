import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { PaymentSettingsService, BankTransferSettingsRequest } from '../../../services/payment-settings.service';
import { ClabeUtils } from '../../../shared/utils/clabe.utils';
import { MexicanBank } from '../../../shared/catalogs/mexican-banks.catalog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-payment-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './admin-payment-settings.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./admin-payment-settings.component.css']
})
export class AdminPaymentSettingsComponent implements OnInit, OnDestroy {
  settingsForm: FormGroup;
  isLoading = false;
  isSaving = false;
  hasExistingConfig = false;
  
  detectedBank: MexicanBank | null = null;
  bankMismatchWarning = false;
  unidentifiedBankWarning = false;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private paymentSettingsService: PaymentSettingsService
  ) {
    this.settingsForm = this.fb.group({
      bankName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), Validators.pattern(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\.,\-&\(\)]+$/)]],
      accountHolder: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150), Validators.pattern(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\.,\-&\(\)]+$/)]],
      clabe: ['', [Validators.required, this.clabeValidator]],
      accountNumber: ['', [Validators.pattern('^[0-9]{6,30}$')]],
      referenceInstructions: ['', [Validators.maxLength(500)]],
      additionalInstructions: [''],
      active: [true]
    });
  }

  ngOnInit(): void {
    this.loadSettings();

    // Suscribirse a cambios en la CLABE para detectar banco
    this.settingsForm.get('clabe')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.onClabeChange(value);
      });

    // Suscribirse a cambios en bankName para detectar discrepancias
    this.settingsForm.get('bankName')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.checkBankMismatch(value);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  clabeValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const isValid = ClabeUtils.validateClabeChecksum(control.value);
    return isValid ? null : { invalidClabe: true };
  }

  loadSettings(): void {
    this.isLoading = true;
    this.paymentSettingsService.getBankTransferSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (settings) => {
          this.hasExistingConfig = true;
          this.settingsForm.patchValue({
            bankName: settings.bankName,
            accountHolder: settings.accountHolder,
            clabe: settings.clabe,
            accountNumber: settings.accountNumber,
            referenceInstructions: settings.referenceInstructions || 'Usa el número de pedido como concepto o motivo de pago. Si tu banco solicita una referencia numérica, puedes dejarla en blanco o usar los últimos dígitos del pedido si aplica.',
            additionalInstructions: settings.additionalInstructions,
            active: settings.active
          }, { emitEvent: true });
          this.isLoading = false;
        },
        error: (err) => {
          if (err?.status === 404) {
            this.hasExistingConfig = false;
            // Pre-cargar titular por defecto si no hay config
            this.settingsForm.patchValue({
              accountHolder: 'Casa de Música Castillo',
              referenceInstructions: 'Usa el número de pedido como concepto o motivo de pago. Si tu banco solicita una referencia numérica, puedes dejarla en blanco o usar los últimos dígitos del pedido si aplica.'
            }, { emitEvent: false });
          } else {
            console.error('Error loading settings', err);
            Swal.fire('Error', 'No se pudieron cargar los ajustes de pago', 'error');
          }
          this.isLoading = false;
        }
      });
  }

  onClabeChange(clabeInput: string): void {
    // Limpiar caracteres no numéricos
    const cleanClabe = ClabeUtils.sanitizeNumeric(clabeInput);
    
    if (cleanClabe !== clabeInput) {
      this.settingsForm.get('clabe')?.setValue(cleanClabe, { emitEvent: false });
    }

    if (cleanClabe.length >= 3) {
      this.detectedBank = ClabeUtils.detectBankFromClabe(cleanClabe);
      if (this.detectedBank) {
        this.unidentifiedBankWarning = false;
        
        // Si el usuario no ha ingresado banco, autollenar
        const currentBank = this.settingsForm.get('bankName')?.value;
        if (!currentBank || currentBank.trim() === '') {
          this.settingsForm.patchValue({ bankName: this.detectedBank.displayName });
        } else {
          this.checkBankMismatch(currentBank);
        }
      } else {
        // Tiene 3 o más dígitos pero no se encontró en catálogo
        this.detectedBank = null;
        if (cleanClabe.length === 18 && ClabeUtils.validateClabeChecksum(cleanClabe)) {
           this.unidentifiedBankWarning = true;
        } else {
           this.unidentifiedBankWarning = false;
        }
        this.bankMismatchWarning = false;
      }
    } else {
      this.detectedBank = null;
      this.unidentifiedBankWarning = false;
      this.bankMismatchWarning = false;
    }
  }

  checkBankMismatch(currentBankName: string): void {
    if (!this.detectedBank) {
      this.bankMismatchWarning = false;
      return;
    }
    
    // Comparar nombres ignorando mayúsculas/minúsculas y espacios extra
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/gi, '');
    const currentNorm = normalize(currentBankName);
    const detectedNorm = normalize(this.detectedBank.displayName);
    const shortNorm = this.detectedBank.shortName ? normalize(this.detectedBank.shortName) : '';

    if (currentNorm && !currentNorm.includes(detectedNorm) && !currentNorm.includes(shortNorm) && !detectedNorm.includes(currentNorm)) {
      this.bankMismatchWarning = true;
    } else {
      this.bankMismatchWarning = false;
    }
  }

  useDetectedBank(): void {
    if (this.detectedBank) {
      this.settingsForm.patchValue({ bankName: this.detectedBank.displayName });
      this.bankMismatchWarning = false;
    }
  }

  onAccountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^0-9]/g, '').substring(0, 30);
    if (input.value !== sanitized) {
      input.value = sanitized;
      this.settingsForm.get('accountNumber')?.setValue(sanitized, { emitEvent: false });
    }
  }

  formatClabeVisually(clabe: string): string {
    return ClabeUtils.formatClabe(clabe);
  }

  saveSettings(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    if (this.bankMismatchWarning) {
      Swal.fire({
        title: 'Posible discrepancia de Banco',
        html: `
          El banco ingresado (<strong>${this.settingsForm.value.bankName}</strong>) no coincide con el banco detectado por la CLABE (<strong>${this.detectedBank?.displayName}</strong>).<br><br>
          ¿Deseas guardar de todos modos?
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar así',
        cancelButtonText: 'Cancelar y revisar',
        confirmButtonColor: '#722f37',
        cancelButtonColor: '#6c757d',
      }).then((result: any) => {
        if (result.isConfirmed) {
          this.executeSave();
        }
      });
    } else {
      this.executeSave();
    }
  }

  private emptyToNull(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed.length ? trimmed : null;
  }

  private executeSave(): void {
    this.isSaving = true;
    const formValue = this.settingsForm.value;
    
    const request: BankTransferSettingsRequest = {
      bankName: formValue.bankName?.trim(),
      accountHolder: formValue.accountHolder?.trim(),
      clabe: ClabeUtils.sanitizeNumeric(formValue.clabe), // Solo dígitos
      accountNumber: this.emptyToNull(formValue.accountNumber),
      referenceInstructions: this.emptyToNull(formValue.referenceInstructions),
      additionalInstructions: this.emptyToNull(formValue.additionalInstructions),
      active: formValue.active
    };

    this.paymentSettingsService.updateBankTransferSettings(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.hasExistingConfig = true;
          this.isSaving = false;
          Swal.fire({
            icon: 'success',
            title: 'Configuración guardada',
            text: 'Los datos bancarios se han actualizado correctamente.',
            confirmButtonColor: '#722f37'
          });
        },
        error: (err) => {
          this.isSaving = false;
          console.error('Error saving settings', err);
          Swal.fire('Error', err?.error?.message || 'Error al guardar los ajustes', 'error');
        }
      });
  }

  // Helpers for validation
  isInvalid(controlName: string): boolean {
    const control = this.settingsForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
