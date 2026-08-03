import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { CreateFavoriteBrandDto } from './dto/create-favorite-brand.dto';
import { FavoriteBrand } from './entities/favorite-brand.entity';

@Injectable()
export class FavoritesBrandsService {
  constructor(
    @InjectRepository(FavoriteBrand)
    private readonly favoritesRepo: Repository<FavoriteBrand>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async add(clientId: number, dto: CreateFavoriteBrandDto) {
    if (!clientId) {
      throw new UnauthorizedException('Usuario sin cliente asociado');
    }

    const brand = dto.brand.trim();
    if (!brand) {
      throw new BadRequestException('brand es requerido');
    }

    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client || client.deletedAt) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const existing = await this.favoritesRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.client', 'c')
      .where('c.id = :clientId', { clientId })
      .andWhere('LOWER(TRIM(f.brand)) = :brand', {
        brand: brand.toLowerCase(),
      })
      .getOne();

    if (existing) {
      if (existing.estatus === 1) {
        throw new ConflictException('La marca ya está en favoritos');
      }
      existing.estatus = 1;
      existing.brand = brand.slice(0, 400);
      return this.favoritesRepo.save(existing);
    }

    const row = this.favoritesRepo.create({
      brand: brand.slice(0, 400),
      client,
      estatus: 1,
    });
    return this.favoritesRepo.save(row);
  }

  async listByClient(clientId: number) {
    if (!clientId) {
      throw new UnauthorizedException('Usuario sin cliente asociado');
    }

    const rows = await this.favoritesRepo
      .createQueryBuilder('f')
      .leftJoin('f.client', 'c')
      .where('c.id = :clientId', { clientId })
      .andWhere('f.estatus = :estatus', { estatus: 1 })
      .orderBy('f.id', 'DESC')
      .getMany();

    return rows.map((r) => ({
      id: r.id,
      brand: r.brand,
      estatus: r.estatus,
    }));
  }

  async remove(clientId: number, id: number) {
    if (!clientId) {
      throw new UnauthorizedException('Usuario sin cliente asociado');
    }

    const row = await this.favoritesRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.client', 'c')
      .where('f.id = :id', { id })
      .andWhere('c.id = :clientId', { clientId })
      .getOne();

    if (!row) {
      throw new NotFoundException('Favorito no encontrado');
    }

    row.estatus = 0;
    await this.favoritesRepo.save(row);
    return { id: row.id, brand: row.brand, estatus: 0 };
  }

  /** Pone Estatus = 0 por nombre de marca (cliente del JWT). */
  async deactivateByBrand(clientId: number, brandRaw: string) {
    if (!clientId) {
      throw new UnauthorizedException('Usuario sin cliente asociado');
    }

    const brand = brandRaw.trim();
    if (!brand) {
      throw new BadRequestException('brand es requerido');
    }

    const row = await this.favoritesRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.client', 'c')
      .where('c.id = :clientId', { clientId })
      .andWhere('LOWER(TRIM(f.brand)) = :brand', {
        brand: brand.toLowerCase(),
      })
      .andWhere('f.estatus = :estatus', { estatus: 1 })
      .getOne();

    if (!row) {
      throw new NotFoundException(
        'Favorito activo no encontrado para esa marca',
      );
    }

    row.estatus = 0;
    await this.favoritesRepo.save(row);
    return { id: row.id, brand: row.brand, estatus: 0 };
  }
}
