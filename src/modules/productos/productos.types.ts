export interface MovivendorServiceOffer {
  id: number;
  amount: number;
  subprod: number;
  plan: string | null;
}

/** Un servicio/producto asignado (formato unificado para `data`). */
export interface ProductoServicioDto {
  service_group: string;
  service_sku: string;
  service_name: string;
  service_logo: string;
  service_last_update: string;
  service_offers: MovivendorServiceOffer[];
  destination_min_length: string;
  destination_max_length: string;
  destination_format: string;
}

/** Marca (`service_name`) con los productos/servicios asociados. */
export interface MarcaGrupoDto {
  marca: string;
  servicios: ProductoServicioDto[];
}

/** Un tipo (`service_group` normalizado); dentro, todas las marcas de ese tipo. */
export interface TipoGrupoDto {
  tipo: string;
  marcas: MarcaGrupoDto[];
}

/** Agrupación interna (incluye servicios completos). */
export type MarcasPorTipoDto = TipoGrupoDto[];

/** Metadatos de paginación por cada `tipo` en `GET /productos/marcas`. */
export interface MarcasListaPorTipoMetaItem {
  tipo: string;
  total: number;
  totalPages: number;
}

export interface MarcasListaPaginatedResponse {
  data: TipoMarcasListaDto[];
  meta: {
    page: number;
    limit: number;
    porTipo: MarcasListaPorTipoMetaItem[];
  };
}

/** Respuesta de `GET /productos/marcas`: hasta `limit` marcas por cada `tipo` (6 por defecto). */
export interface MarcaListaDto {
  marca: string;
  service_logo: string;
}

export interface TipoMarcasListaDto {
  tipo: string;
  marcas: MarcaListaDto[];
}

export type MarcasListaPorTipoDto = TipoMarcasListaDto[];

/**
 * Catálogo mínimo para elegir monto y armar `ejecutarTx` (Movivendor Integración).
 * `service_sku` repite el SKU del producto (p. ej. `A` en Movistar) en cada oferta para usar solo la fila elegida.
 */
export interface OfertaVentaDto {
  service_sku: string;
  id: number;
  amount: number;
  subprod: number;
  plan: string | null;
}

export interface ProductoVentaSeleccionDto {
  service_group: string;
  service_sku: string;
  service_name: string;
  service_logo: string;
  destination: {
    min_length: string;
    max_length: string;
    format: string;
  };
  offers: OfertaVentaDto[];
}
