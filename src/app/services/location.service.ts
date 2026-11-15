import { Injectable } from '@angular/core';
import { ConnectivityService } from './connectivity.service';
import { STORE_CONFIG } from '../config/store.config';

export type GeolocationPermissionStatus =
  | 'granted'
  | 'prompt'
  | 'denied'
  | 'unsupported';

export interface DetectedCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface ResolvedAddress {
  street: string;
  neighborhood: string;
  postalCode: string;
  city: string;
  state: string;
  displayAddress: string;
  coordinates: DetectedCoordinates;
  reverseGeocodeResolved: boolean;
  distanceToStoreKm: number;
}

export interface StoreLocationInfo {
  name: string;
  streetAddress: string;
  cityStateZip: string;
  schedule: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  mapsDirectionsUrl: string;
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  /**
   * Datos de la tienda: única fuente en `config/store.config.ts` (ver estado de verificación allí).
   */
  public readonly storeInfo: StoreLocationInfo = {
    name: STORE_CONFIG.name,
    streetAddress: STORE_CONFIG.streetAddress,
    cityStateZip: STORE_CONFIG.cityStateZip,
    schedule: STORE_CONFIG.schedule,
    phone: STORE_CONFIG.phone,
    latitude: STORE_CONFIG.latitude,
    longitude: STORE_CONFIG.longitude,
    mapsDirectionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${STORE_CONFIG.latitude},${STORE_CONFIG.longitude}`,
  };

  /**
   * Ubicación temporal únicamente en memoria durante la sesión activa de checkout.
   * Nunca se persiste en localStorage ni sessionStorage por privacidad.
   */
  private temporaryLocation: DetectedCoordinates | null = null;

  constructor(private connectivityService: ConnectivityService) {}

  /**
   * Verifica si el navegador y el contexto actual soportan Geolocation API.
   */
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'geolocation' in navigator &&
      typeof navigator.geolocation.getCurrentPosition === 'function'
    );
  }

  /**
   * Consulta el estado actual del permiso de geolocalización sin disparar el prompt del navegador.
   */
  async getPermissionState(): Promise<GeolocationPermissionStatus> {
    if (!this.isSupported()) {
      return 'unsupported';
    }
    try {
      if (
        'permissions' in navigator &&
        typeof navigator.permissions?.query === 'function'
      ) {
        const status = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });
        if (
          status.state === 'granted' ||
          status.state === 'prompt' ||
          status.state === 'denied'
        ) {
          return status.state;
        }
      }
    } catch {
      // Algunos navegadores no implementan permissions.query para geolocation
    }
    return 'prompt';
  }

  /**
   * Obtiene la ubicación puntual del usuario mediante getCurrentPosition (nunca watchPosition).
   * Sólo debe invocarse tras clic explícito del usuario.
   */
  getCurrentPosition(): Promise<DetectedCoordinates> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        reject({
          code: -1,
          customMessage:
            'Tu navegador no soporta geolocalización. Puedes ingresar tu dirección manualmente.',
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          const coords: DetectedCoordinates = {
            latitude: Number(position.coords.latitude.toFixed(6)),
            longitude: Number(position.coords.longitude.toFixed(6)),
            accuracy: Math.round(position.coords.accuracy || 0),
            timestamp: position.timestamp || Date.now(),
          };
          this.temporaryLocation = coords;
          resolve(coords);
        },
        (error: GeolocationPositionError) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }

  /**
   * Resuelve una dirección aproximada a partir de coordenadas usando geocodificación inversa HTTPS
   * (OpenStreetMap Nominatim) con timeout defensivo y degradación elegante si no está disponible.
   * Nunca inventa número exterior, número interior ni referencias privadas.
   */
  async reverseGeocode(
    lat: number,
    lng: number
  ): Promise<ResolvedAddress> {
    const coords: DetectedCoordinates = this.temporaryLocation || {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      accuracy: 0,
      timestamp: Date.now(),
    };

    const distanceToStoreKm = this.calculateDistanceKm(
      lat,
      lng,
      this.storeInfo.latitude,
      this.storeInfo.longitude
    );

    // Si estamos sin conexión, retornar coordenadas con sugerencia regional si está en Huejutla
    if (!this.connectivityService.isOnline) {
      return this.buildFallbackAddress(coords, distanceToStoreKm);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lng)}&addressdetails=1&accept-language=es`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.buildFallbackAddress(coords, distanceToStoreKm);
      }

