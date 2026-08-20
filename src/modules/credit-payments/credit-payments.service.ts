import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  S3_VOUCHERS_FOLDER,
} from '../../common/constants/voucher-upload.constants';
import { BalanceHistory } from '../clients/entities/balance-history.entity';
import { ReferenceCode } from '../references-codes/entities/reference-code.entity';
import { S3Service } from '../s3/s3.service';
import { CreditPayment } from './entities/credit-payment.entity';

@Injectable()
export class CreditPaymentsService {
  constructor(
    @InjectRepository(CreditPayment)
    private readonly creditPaymentRepo: Repository<CreditPayment>,
    @InjectRepository(BalanceHistory)
    private readonly balanceHistoryRepo: Repository<BalanceHistory>,
    @InjectRepository(ReferenceCode)
    private readonly referenceCodeRepo: Repository<ReferenceCode>,
    private readonly s3Service: S3Service,
  ) {}

  private async resolveReferenceCodeId(
    clientId: number,
    codeRaw: string,
  ): Promise<number> {
    const code = codeRaw?.trim();
    if (!code || !/^\d{8}$/.test(code)) {
      throw new BadRequestException(
        'Code inválido (debe ser numérico de 8 dígitos)',
      );
    }

    const ref = await this.referenceCodeRepo.findOne({
      where: {
        code,
        customer: { id: clientId },
        estatus: 1,
      },
    });
    if (!ref) {
      throw new NotFoundException(
        'Código de referencia no encontrado o no vigente para este cliente',
      );
    }
    return ref.id;
  }

  private async resolveBalanceHistory(
    clientId: number,
    idHistoryBalance: number,
  ): Promise<BalanceHistory> {
    if (!Number.isInteger(idHistoryBalance) || idHistoryBalance < 1) {
      throw new BadRequestException('IdHistoryBalance inválido');
    }

    const history = await this.balanceHistoryRepo.findOne({
      where: { id: idHistoryBalance, customer: { id: clientId } },
      relations: { customer: true },
    });
    if (!history) {
      throw new NotFoundException(
        'BalanceHistory no encontrado para este cliente',
      );
    }
    return history;
  }

  async register(
    clientId: number,
    idHistoryBalance: number,
    code: string,
    voucher: Express.Multer.File,
  ) {
    if (!clientId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    if (!code?.trim()) {
      throw new BadRequestException('Code es obligatorio');
    }
    if (!voucher) {
      throw new BadRequestException('El comprobante (voucher) es obligatorio');
    }

    const [referenceCodeId, balanceHistory] = await Promise.all([
      this.resolveReferenceCodeId(clientId, code),
      this.resolveBalanceHistory(clientId, idHistoryBalance),
    ]);

    const { url } = await this.s3Service.uploadFile(
      voucher,
      S3_VOUCHERS_FOLDER,
    );

    const row = this.creditPaymentRepo.create({
      balanceHistory,
      referenceCode: { id: referenceCodeId } as ReferenceCode,
      voucher: url,
    });
    const saved = await this.creditPaymentRepo.save(row);

    return {
      id: saved.id,
      idHistoryBalance: balanceHistory.id,
      idReferenceCode: referenceCodeId,
      code: code.trim(),
      voucher: saved.voucher,
      createdAt: saved.createdAt,
    };
  }
}
