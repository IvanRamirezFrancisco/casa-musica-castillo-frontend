import { Component, OnInit, OnDestroy, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { CustomerService } from '../../../services/customer.service';
import { CustomerUser, CustomerFilters } from '../../../models/customer.model';
import { PageResponse } from '../../../models/staff.model';
import { OrderService } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { Order } from '../../../models/order.model';
import { EMPTY } from 'rxjs';
import Swal from 'sweetalert2';

/** Toast de error reutilizable en toda la vista */
const ErrorToast = Swal.mixin({
  toast: true,
  position: 'top-end',
  icon: 'error',
  showConfirmButton: false,
  timer: 3500,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './admin-customers.component.html',
  styleUrls: ['./admin-customers.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  encapsulation: ViewEncapsulation.Emulated
})
export class AdminCustomersComponent implements OnInit, OnDestroy {

  Math = Math;
  private destroy$ = new Subject<void>();

  // ── Estado del listado ────────────────────────────────────────────────────
  private _customerList: CustomerUser[] = [];

  get customerList(): CustomerUser[] {
    return this._customerList;
  }

  set customerList(value: CustomerUser[]) {
    this._customerList = value ?? [];
  }

  loading = false;

  // ── Paginación ────────────────────────────────────────────────────────────
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  // ── Filtros ───────────────────────────────────────────────────────────────
  searchTerm = '';
  filterEnabled: boolean | null = null;
  filterLocked: boolean | null = null;

  // ── Modal de detalles ─────────────────────────────────────────────────────
  clienteSeleccionado: CustomerUser | null = null;

  /** Pedidos del cliente actualmente en el modal */
  pedidosDelCliente: Order[] = [];
  /** true mientras se cargan los pedidos del modal */
  loadingPedidos = false;

  abrirModalDetalles(cliente: CustomerUser): void {
    this.clienteSeleccionado = cliente;
    this.pedidosDelCliente   = [];
    this.loadingPedidos      = true;

    this.orderService.getOrdersByCustomer(cliente.id, 0, 5).pipe(
      takeUntil(this.destroy$),
      catchError((err) => {
        ErrorToast.fire({ title: err?.error?.message ?? 'No se pudieron cargar los pedidos.' });
        this.pedidosDelCliente = [];
        this.loadingPedidos    = false;
        return EMPTY;
      })
    ).subscribe({
      next: (page) => {
        this.pedidosDelCliente = page.content ?? [];
        this.loadingPedidos    = false;
      }
    });
  }

  constructor(
    private customerService: CustomerService,
    private orderService: OrderService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.loadCustomers();

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const action = params['action'];
      if (action === 'export') {
        this.exportToCsv();
        this.clearActionParam();
      }
      if (action === 'refresh') {
        this.loadCustomers();
        this.clearActionParam();
      }
    });
  }

  private clearActionParam(): void {
    this.router.navigate([], {
      queryParams: { action: null },
      queryParamsHandling: 'merge'
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  /**
   * Carga la lista de clientes aplicando los filtros activos.
   */
  loadCustomers(): void {
    this.loading = true;

    const filters: CustomerFilters = {
      search: this.searchTerm || undefined,
      enabled: this.filterEnabled !== null ? this.filterEnabled : undefined,
      accountNonLocked: this.filterLocked !== null ? !this.filterLocked : undefined,
      page: this.currentPage,
      size: this.pageSize,
      sortBy: 'createdAt',
      sortDir: 'desc'
    };

    this.customerService.getAllCustomers(filters).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: PageResponse<CustomerUser>) => {
        this.customerList = response.content ?? [];
        this.totalElements = response.totalElements ?? 0;
        this.totalPages = response.totalPages ?? 0;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar clientes:', error);
        this.customerList = [];
        this.loading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar la lista de clientes',
          confirmButtonColor: '#722f37'
        });
      }
    });
  }

  // ── Filtros / búsqueda ────────────────────────────────────────────────────

  onSearch(): void {
    this.currentPage = 0;
    this.loadCustomers();
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadCustomers();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterEnabled = null;
    this.filterLocked = null;
    this.currentPage = 0;
    this.loadCustomers();
  }

  // ── Paginación ────────────────────────────────────────────────────────────

  onPageChange(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
    this.loadCustomers();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 0;
    this.loadCustomers();
  }

  getPageNumbers(): number[] {
    const maxVisible = 5;
    const pages: number[] = [];

    if (this.totalPages <= maxVisible) {
      for (let i = 0; i < this.totalPages; i++) pages.push(i);
      return pages;
    }

    let start = Math.max(0, this.currentPage - 2);
    let end = Math.min(this.totalPages - 1, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(0, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  // ── Acciones sobre clientes ───────────────────────────────────────────────

  /**
   * Toggle de estado habilitado (activo / inactivo).
   * Pide confirmación antes de aplicar el cambio.
   */
  toggleEnabled(customer: CustomerUser): void {
    const newState = !customer.enabled;
    const action = newState ? 'activar' : 'desactivar';
    const actionPP = newState ? 'activado' : 'desactivado';
    const iconColor = newState ? '#28a745' : '#722f37';

    Swal.fire({
      title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} cliente?`,
      html: `¿Deseas <strong>${action}</strong> la cuenta de <strong>${customer.firstName} ${customer.lastName}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: iconColor,
      cancelButtonColor: '#6c757d',
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) return;

      this.customerService.toggleEnabled(customer.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          // Actualizar el objeto local directamente
          const idx = this.customerList.findIndex(c => c.id === customer.id);
          if (idx !== -1) {
            this.customerList[idx].enabled = res?.customer?.enabled ?? newState;
          }
          Swal.fire({
            icon: 'success',
            title: `Cliente ${actionPP}`,
            text: `La cuenta de ${customer.firstName} ${customer.lastName} ha sido ${actionPP} exitosamente.`,
            confirmButtonColor: '#722f37',
            timer: 2500,
            timerProgressBar: true
          });
        },
        error: (err) => {
          console.error('Error al cambiar estado del cliente:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err?.error?.message ?? 'No se pudo cambiar el estado del cliente.',
            confirmButtonColor: '#722f37'
          });
        }
      });
    });
  }

  /**
   * Toggle de bloqueo de cuenta.
   */
  toggleLock(customer: CustomerUser): void {
    const willBeLocked = customer.accountNonLocked;  // si está desbloqueada → la vamos a bloquear
    const action = willBeLocked ? 'bloquear' : 'desbloquear';
    const actionPP = willBeLocked ? 'bloqueada' : 'desbloqueada';
    const iconColor = willBeLocked ? '#dc3545' : '#28a745';

    Swal.fire({
      title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} cuenta?`,
      html: `¿Deseas <strong>${action}</strong> la cuenta de <strong>${customer.firstName} ${customer.lastName}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: iconColor,
      cancelButtonColor: '#6c757d',
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) return;

      this.customerService.toggleLocked(customer.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          const idx = this.customerList.findIndex(c => c.id === customer.id);
          if (idx !== -1) {
            this.customerList[idx].accountNonLocked = res?.customer?.accountNonLocked ?? !willBeLocked;
          }
          Swal.fire({
            icon: 'success',
            title: `Cuenta ${actionPP}`,
            text: `La cuenta de ${customer.firstName} ${customer.lastName} ha sido ${actionPP} exitosamente.`,
            confirmButtonColor: '#722f37',
            timer: 2500,
            timerProgressBar: true
          });
        },
        error: (err) => {
          console.error('Error al cambiar estado de bloqueo:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err?.error?.message ?? 'No se pudo cambiar el estado de la cuenta.',
            confirmButtonColor: '#722f37'
          });
        }
      });
    });
  }

  /**
   * Resetear intentos fallidos de login.
   */
  resetFailedAttempts(customer: CustomerUser): void {
    Swal.fire({
      title: '¿Resetear intentos fallidos?',
      html: `Se desbloquearán los intentos fallidos de <strong>${customer.firstName} ${customer.lastName}</strong> y su cuenta será desbloqueada.`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#722f37',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, resetear',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) return;

      this.customerService.resetFailedAttempts(customer.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          const idx = this.customerList.findIndex(c => c.id === customer.id);
          if (idx !== -1) {
            this.customerList[idx].accountNonLocked = true;
            this.customerList[idx].enabled = true;
          }
          Swal.fire({
            icon: 'success',
            title: 'Intentos reseteados',
            text: 'Los intentos fallidos han sido reseteados y la cuenta desbloqueada.',
            confirmButtonColor: '#722f37',
            timer: 2500,
            timerProgressBar: true
          });
        },
        error: (err) => {
          ErrorToast.fire({ title: err?.error?.message ?? 'No se pudo resetear los intentos.' });
        }
      });
    });
  }

  /**
   * Envía un enlace de recuperación de contraseña al email del cliente.
   */
  enviarRecuperacionPassword(customer: CustomerUser): void {
    Swal.fire({
      title: '¿Enviar enlace de recuperación?',
      html: `Se enviará un correo a <strong>${customer.email}</strong> con instrucciones para restablecer la contraseña.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#1d4ed8',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) return;

      this.customerService.sendPasswordReset(customer.email).pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          ErrorToast.fire({ title: err?.error?.message ?? 'No se pudo enviar el correo de recuperación.' });
          return EMPTY;
        })
      ).subscribe(() => {
        Swal.fire({
          icon: 'success',
          title: 'Correo enviado',
          html: `Se envió el enlace de recuperación a <strong>${customer.email}</strong>.`,
          confirmButtonColor: '#722f37',
          timer: 3000,
          timerProgressBar: true
        });
      });
    });
  }

  /**
   * Navega al historial de pedidos filtrado por el email del cliente.
   * Cierra el modal antes de navegar.
   */
  verHistorialCompleto(customer: CustomerUser): void {
    this.clienteSeleccionado = null;
    this.router.navigate(['/admin/orders'], {
      queryParams: { search: customer.email }
    });
  }

  /**
   * Exportar lista de clientes a CSV.
   */
  exportToCsv(): void {
    Swal.fire({
      title: 'Exportando...',
      text: 'Generando archivo CSV de clientes',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.customerService.exportToCsv(this.searchTerm || undefined).pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        Swal.fire({
          icon: 'success',
          title: 'Exportado',
          text: 'El archivo CSV fue generado exitosamente.',
          confirmButtonColor: '#722f37',
          timer: 2000,
          timerProgressBar: true
        });
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo generar el archivo CSV.',
          confirmButtonColor: '#722f37'
        });
      }
    });
  }

  // ── Helpers de UI ─────────────────────────────────────────────────────────

  /**
   * Iniciales para el avatar del cliente.
   */
  getInitials(firstName: string, lastName: string): string {
    const f = firstName?.charAt(0)?.toUpperCase() ?? '';
    const l = lastName?.charAt(0)?.toUpperCase() ?? '';
    return `${f}${l}` || '?';
  }

  /**
   * Color determinístico para el avatar según el ID del cliente.
   */
  getAvatarColor(id: number): string {
    const colors = [
      '#722f37', '#9B2335', '#B5442A', '#7B3F00',
      '#5C4033', '#4A235A', '#1A5276', '#0E6655'
    ];
    return colors[id % colors.length];
  }

  /**
   * Formatear fecha relativa (p.ej. "hace 3 días").
   */
  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffD = Math.floor(diffMs / 86400000);

      if (diffD === 0) return 'Hoy';
      if (diffD === 1) return 'Ayer';
      if (diffD < 7) return `Hace ${diffD} días`;
      if (diffD < 30) return `Hace ${Math.floor(diffD / 7)} semana(s)`;
      if (diffD < 365) return `Hace ${Math.floor(diffD / 30)} mes(es)`;
      return `Hace ${Math.floor(diffD / 365)} año(s)`;
    } catch {
      return dateStr;
    }
  }

  /** Primer registro de la página actual */
  get fromRecord(): number {
    return this.totalElements === 0 ? 0 : this.currentPage * this.pageSize + 1;
  }

  /** Último registro de la página actual */
  get toRecord(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
  }
}
