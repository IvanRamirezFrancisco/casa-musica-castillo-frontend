import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl, ValidatorFn, ValidationErrors } from '@angular/forms';

export function optionalPhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value || '').trim();
    if (!value) return null;
    return /^\d{10}$/.test(value) ? null : { invalidPhone: true };
  };
}
import { Subscription, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, take } from 'rxjs/operators';
import { CartService, BackendCartItem } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { CartValidationResponse, CartValidationError } from '../../models/cart.model';
import { CheckoutRequest, PaymentMethodType, PricePreviewResponse, PricePreviewRequest } from '../../models/order.model';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit, OnDestroy {

  checkoutForm!: FormGroup;

  cartItems: BackendCartItem[] = [];
  cartSubtotal = 0;
  cartTax = 0;
  cartDiscount = 0;
  cartTotal = 0;
  unavailableItemsTotal = 0;
  isCheckingOut = false;
  canCheckout = false;
  warningMessage: string | null = null;

  isValidating = false;
  isSubmitting = false;
  submitted = false;
  validationErrors: string[] = [];
  generalError = '';
  userDataLoadStatus: 'NONE' | 'PARTIAL' | 'COMPLETE' = 'NONE';

  pricePreviewResult: PricePreviewResponse | null = null;
  isLoadingPreview = false;
  private previewSubject = new Subject<PricePreviewRequest>();

  private subs: Subscription[] = [];

  readonly paymentMethods: { value: PaymentMethodType; label: string; icon: string; description: string; badges?: string[] }[] = [
    {
      value: 'BANK_TRANSFER',
      label: 'Transferencia bancaria',
      icon: 'account_balance',
      description: 'Recibirás los datos bancarios después de generar tu pedido. Tu pedido quedará pendiente hasta confirmar el pago.',
      badges: ['Comprobante requerido', 'Revisión manual']
    },
    {
      value: 'MERCADO_PAGO',
      label: 'Mercado Pago',
      icon: 'shield',
      description: 'Paga de forma segura con tarjeta, saldo o medios disponibles en Mercado Pago.',
      badges: ['Checkout Pro', 'Pago protegido', 'Redirección segura']
    }
  ];

  constructor(
    private fb: FormBuilder,
    private cartService: CartService,
    private orderService: OrderService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.setupPricePreview();
    this.subscribeToCart();
    this.loadUserData();
    this.cartService.loadCart().subscribe({
      error: () => {
        this.generalError = 'No pudimos cargar tu carrito. Verifica tu conexión.';
      }
    });
  }

  hasAvailableUserData = false;

  loadUserData(force: boolean = false): void {
    this.authService.user$.pipe(take(1)).subscribe(user => {
      if (user && (user.firstName || user.lastName || user.phone)) {
        this.hasAvailableUserData = true;
        const shipping = this.checkoutForm.get('shippingAddress');
        if (shipping) {
          let hasName = false;
          let hasLastName = false;
          let hasPhone = false;

          const fNameCtrl = shipping.get('firstName');
          if (user.firstName && fNameCtrl && (force || (!fNameCtrl.dirty && !fNameCtrl.value))) {
            fNameCtrl.setValue(user.firstName);
          }
          if (fNameCtrl?.value) hasName = true;

          const lNameCtrl = shipping.get('lastName');
          if (user.lastName && lNameCtrl && (force || (!lNameCtrl.dirty && !lNameCtrl.value))) {
            lNameCtrl.setValue(user.lastName);
          }
          if (lNameCtrl?.value) hasLastName = true;

          const phoneCtrl = shipping.get('phone');
          if (user.phone && phoneCtrl && (force || (!phoneCtrl.dirty && !phoneCtrl.value))) {
            const cleanPhone = user.phone.replace(/\D/g, '');
            if (cleanPhone) {
              phoneCtrl.setValue(cleanPhone.substring(0, 10));
            }
          }
          if (phoneCtrl?.value && phoneCtrl.value.length === 10) hasPhone = true;

          if (hasName && hasLastName && hasPhone) {
            this.userDataLoadStatus = 'COMPLETE';
          } else if (hasName || hasLastName || hasPhone) {
            this.userDataLoadStatus = 'PARTIAL';
          } else {
            this.userDataLoadStatus = 'NONE';
          }
        }
      } else {
        this.hasAvailableUserData = false;
        this.userDataLoadStatus = 'NONE';
      }
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private buildForm(): void {
    this.checkoutForm = this.fb.group({
      deliveryOption: ['LOCAL_DELIVERY', Validators.required],
      shippingAddress: this.fb.group({
        firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), Validators.pattern(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]{2,}$/)]],
        lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), Validators.pattern(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]{2,}$/)]],
        phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
        street: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
        exteriorNumber: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(20)]],
        interiorNumber: ['', [Validators.maxLength(20)]],
        neighborhood: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
        city: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), Validators.pattern(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]+$/)]],
        state: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100), Validators.pattern(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/)]],
        zipCode: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
        references: ['', [Validators.maxLength(250)]]
      }),
      authorizedPersons: this.fb.array([]),
      requireInvoice: [false],
      billingAddress: this.fb.group({
        rfc: ['', [Validators.minLength(12), Validators.maxLength(13), Validators.pattern(/^[A-Z0-9&]{12,13}$/)]],
        businessName: ['', [Validators.maxLength(200)]],
        fiscalZipCode: ['', [Validators.pattern(/^\d{5}$/)]],
        invoiceEmail: ['', [Validators.email, Validators.maxLength(100)]]
      }),
      paymentMethod: ['BANK_TRANSFER', Validators.required],
      notes: ['', Validators.maxLength(500)]
    });

    // Validar campos de facturación solo si se requiere factura
    this.checkoutForm.get('requireInvoice')!.valueChanges.subscribe(required => {
      const billingGroup = this.checkoutForm.get('billingAddress') as FormGroup;
      if (required) {
        billingGroup.get('rfc')!.setValidators([Validators.required, Validators.minLength(12), Validators.maxLength(13), Validators.pattern(/^[A-Z0-9&]{12,13}$/)]);
        billingGroup.get('businessName')!.setValidators([Validators.required, Validators.maxLength(200)]);
        billingGroup.get('fiscalZipCode')!.setValidators([Validators.required, Validators.pattern(/^\d{5}$/)]);
        billingGroup.get('invoiceEmail')!.setValidators([Validators.required, Validators.email, Validators.maxLength(100)]);
      } else {
        billingGroup.get('rfc')!.clearValidators();
        billingGroup.get('businessName')!.clearValidators();
        billingGroup.get('fiscalZipCode')!.clearValidators();
        billingGroup.get('invoiceEmail')!.clearValidators();
      }
      billingGroup.get('rfc')!.updateValueAndValidity();
      billingGroup.get('businessName')!.updateValueAndValidity();
      billingGroup.get('fiscalZipCode')!.updateValueAndValidity();
    });

    // Dynamic validation for delivery options
    this.checkoutForm.get('deliveryOption')!.valueChanges.subscribe(option => {
      this.triggerPricePreview();
      const shippingGroup = this.checkoutForm.get('shippingAddress') as FormGroup;
      
      if (option === 'PICKUP_STORE') {
        shippingGroup.disable();
        Object.keys(shippingGroup.controls).forEach(key => {
          shippingGroup.get(key)!.clearValidators();
          shippingGroup.get(key)!.setErrors(null);
        });
        shippingGroup.updateValueAndValidity({ emitEvent: false });
        
        if (this.authorizedPersons.length === 0) {
          this.addAuthorizedPerson(); // Add at least one person
        }
      } else {
        shippingGroup.enable();
        shippingGroup.get('firstName')!.setValidators([Validators.required, Validators.minLength(2), Validators.maxLength(100), Validators.pattern(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]{2,}$/)]);
        shippingGroup.get('lastName')!.setValidators([Validators.required, Validators.minLength(2), Validators.maxLength(100), Validators.pattern(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]{2,}$/)]);
        shippingGroup.get('phone')!.setValidators([Validators.required, Validators.pattern(/^\d{10}$/)]);
        shippingGroup.get('street')!.setValidators([Validators.required, Validators.minLength(3), Validators.maxLength(200)]);
        shippingGroup.get('exteriorNumber')!.setValidators([Validators.required, Validators.minLength(1), Validators.maxLength(20)]);
        shippingGroup.get('interiorNumber')!.setValidators([Validators.maxLength(20)]);
        shippingGroup.get('neighborhood')!.setValidators([Validators.required, Validators.minLength(3), Validators.maxLength(100)]);
        shippingGroup.get('city')!.setValidators([Validators.required, Validators.minLength(2), Validators.maxLength(100), Validators.pattern(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]+$/)]);
        shippingGroup.get('state')!.setValidators([Validators.required, Validators.minLength(2), Validators.maxLength(100), Validators.pattern(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/)]);
        shippingGroup.get('zipCode')!.setValidators([Validators.required, Validators.pattern(/^\d{5}$/)]);
        shippingGroup.get('references')!.setValidators([Validators.maxLength(250)]);
        
        Object.keys(shippingGroup.controls).forEach(key => {
          shippingGroup.get(key)!.updateValueAndValidity({ emitEvent: false });
        });
        shippingGroup.updateValueAndValidity({ emitEvent: false });
      }
    });

    const triggerFields = ['state', 'city', 'zipCode'];
    triggerFields.forEach(field => {
      this.checkoutForm.get(`shippingAddress.${field}`)!.valueChanges.subscribe(() => {
        this.triggerPricePreview();
      });
    });
  }

  get authorizedPersons() {
    return this.checkoutForm.get('authorizedPersons') as FormArray;
  }

  addAuthorizedPerson() {
    if (this.authorizedPersons.length < 3) {
      this.authorizedPersons.push(this.fb.group({
        fullName: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(80), Validators.pattern(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/)]],
        phone: ['', [optionalPhoneValidator()]],
        relationship: ['', [Validators.maxLength(50), Validators.pattern(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]*$/)]],
        isPrimary: [this.authorizedPersons.length === 0]
      }));
    }
  }

  onAuthorizedPhoneInput(index: number): void {
    const control = this.authorizedPersons.at(index).get('phone');
    if (control) {
      const sanitized = (control.value || '').replace(/\D/g, '').slice(0, 10);
      control.setValue(sanitized, { emitEvent: false });
    }
  }

  removeAuthorizedPerson(index: number) {
    if (this.authorizedPersons.length > 1) {
      this.authorizedPersons.removeAt(index);
      // Ensure there's always one primary if it was removed
      if (index === 0 && this.authorizedPersons.length > 0) {
        this.authorizedPersons.at(0).get('isPrimary')?.setValue(true);
      }
    }
  }

  fillWithMyData(index: number) {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        let fullName = '';
        if (user.firstName) fullName += user.firstName;
        if (user.lastName) fullName += ' ' + user.lastName;
        fullName = fullName.trim();
        
        if (fullName) {
          // Check if this name is already in the array
          const persons = this.authorizedPersons.value || [];
          const normalizedNew = fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
          
          for (let i = 0; i < persons.length; i++) {
            if (i !== index && persons[i].fullName) {
              const existing = persons[i].fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
              if (existing === normalizedNew) {
                Swal.fire({
                  icon: 'warning',
                  title: 'Nombre duplicado',
                  text: 'Ya te has agregado como persona autorizada.',
                  confirmButtonColor: '#722f37'
                });
                return;
              }
            }
          }

          this.authorizedPersons.at(index).patchValue({
            fullName: fullName,
            relationship: 'Titular'
          });
        }
      } catch (e) {}
    }
  }

  private setupPricePreview(): void {
    this.subs.push(
      this.previewSubject.pipe(
        debounceTime(500),
        switchMap(request => {
          this.isLoadingPreview = true;
          return this.orderService.pricePreview(request).pipe(
            catchError(err => {
              this.isLoadingPreview = false;
              // Clear preview if error
              this.pricePreviewResult = null;
              return of(null);
            })
          );
        })
      ).subscribe(result => {
        this.isLoadingPreview = false;
        if (result) {
          this.pricePreviewResult = result;
        }
      })
    );
  }

  triggerPricePreview(): void {
    const deliveryOption = this.checkoutForm.get('deliveryOption')?.value;
    const s = this.checkoutForm.get('shippingAddress')?.value;
    
    // Only send state/city/zipCode if they have *some* value, we let backend validate if it's enough.
    const req: PricePreviewRequest = {
      deliveryOption,
      state: s.state,
      city: s.city,
      postalCode: s.zipCode
    };
    this.previewSubject.next(req);
  }

  private subscribeToCart(): void {
    this.subs.push(
      this.cartService.cartItems$.subscribe(items => {
        this.cartItems = items;
        // Trigger price preview on cart changes to get updated totals
        this.triggerPricePreview();
        this.unavailableItemsTotal = this.cartService.getUnavailableItemsTotal();
      }),
      this.cartService.canCheckout$.subscribe(val => this.canCheckout = val),
      this.cartService.warningMessage$.subscribe(msg => this.warningMessage = msg)
    );
  }

  isRequireInvoice(): boolean {
    return !!this.checkoutForm.get('requireInvoice')!.value;
  }

  selectPaymentMethod(method: PaymentMethodType): void {
    this.checkoutForm.get('paymentMethod')!.setValue(method);
  }

  isFieldInvalid(fieldPath: string): boolean {
    const ctrl = this.checkoutForm.get(fieldPath);
    return !!(ctrl && ctrl.invalid && (this.submitted || ctrl.dirty || ctrl.touched));
  }

  sanitizeNumericField(fieldPath: string, maxLength: number): void {
    const ctrl = this.checkoutForm.get(fieldPath);
    if (!ctrl || ctrl.value == null) return;
    
    let val = ctrl.value.toString();
    let sanitized = val.replace(/\D/g, '');
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    if (val !== sanitized) {
      ctrl.setValue(sanitized, { emitEvent: false });
    }
  }

  sanitizeRfcField(): void {
    const ctrl = this.checkoutForm.get('billingAddress.rfc');
    if (!ctrl || ctrl.value == null) return;
    
    let val = ctrl.value.toString();
    let sanitized = val.toUpperCase().replace(/\s/g, '');
    if (sanitized.length > 13) {
      sanitized = sanitized.substring(0, 13);
    }
    if (val !== sanitized) {
      ctrl.setValue(sanitized, { emitEvent: false });
    }
  }

  get isProcessing(): boolean {
    return this.isSubmitting || this.isValidating || this.isProcessingPayment;
  }

  onSubmit(): void {
    if (this.isSubmitting) return;
    this.generalError = '';
    this.validationErrors = [];

    if (!this.canCheckout) {
      Swal.fire({
        icon: 'warning',
        title: 'Carrito no válido',
        text: 'Tu carrito contiene productos no disponibles. Elimínalos o muévelos a tu lista de deseos antes de continuar.',
        confirmButtonColor: '#722f37'
      });
      return;
    }

    if (this.cartItems.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Carrito vacío',
        text: 'Tu carrito está vacío. Agrega productos antes de hacer tu pedido.',
        confirmButtonColor: '#722f37'
      });
      return;
    }

    if (this.pricePreviewResult && this.pricePreviewResult.canProceedToPayment === false) {
      return;
    }

    this.submitted = true;
    this.checkoutForm.markAllAsTouched();

    // Validar duplicados en pickup y cantidad
    let hasPickupErrors = false;
    let firstPickupErrorMsg = '';
    
    if (this.checkoutForm.get('deliveryOption')?.value === 'PICKUP_STORE') {
      const persons = this.authorizedPersons.value || [];
      if (persons.length === 0) {
        hasPickupErrors = true;
        firstPickupErrorMsg = 'Debes registrar al menos una persona autorizada.';
      } else {
        const normalizedNames = new Set<string>();
        for (let i = 0; i < persons.length; i++) {
          const person = persons[i];
          const name = person.fullName;
          
          if (this.authorizedPersons.at(i).invalid && !hasPickupErrors) {
            hasPickupErrors = true;
            if (this.authorizedPersons.at(i).get('fullName')?.invalid) {
               firstPickupErrorMsg = `Persona ${i + 1}: Ingresa un nombre válido de al menos 5 letras (nombre y apellido).`;
            } else if (this.authorizedPersons.at(i).get('phone')?.invalid) {
               firstPickupErrorMsg = `Persona ${i + 1}: El teléfono debe tener exactamente 10 dígitos.`;
            } else if (this.authorizedPersons.at(i).get('relationship')?.invalid) {
               firstPickupErrorMsg = `Persona ${i + 1}: La referencia es muy larga o contiene números.`;
            }
          }

          if (name && name.trim().length > 0) {
            const normalized = name.trim().toLowerCase()
                                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                                .replace(/\s+/g, ' ');
            if (normalizedNames.has(normalized)) {
              this.authorizedPersons.at(i).get('fullName')?.setErrors({ duplicatePerson: true });
              if (!hasPickupErrors) {
                hasPickupErrors = true;
                firstPickupErrorMsg = `Persona ${i + 1}: Esta persona ya está autorizada.`;
              }
            } else {
              normalizedNames.add(normalized);
            }
          }
        }
      }
    }

    if (this.checkoutForm.invalid || hasPickupErrors) {
      if (hasPickupErrors) {
        Swal.fire({
          icon: 'warning',
          title: 'Revisa las personas autorizadas',
          text: `Hay datos incompletos o inválidos. ${firstPickupErrorMsg} Corrige los campos marcados para continuar.`,
          confirmButtonColor: '#722f37'
        });
        setTimeout(() => {
          const authSection = document.querySelector('.authorized-person-card, .ng-invalid');
          if (authSection) {
            authSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
        return;
      }
      
      setTimeout(() => {
        const firstError = document.querySelector('.input-error, .ng-invalid');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }

    // Validar carrito en tiempo real antes de crear la orden
    this.isValidating = true;
    this.cartService.validateCart().subscribe({
      next: (validation: CartValidationResponse) => {
        this.isValidating = false;
        // canCheckout si no hay errores de tipo ERROR
        const hasErrors = validation.errors?.some(e => e.severity === 'ERROR') ?? !validation.valid;
        if (hasErrors || !validation.valid) {
          this.validationErrors = (validation.errors ?? []).map((e: CartValidationError) => e.message);
          if (validation.warnings?.length) {
            this.validationErrors.push(
              `${validation.warnings.length} producto(s) con advertencias de disponibilidad.`
            );
          }
          Swal.fire({
            icon: 'error',
            title: 'Tu carrito cambió',
            text: 'Algunos productos ya no tienen stock. Por favor revisa tu carrito.',
            confirmButtonColor: '#722f37'
          });
          return;
        }
        this.submitOrder();
      },
      error: () => {
        this.isValidating = false;
        this.generalError = 'No pudimos validar tu carrito. Inténtalo de nuevo.';
      }
    });
  }

  private submitOrder(): void {
    const formValue = this.checkoutForm.value;
    const rawFormValue = this.checkoutForm.getRawValue();
    const deliveryOption = formValue.deliveryOption;
    
    // Construir string de envío
    const s = rawFormValue.shippingAddress;
    let shippingString = '';
    
    if (deliveryOption === 'PICKUP_STORE') {
      shippingString = 'Recoger en tienda';
    } else {
      const interiorStr = s.interiorNumber ? ` Int. ${s.interiorNumber}` : '';
      const refStr = s.references ? ` (Ref: ${s.references})` : '';
      shippingString = `${s.firstName} ${s.lastName}, Tel: ${s.phone}\n${s.street} ${s.exteriorNumber}${interiorStr}\nCol. ${s.neighborhood}, ${s.city}, ${s.state}, CP: ${s.zipCode}${refStr}`.trim();
    }

    // Construir string de facturación
    let billingString = shippingString;
    if (formValue.requireInvoice) {
      const b = formValue.billingAddress;
      billingString = `FACTURAR A:\nRFC: ${b.rfc}\nRazón Social: ${b.businessName}\nCP Fiscal: ${b.fiscalZipCode}\nEmail Factura: ${b.invoiceEmail}`;
    }

    const request: CheckoutRequest = {
      deliveryOption,
      state: s?.state,
      city: s?.city,
      postalCode: s?.zipCode,
      shippingAddress: shippingString,
      billingAddress: billingString,
      paymentMethod: formValue.paymentMethod as PaymentMethodType,
      notes: formValue.notes ? (formValue.notes as string).trim() : undefined,
      authorizedPersons: deliveryOption === 'PICKUP_STORE' ? formValue.authorizedPersons : []
    };

    this.isSubmitting = true;
    this.orderService.createOrder(request).subscribe({
      next: (order) => {
        if (request.paymentMethod === 'MERCADO_PAGO') {
          this.processMercadoPago(order.id);
        } else {
          this.isSubmitting = false;
          this.router.navigate(['/orders/my', order.id]);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        const status = err?.status;
        if (status === 400) {
          if (err?.error?.error === 'INVALID_PICKUP_AUTHORIZATIONS') {
            const details = (err?.error?.details || []).join('\n');
            Swal.fire({
              icon: 'error',
              title: err?.error?.message || 'Error en recolección',
              text: details,
              confirmButtonColor: '#722f37'
            });
            this.generalError = 'Revisa la sección de personas autorizadas.';
          } else {
            this.generalError = err?.error?.message ?? err?.error?.error ?? 'Datos del formulario no válidos. Revisa tu información.';
          }
        } else if (status === 401) {
          this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
        } else if (status === 409) {
          this.generalError = 'No se pudo crear el pedido. Algunos productos ya no tienen stock. Revisa tu carrito.';
          this.cartService.loadCart().subscribe();
        } else {
          this.generalError = 'Error al crear el pedido. No perderás los datos del formulario. Inténtalo de nuevo.';
        }
      }
    });
  }

  isProcessingPayment = false;

  private processMercadoPago(orderId: number): void {
    this.isProcessingPayment = true;
    this.orderService.createPayment(orderId, { provider: 'MERCADO_PAGO' }).subscribe({
      next: (response) => {
        if (response.checkoutUrl) {
          window.location.href = response.checkoutUrl;
        } else {
          this.handleMpError('URL no generada', orderId);
        }
      },
      error: (err) => {
        this.handleMpError(err, orderId);
      }
    });
  }

  private handleMpError(err: any, orderId: number): void {
    this.isProcessingPayment = false;
    this.isSubmitting = false;
    let errorMsg = 'No pudimos iniciar Mercado Pago. Intenta nuevamente más tarde.';
    const status = err?.status;

    if (status === 400) {
      errorMsg = 'Mercado Pago no está disponible o la solicitud no es válida.';
    } else if (status === 401) {
      errorMsg = 'Tu sesión expiró. Inicia sesión nuevamente.';
    } else if (status === 403) {
      errorMsg = 'No tienes permiso para pagar esta orden.';
    } else if (status === 404) {
      errorMsg = 'No se encontró la orden.';
    } else if (status === 409) {
      errorMsg = 'Ya existe un intento de pago activo o la orden ya fue pagada.';
    } else if (status === 0) {
      errorMsg = 'No se pudo conectar con el servidor.';
    }

    Swal.fire({
      icon: 'error',
      title: 'El pedido se creó, pero...',
      text: errorMsg + ' Puedes intentarlo nuevamente desde el detalle del pedido.',
      confirmButtonText: 'Ver pedido',
      confirmButtonColor: '#722f37',
      allowOutsideClick: false
    }).then(() => {
      this.router.navigate(['/orders/my', orderId]);
    });
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/https://res.cloudinary.com/dy3ibnjl7/image/upload/f_auto,q_auto,w_400/v1782840424/Dise%C3%B1o_sin_t%C3%ADtulo_4_xruh6t.png';
  }

  requestShippingQuote(): void {
    if (!this.pricePreviewResult?.contactWhatsapp) {
      return;
    }

    const formValue = this.checkoutForm.value;
    const s = formValue.shippingAddress;
    const items = this.cartItems.map(item => `- ${item.product.name} x ${item.quantity}`).join('\n');
    const subtotal = this.pricePreviewResult.subtotal ? this.pricePreviewResult.subtotal.toFixed(2) : '0.00';
    
    let addressStr = '';
    if (s.street) {
      addressStr = `${s.street} ${s.exteriorNumber || ''}, Col. ${s.neighborhood || ''}, ${s.city || ''}, ${s.state || ''}, CP: ${s.zipCode || ''}`.trim();
    }

    const clientName = (s.firstName && s.lastName) ? `${s.firstName} ${s.lastName}` : 'No proporcionado';
    const clientPhone = s.phone ? s.phone : 'No proporcionado';

    const message = `Hola, quiero cotizar el envío de mi pedido en Casa de Música Castillo.

Método: Envío foráneo
Subtotal: $${subtotal}

Productos:
${items}

Dirección:
${addressStr || 'Pendiente de capturar'}

Mi nombre:
${clientName}

Mi teléfono:
${clientPhone}

Quedo atento al costo de envío para continuar con mi compra.`;

    const encodedMessage = encodeURIComponent(message);
    const phone = this.pricePreviewResult.contactWhatsapp.replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.open(url, '_blank');
  }

  trackByItemId(_: number, item: BackendCartItem): number {
    return item.backendItemId;
  }

  getCheckoutBlockReasons(): string[] {
    const reasons: string[] = [];
    const option = this.checkoutForm.get('deliveryOption')?.value;

    if (!this.checkoutForm.get('paymentMethod')?.value) {
      reasons.push('Selecciona un método de pago.');
    }

    if (option === 'PICKUP_STORE') {
      const persons = this.authorizedPersons.value || [];
      if (persons.length === 0) {
        reasons.push('Falta al menos una persona autorizada.');
      } else {
        const normalizedNames = new Set<string>();
        for (let i = 0; i < persons.length; i++) {
          const personCtrl = this.authorizedPersons.at(i);
          const val = persons[i];
          const prefix = `Persona ${i + 1}:`;
          
          if (personCtrl.get('fullName')?.invalid) {
            reasons.push(`${prefix} escribe un nombre y apellido válidos (mínimo 5 letras).`);
          } else {
             const cleanName = (val.fullName || '').trim();
             const normalized = cleanName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
             if (normalizedNames.has(normalized)) {
               reasons.push(`${prefix} el nombre ya está registrado en otra persona autorizada.`);
             } else {
               normalizedNames.add(normalized);
             }
          }
          if (personCtrl.get('phone')?.invalid) {
            reasons.push(`${prefix} el teléfono debe tener exactamente 10 dígitos.`);
          }
          if (personCtrl.get('relationship')?.invalid) {
            reasons.push(`${prefix} la referencia no debe superar 50 caracteres y solo debe contener letras.`);
          }
        }
      }
    } else if (option === 'LOCAL_DELIVERY') {
      const shipping = this.checkoutForm.get('shippingAddress');
      if (shipping?.invalid) {
        reasons.push('Completa correctamente tu dirección de envío y datos de contacto.');
      }
    } else if (option === 'EXTERNAL_SHIPPING_QUOTE') {
      reasons.push('El envío requiere cotización. Solicítala por WhatsApp.');
    }

    if (this.checkoutForm.get('requireInvoice')?.value) {
      const billing = this.checkoutForm.get('billingAddress');
      if (billing?.invalid) {
        reasons.push('Completa los datos de facturación (RFC, Razón Social, etc.).');
      }
    }

    return reasons;
  }

  canSubmitCheckout(): boolean {
    const option = this.checkoutForm.get('deliveryOption')?.value;
    
    if (!this.checkoutForm.get('paymentMethod')?.value) return false;

    const billingValid = !this.checkoutForm.get('requireInvoice')?.value || (this.checkoutForm.get('billingAddress')?.valid === true);

    if (option === 'PICKUP_STORE') {
      let isPickupValid = this.authorizedPersons.length > 0;
      const normalizedNames = new Set<string>();
      
      for (let i = 0; i < this.authorizedPersons.length; i++) {
         if (this.authorizedPersons.at(i).invalid) {
           isPickupValid = false;
           break;
         }
         const cleanName = (this.authorizedPersons.at(i).get('fullName')?.value || '').trim();
         const normalized = cleanName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
         if (normalizedNames.has(normalized)) {
           isPickupValid = false;
           break;
         }
         normalizedNames.add(normalized);
      }
      return Boolean(isPickupValid && billingValid && this.pricePreviewResult?.canProceedToPayment === true);
    }

    if (option === 'LOCAL_DELIVERY') {
      return Boolean(this.checkoutForm.get('shippingAddress')?.valid === true && billingValid && this.pricePreviewResult?.canProceedToPayment === true);
    }

    if (option === 'EXTERNAL_SHIPPING_QUOTE') {
      return false; // Nunca permite confirmar, solo cotizar
    }

    return false;
  }
}