      const data = await response.json();
      const addr = data?.address || {};

      const street = this.cleanField(
        addr.road ||
          addr.pedestrian ||
          addr.residential ||
          addr.street ||
          addr.path ||
          ''
      );

      const neighborhood = this.cleanField(
        addr.suburb ||
          addr.neighbourhood ||
          addr.quarter ||
          addr.hamlet ||
          addr.village ||
          addr. residential ||
          ''
      );

      // Solo datos devueltos por el proveedor; nunca se completan por cercanía a la tienda.
      const city = this.cleanField(
        addr.city || addr.town || addr.municipality || addr.county || ''
      );

      const state = this.cleanField(addr.state || '');

      const postalCode = this.cleanPostalCode(addr.postcode || '');

      const summaryParts = [
        street,
        neighborhood ? `Col. ${neighborhood}` : '',
        postalCode ? `C.P. ${postalCode}` : '',
        city,
        state,
      ].filter((part) => part.length > 0);

      // Sin calle no hay dirección utilizable: se trata como "no resuelta".
      if (!street) {
        return this.buildFallbackAddress(coords, distanceToStoreKm);
      }

      return {
        street,
        neighborhood,
        postalCode,
        city,
        state,
        displayAddress: summaryParts.join(', '),
        coordinates: coords,
        reverseGeocodeResolved: true,
        distanceToStoreKm,
      };
    } catch {
      clearTimeout(timeoutId);
      return this.buildFallbackAddress(coords, distanceToStoreKm);
    }
  }

  /**
   * Calcula la distancia en kilómetros entre dos coordenadas usando la fórmula de Haversine.
   */
  calculateDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Radio medio de la Tierra en km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  /**
   * Traduce los códigos de error de Geolocation API a mensajes claros en español para el usuario.
   */
  mapGeolocationError(error: any): string {
    if (!this.connectivityService.isOnline) {
      return 'Sin conexión a internet. No pudimos obtener tu ubicación; puedes ingresar tu dirección manualmente.';
    }
    if (error?.customMessage) {
      return error.customMessage;
    }
    const code = error?.code;
    switch (code) {
      case 1: // PERMISSION_DENIED
        return 'Permiso de ubicación denegado. Puedes ingresar tu dirección manualmente sin ningún problema.';
      case 2: // POSITION_UNAVAILABLE
        return 'No pudimos determinar tu ubicación actual. Puedes ingresar tu dirección manualmente.';
      case 3: // TIMEOUT
        return 'Tiempo agotado al obtener tu ubicación. Puedes intentar de nuevo o ingresar tu dirección manualmente.';
      default:
        return 'No pudimos obtener tu ubicación. Puedes ingresar tu dirección manualmente.';
    }
  }

  getTemporaryLocation(): DetectedCoordinates | null {
    return this.temporaryLocation;
  }

  /**
   * Limpia las coordenadas temporales en memoria.
   */
  clearTemporaryLocation(): void {
    this.temporaryLocation = null;
  }

  /**
   * Fallback cuando el proveedor no devuelve una dirección: NO se inventa calle, colonia,
   * C.P., ciudad ni estado. Solo se muestra un mensaje informativo.
   */
  private buildFallbackAddress(
    coords: DetectedCoordinates,
    distanceToStoreKm: number
  ): ResolvedAddress {
    const isNearHuejutla = distanceToStoreKm <= 15;
    return {
      street: '',
      neighborhood: '',
      postalCode: '',
      city: '',
      state: '',
      displayAddress: isNearHuejutla
        ? 'Ubicación detectada cerca de Huejutla de Reyes, Hidalgo, pero no pudimos obtener la dirección exacta.'
        : 'Ubicación detectada, pero no pudimos obtener la dirección exacta.',
      coordinates: coords,
      reverseGeocodeResolved: false,
      distanceToStoreKm,
    };
  }

  private cleanField(value: string): string {
    return (value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  }

  private cleanPostalCode(value: string): string {
    const digits = (value || '').replace(/\D/g, '');
    return digits.length === 5 ? digits : '';
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
