import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductosService } from '../productos/productos.service';
import { BrandImage } from './entities/brand-image.entity';
import { ProductImage } from './entities/product-image.entity';

@Injectable()
export class MultimediaService {
  private readonly logger = new Logger(MultimediaService.name);

  constructor(
    private readonly productosService: ProductosService,
    @InjectRepository(BrandImage)
    private readonly brandImageRepo: Repository<BrandImage>,
    @InjectRepository(ProductImage)
    private readonly productImageRepo: Repository<ProductImage>,
  ) {}

  /**
   * Trae todas las marcas de Movivendor (todos los tipos) e inserta Brand + Url en BrandImages.
   * Limpia la tabla antes de insertar para dejar un catálogo fresco.
   */
  async syncBrandImagesFromMovivendor() {
    const marcas = await this.productosService.listAllMarcasConLogo();
    this.logger.log(
      `Sync BrandImages: ${marcas.length} marcas únicas desde Movivendor`,
    );

    await this.brandImageRepo.clear();

    const rows = marcas.map((m) =>
      this.brandImageRepo.create({
        brand: m.marca.slice(0, 200),
        url: m.service_logo || null,
      }),
    );

    if (rows.length > 0) {
      await this.brandImageRepo.save(rows);
    }

    return {
      total: rows.length,
      inserted: rows.length,
      items: rows.map((r) => ({
        id: r.id,
        brand: r.brand,
        url: r.url,
      })),
    };
  }

  /**
   * 1) Lista todas las marcas (como BrandImages).
   * 2) Por cada marca, toma los productos equivalentes a GET /productos/por-marca.
   * 3) Limpia ProductImages e inserta ServiceSKU, Url, ServiceGroup, Brand.
   */
  async syncProductImagesFromMovivendor() {
    const marcas = await this.productosService.listAllMarcasConLogo();
    const catalogo =
      await this.productosService.listAllProductosPorMarcaCampos();

    this.logger.log(
      `Sync ProductImages: ${marcas.length} marcas, ${catalogo.length} productos en catálogo`,
    );

    const rowsToInsert: ProductImage[] = [];
    let marcasConProductos = 0;

    for (const m of marcas) {
      const needle = m.marca.trim().toLowerCase();
      if (!needle) continue;

      const productos = catalogo.filter(
        (p) => p.service_name.trim().toLowerCase() === needle,
      );
      if (productos.length === 0) continue;
      marcasConProductos += 1;

      for (const p of productos) {
        rowsToInsert.push(
          this.productImageRepo.create({
            serviceSku: p.service_sku
              ? p.service_sku.slice(0, 500)
              : null,
            url: p.service_logo || null,
            serviceGroup: p.service_group
              ? p.service_group.slice(0, 45)
              : null,
            brand: p.service_name
              ? p.service_name.slice(0, 200)
              : m.marca.slice(0, 200),
          }),
        );
      }
    }

    await this.productImageRepo.clear();

    if (rowsToInsert.length > 0) {
      // batches para no saturar el pool con un insert gigante
      const batchSize = 200;
      for (let i = 0; i < rowsToInsert.length; i += batchSize) {
        await this.productImageRepo.save(
          rowsToInsert.slice(i, i + batchSize),
        );
      }
    }

    return {
      marcas: marcas.length,
      marcasConProductos,
      total: rowsToInsert.length,
      inserted: rowsToInsert.length,
      items: rowsToInsert.map((r) => ({
        id: r.id,
        serviceSku: r.serviceSku,
        url: r.url,
        serviceGroup: r.serviceGroup,
        brand: r.brand,
      })),
    };
  }
}
