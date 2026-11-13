import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { AdminBackupsComponent }    from '../admin-backups/admin-backups.component';
import { AdminDbMonitoringComponent }  from './tabs/admin-db-monitoring/admin-db-monitoring.component';
import { AdminDbMaintenanceComponent } from './tabs/admin-db-maintenance/admin-db-maintenance.component';
import { AdminDbQueriesComponent }     from './tabs/admin-db-queries/admin-db-queries.component';
import { AdminAutomationsComponent }   from './tabs/admin-automations/admin-automations.component';
import { AuthService } from '../../../services/auth.service';

export type DbTab = 'backups' | 'monitoring' | 'maintenance' | 'queries' | 'automations';

interface TabDef {
  value: DbTab;
  label: string;
  icon: string;
  permission: string;  // Permiso requerido para ver esta pestaña
}

@Component({
  selector: 'app-admin-db-management',
  standalone: true,
  imports: [
    AdminBackupsComponent,
    AdminDbMonitoringComponent,
    AdminDbMaintenanceComponent,
    AdminDbQueriesComponent,
    AdminAutomationsComponent
],
  templateUrl: './admin-db-management.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl:    './admin-db-management.component.css',
})
export class AdminDbManagementComponent implements OnInit {

  activeTab: DbTab = 'backups';

  readonly allTabs: TabDef[] = [
    { value: 'backups',     label: 'Respaldos',        icon: 'backup',        permission: 'DATABASE_BACKUP'   },
    { value: 'monitoring',  label: 'Monitoreo',         icon: 'monitor_heart', permission: 'DATABASE_VIEW'     },
    { value: 'maintenance', label: 'Mantenimiento',     icon: 'build_circle',  permission: 'DATABASE_MAINTAIN' },
    { value: 'queries',     label: 'Consultas Lentas',  icon: 'speed',         permission: 'DATABASE_VIEW'     },
    { value: 'automations', label: 'Automatizaciones',  icon: 'schedule',      permission: 'DATABASE_AUTOMATE' },
  ];

  /** Pestañas visibles según los permisos del usuario actual */
  get visibleTabs(): TabDef[] {
    return this.allTabs.filter(t => this.authService.hasPermission(t.permission));
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    const visible = this.visibleTabs;

    // Si no tiene acceso a ninguna pestaña, redirigir al dashboard
    if (visible.length === 0) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }

    // Leer ?tab= para navegar directo desde el centro de notificaciones
    const tabParam = this.route.snapshot.queryParamMap.get('tab') as DbTab | null;
    if (tabParam && visible.some(t => t.value === tabParam)) {
      this.activeTab = tabParam;
    } else {
      // Seleccionar la primera pestaña visible por defecto
      this.activeTab = visible[0].value;
    }
  }

  changeTab(tab: DbTab): void {
    this.activeTab = tab;
  }
}
