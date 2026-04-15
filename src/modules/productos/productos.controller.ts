import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ConsultarSaldoExternoDto } from './dto/consultar-saldo-externo.dto';
import { EstatusVentaDto } from './dto/estatus-venta.dto';
import { EjecutarVentaDto } from './dto/ejecutar-venta.dto';
import { ProductosMarcasBuscarQueryDto } from './dto/productos-marcas-buscar-query.dto';
import { ProductosMarcasQueryDto } from './dto/productos-marcas-query.dto';
import { ProductosPorMarcaQueryDto } from './dto/productos-por-marca-query.dto';
import { ProductosService } from './productos.service';

@ApiTags('productos')
@ApiBearerAuth()
@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get('marcas')
  @ApiOperation({
    summary: 'Marcas por tipo (Movivendor)',
    description:
      'Marcas agrupadas por `tipo`. En cada bloque, hasta `limit` marcas de ese tipo (por defecto 6); `page` aplica por igual a todos los tipos. `meta.porTipo` indica `total` y `totalPages` por tipo. Los tipos sin marcas en esa página no aparecen en `data`. Una petición a Movivendor.',
  })
  marcas(@Query() query: ProductosMarcasQueryDto) {
    return this.productosService.getMarcas(query.page ?? 1, query.limit ?? 6);
  }

  @Get('marcas/buscar')
  @ApiOperation({
    summary: 'Buscar marcas por nombre (Movivendor)',
    description:
      'Misma respuesta que `GET /productos/marcas`: `data` + `meta` con paginación por tipo. Filtra marcas donde el nombre contiene `nombre` (equivalente a `LIKE %nombre%`, sin distinguir mayúsculas). Tipos sin coincidencias no aparecen en `meta.porTipo`. Una petición a Movivendor.',
  })
  marcasBuscar(@Query() query: ProductosMarcasBuscarQueryDto) {
    return this.productosService.getMarcasPorNombre(
      query.nombre,
      query.page ?? 1,
      query.limit ?? 6,
    );
  }

  @Get('por-marca')
  @ApiOperation({
    summary: 'Productos por marca (paginado, listo para venta)',
    description:
      'Misma fuente que marcas. `data` sin `service_last_update`: `service_group`, `service_sku`, `service_name`, `service_logo`, `destination` (validación del número) y `offers` (`id`, `amount`, `subprod`, `plan`) para enlazar con ejecutarTx en [Integración Movivendor](https://integra.movivendor.com/restV1/metodos/ejecutarTx).',
  })
  productosPorMarca(@Query() query: ProductosPorMarcaQueryDto) {
    return this.productosService.getProductosPorMarca(
      query.marca,
      query.page ?? 1,
      query.limit ?? 10,
    );
  }

  @Post('venta')
  @ApiOperation({
    summary: 'Ejecutar venta / recarga (Movivendor do/tx)',
    description:
      'Envía POST a `MOVIVENDOR_VENTA` con token obtenido por login en servidor. Body: `id`, `product`, `subprod`, `destination`, `amount`; `terminal` opcional si existe `MOVIVENDOR_TERMINAL` en `.env`.',
  })
  ejecutarVenta(@Body() dto: EjecutarVentaDto) {
    return this.productosService.ejecutarVenta(dto);
  }

  @Post('estatus-venta')
  @ApiOperation({
    summary: 'Estatus de venta (Movivendor check/tx)',
    description:
      'Envía POST a `MOVIVENDOR_ESTATUS_VENTA` con token por login en servidor. Body: `id`, `product`, `subprod`, `destination`, `amount`. El `terminal` se toma solo de `MOVIVENDOR_TERMINAL` en `.env` (no se envía en el body).',
  })
  estatusVenta(@Body() dto: EstatusVentaDto) {
    return this.productosService.estatusVenta(dto);
  }

  @Post('consultar-saldo-externo')
  @ApiOperation({
    summary: 'Consultar saldo externo (Movivendor query/tx)',
    description:
      'Envía POST a `MOVIVENDOR_CONSULTAR_SALDO_EXTERNO` con token por login en servidor. El `id` de correlación (12 dígitos numéricos) se genera en el servidor para cada petición. Body: `product`, `subprod`, `destination`, `amount`; `terminal` opcional si existe `MOVIVENDOR_TERMINAL` en `.env`.',
  })
  consultarSaldoExterno(@Body() dto: ConsultarSaldoExternoDto) {
    return this.productosService.consultarSaldoExterno(dto);
  }
}
