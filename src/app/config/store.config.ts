/**
 * Fuente ÚNICA de datos de la sucursal física para el frontend (checkout / recolección).
 *
 * ESTADO DE VERIFICACIÓN (revisar antes de producción):
 *  - Dirección: tomada del texto ya publicado en Centro de Ayuda / páginas informativas
 *    ("C. Morelos 18, Col. Centro, C.P. 43000, Huejutla de Reyes, Hidalgo"). No hay fuente
 *    en backend ni en BD que la confirme.
 *  - Coordenadas: APROXIMADAS (centro de Huejutla de Reyes). NO están confirmadas con la
 *    ubicación exacta de la tienda. Sustituir por las reales.
 *  - Horario y teléfono: NO existe fuente confiable (el footer contiene datos de ejemplo),
 *    por eso se dejan vacíos y la UI no los muestra.
 */
export interface StoreConfig {
  name: string;
  streetAddress: string;
  cityStateZip: string;
  /** null = sin dato confirmado; la UI no lo muestra. */
  schedule: string | null;
  /** null = sin dato confirmado; la UI no lo muestra. */
  phone: string | null;
  latitude: number;
  longitude: number;
  coordinatesConfirmed: boolean;
}

export const STORE_CONFIG: StoreConfig = {
  name: 'Casa de Música Castillo',
  streetAddress: 'C. Morelos 18, Col. Centro',
  cityStateZip: 'C.P. 43000, Huejutla de Reyes, Hidalgo',
  schedule: null,
  phone: null,
  latitude: 21.1406,
  longitude: -98.4194,
  coordinatesConfirmed: false,
};
