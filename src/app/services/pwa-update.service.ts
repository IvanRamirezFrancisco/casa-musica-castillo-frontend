import { ApplicationRef, Injectable, OnDestroy } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subscription, concat, first, interval } from 'rxjs';
import Swal from 'sweetalert2';

/**
 * Gestiona las actualizaciones del Service Worker de Angular.
 * - Solo actúa si el SW está habilitado (producción).
 * - Avisa al usuario cuando hay una nueva versión lista y le deja decidir.
 * - Activa la versión nueva UNA vez y recarga UNA vez (sin bucles).
 */
@Injectable({
  providedIn: 'root'
})
export class PwaUpdateService implements OnDestroy {
  private readonly subscription = new Subscription();
  private promptOpen = false;
  private reloading = false;

  constructor(private appRef: ApplicationRef, private swUpdate: SwUpdate) {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.subscription.add(
      this.swUpdate.versionUpdates.subscribe((event: VersionEvent) => {
        if (event.type === 'VERSION_READY') {
          this.promptUserToUpdate();
        }
      })
    );

    // Si el SW queda en un estado irrecuperable, se recarga una única vez.
    this.subscription.add(
      this.swUpdate.unrecoverable.subscribe(() => this.reloadOnce())
    );

    // Buscar actualizaciones cada 6 horas, cuando la app ya es estable.
    const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable));
    const everySixHours$ = interval(6 * 60 * 60 * 1000);
    this.subscription.add(
      concat(appIsStable$, everySixHours$).subscribe(() => {
        this.swUpdate.checkForUpdate().catch(() => { /* sin red: se reintenta en el siguiente ciclo */ });
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private promptUserToUpdate(): void {
    if (this.promptOpen) {
      return;
    }
    this.promptOpen = true;

    Swal.fire({
      title: 'Hay una nueva versión disponible.',
      text: '¿Deseas actualizar ahora? Se recargará la página.',
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#722F37',
      confirmButtonText: 'Actualizar',
      cancelButtonText: 'Más tarde'
    }).then(result => {
      this.promptOpen = false;
      if (result.isConfirmed) {
        this.swUpdate.activateUpdate()
          .catch(() => { /* si falla, igualmente se recarga una vez */ })
          .finally(() => this.reloadOnce());
      }
    });
  }

  private reloadOnce(): void {
    if (this.reloading) {
      return;
    }
    this.reloading = true;
    document.location.reload();
  }
}
