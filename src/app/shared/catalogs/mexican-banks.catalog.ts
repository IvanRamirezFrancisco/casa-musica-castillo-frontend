export interface MexicanBank {
  code: string;
  displayName: string;
  shortName?: string;
}

/**
 * Catálogo local mantenible de Bancos Mexicanos (Código de 3 dígitos de la CLABE).
 * Basado en la asignación oficial de la ABM (Asociación de Bancos de México).
 * Nota: Este catálogo no pretende ser inmutable. Puede actualizarse conforme surjan nuevas instituciones.
 */
export const MEXICAN_BANKS: MexicanBank[] = [
  { code: '002', displayName: 'Banco Nacional de México, S.A. (Banamex)', shortName: 'Banamex' },
  { code: '006', displayName: 'Banco Nacional de Comercio Exterior', shortName: 'Bancomext' },
  { code: '009', displayName: 'Banco Nacional de Obras y Servicios Públicos', shortName: 'Banobras' },
  { code: '012', displayName: 'BBVA México, S.A.', shortName: 'BBVA' },
  { code: '014', displayName: 'Banco Santander (México), S.A.', shortName: 'Santander' },
  { code: '019', displayName: 'Banco Nacional del Ejército, Fuerza Aérea y Armada', shortName: 'Banjercito' },
  { code: '021', displayName: 'HSBC México, S.A.', shortName: 'HSBC' },
  { code: '030', displayName: 'Banco del Bajío, S.A.', shortName: 'BanBajío' },
  { code: '036', displayName: 'Banco Inbursa, S.A.', shortName: 'Inbursa' },
  { code: '042', displayName: 'Banca Mifel, S.A.', shortName: 'Mifel' },
  { code: '044', displayName: 'Scotiabank Inverlat, S.A.', shortName: 'Scotiabank' },
  { code: '058', displayName: 'Banco Regional de Monterrey, S.A.', shortName: 'Banregio' },
  { code: '059', displayName: 'Banco Invex, S.A.', shortName: 'Invex' },
  { code: '060', displayName: 'Bansi, S.A.', shortName: 'Bansi' },
  { code: '062', displayName: 'Banca Afirme, S.A.', shortName: 'Afirme' },
  { code: '072', displayName: 'Banco Mercantil del Norte, S.A. (Banorte)', shortName: 'Banorte' },
  { code: '106', displayName: 'Bank of America México, S.A.', shortName: 'Bank of America' },
  { code: '108', displayName: 'MUFG Bank México, S.A.', shortName: 'MUFG Bank' },
  { code: '110', displayName: 'Banco J.P. Morgan, S.A.', shortName: 'J.P. Morgan' },
  { code: '112', displayName: 'Banco Monex, S.A.', shortName: 'Monex' },
  { code: '127', displayName: 'Banco Azteca, S.A.', shortName: 'Banco Azteca' },
  { code: '137', displayName: 'BanCoppel, S.A.', shortName: 'BanCoppel' },
  { code: '143', displayName: 'Consubanco, S.A.', shortName: 'Consubanco' },
  { code: '147', displayName: 'Bankaool, S.A.', shortName: 'Bankaool' },
  { code: '149', displayName: 'Banco Multiva, S.A.', shortName: 'Multiva' },
  { code: '150', displayName: 'Banco Inmobiliario Mexicano, S.A.', shortName: 'BIM' },
  { code: '152', displayName: 'Banco Bancrea, S.A.', shortName: 'Bancrea' },
  { code: '156', displayName: 'Banco Sabadell, S.A.', shortName: 'Sabadell' },
  { code: '166', displayName: 'Banco del Bienestar, S.N.C.', shortName: 'Bienestar' },
  { code: '610', displayName: 'Bursamétrica Casa de Bolsa', shortName: 'Bursamétrica' },
  { code: '638', displayName: 'NU MÉXICO', shortName: 'Nu' },
  { code: '646', displayName: 'NU MÉXICO', shortName: 'Nu' },
  { code: '652', displayName: 'ASEA, S.A. de C.V.', shortName: 'ASEA' },
  { code: '656', displayName: 'Opciones Empresariales del Noreste', shortName: 'OEN' },
  { code: '659', displayName: 'Opciones Empresariales del Noreste', shortName: 'OEN' },
  { code: '901', displayName: 'Cls Bank International', shortName: 'CLS Bank' },
  { code: '902', displayName: 'Indeval, S.A. de C.V.', shortName: 'Indeval' },
  { code: '903', displayName: 'Libertad Servicios Financieros', shortName: 'Caja Libertad' },
];
