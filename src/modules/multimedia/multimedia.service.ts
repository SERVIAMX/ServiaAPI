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
   * Inserta solo marcas faltantes en BrandImages (match por Brand, case-insensitive).
   * Url siempre null (no copia service_logo de Movivendor).
   */
  async syncBrandImagesFromMovivendor() {
    const marcas = await this.productosService.listAllMarcasConLogo();
    const existing = await this.brandImageRepo.find({
      select: ['brand'],
    });
    const existingKeys = new Set(
      existing
        .map((r) => r.brand?.trim().toLowerCase())
        .filter((b): b is string => Boolean(b)),
    );

    const toInsert: BrandImage[] = [];
    for (const m of marcas) {
      const brand = m.marca.trim();
      if (!brand) continue;
      const key = brand.toLowerCase();
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      toInsert.push(
        this.brandImageRepo.create({
          brand: brand.slice(0, 200),
          url: null,
        }),
      );
    }

    this.logger.log(
      `Sync BrandImages: catálogo=${marcas.length} existentes=${existing.length} insertar=${toInsert.length}`,
    );

    if (toInsert.length > 0) {
      await this.brandImageRepo.save(toInsert);
    }

    return {
      catalog: marcas.length,
      existing: existing.length,
      inserted: toInsert.length,
      skipped: marcas.length - toInsert.length,
      items: toInsert.map((r) => ({
        id: r.id,
        brand: r.brand,
        url: r.url,
      })),
    };
  }

  /**
   * Inserta solo productos faltantes en ProductImages.
   * Clave: ServiceSKU (si hay); si no, Brand|ServiceGroup.
   * Url siempre null (no copia service_logo).
   */
  async syncProductImagesFromMovivendor() {
    const marcas = await this.productosService.listAllMarcasConLogo();
    const catalogo =
      await this.productosService.listAllProductosPorMarcaCampos();

    const existing = await this.productImageRepo.find({
      select: ['serviceSku', 'brand', 'serviceGroup'],
    });
    const existingKeys = new Set(
      existing.map((r) =>
        this.productImageKey(r.serviceSku, r.brand, r.serviceGroup),
      ),
    );

    const rowsToInsert: ProductImage[] = [];
    const seenNew = new Set<string>();

    for (const p of catalogo) {
      const brand = p.service_name?.trim() || '';
      if (!brand) continue;
      const sku = p.service_sku?.trim() || '';
      const group = p.service_group?.trim() || '';
      const key = this.productImageKey(sku || null, brand, group || null);
      if (existingKeys.has(key) || seenNew.has(key)) continue;
      seenNew.add(key);
      rowsToInsert.push(
        this.productImageRepo.create({
          serviceSku: sku ? sku.slice(0, 500) : null,
          url: null,
          serviceGroup: group ? group.slice(0, 45) : null,
          brand: brand.slice(0, 200),
        }),
      );
    }

    this.logger.log(
      `Sync ProductImages: marcas=${marcas.length} catálogo=${catalogo.length} existentes=${existing.length} insertar=${rowsToInsert.length}`,
    );

    if (rowsToInsert.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < rowsToInsert.length; i += batchSize) {
        await this.productImageRepo.save(
          rowsToInsert.slice(i, i + batchSize),
        );
      }
    }

    return {
      marcas: marcas.length,
      catalog: catalogo.length,
      existing: existing.length,
      inserted: rowsToInsert.length,
      skippedExisting: existingKeys.size,
      items: rowsToInsert.map((r) => ({
        id: r.id,
        serviceSku: r.serviceSku,
        url: r.url,
        serviceGroup: r.serviceGroup,
        brand: r.brand,
      })),
    };
  }

  private productImageKey(
    serviceSku: string | null | undefined,
    brand: string | null | undefined,
    serviceGroup: string | null | undefined,
  ): string {
    const sku = (serviceSku ?? '').trim().toLowerCase();
    if (sku) return `sku:${sku}`;
    const b = (brand ?? '').trim().toLowerCase();
    const g = (serviceGroup ?? '').trim().toLowerCase();
    return `bg:${b}|${g}`;
  }
}
