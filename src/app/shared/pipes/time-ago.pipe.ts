/**
 * ══════════════════════════════════════════════════════════════════════════
 * TimeAgo Pipe — Timestamps relativos en español
 *
 * Convierte una fecha en un texto legible como "hace 5 min", "hace 2 h", etc.
 * Es `pure: false` para actualizarse automáticamente en la vista.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeAgo',
  standalone: true,
  pure: false
})
export class TimeAgoPipe implements PipeTransform {
  transform(date: Date | string | null | undefined): string {
    if (!date) return '';

    const now = Date.now();
    const then = new Date(date).getTime();
    const diff = Math.floor((now - then) / 1000);

    if (diff < 5)     return 'ahora';
    if (diff < 60)    return `hace ${diff} seg`;
    if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) {
      const days = Math.floor(diff / 86400);
      return days === 1 ? 'hace 1 día' : `hace ${days} días`;
    }

    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short'
    });
  }
}
