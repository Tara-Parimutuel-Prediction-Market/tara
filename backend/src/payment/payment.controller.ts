import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  HttpException,
  Request,
  UseGuards,
  Headers,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards';
import { DKBankPaymentService } from './dkbank-payment.service';
import { DKGatewayService } from './services/dk-gateway/dk-gateway.service';
import { RedisService } from '../redis/redis.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { ClientInquiryDto } from './dto/client-inquiry.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly configService: ConfigService,
    private readonly dkBankPaymentService: DKBankPaymentService,
    private readonly dkGatewayService: DKGatewayService,
    private readonly redis: RedisService,
  ) {}

  private async enforceRateLimit(key: string, max: number, windowSec: number): Promise<void> {
    const { allowed } = await this.redis.rateLimit(key, max, windowSec);
    if (!allowed) {
      throw new HttpException(
        `Too many requests. Max ${max} per ${windowSec}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  @Post('dkbank/initiate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 1: Initiate DK Bank payment (sends OTP to customer phone)' })
  @ApiBody({ type: InitiatePaymentDto })
  @ApiResponse({ status: 200, description: 'Payment initiated — OTP sent to customer' })
  async initiateDKBankPayment(@Body() paymentData: InitiatePaymentDto, @Request() req: any) {
    // 5 payment initiations per minute per user
    await this.enforceRateLimit(`payment:initiate:${req.user.userId}`, 5, 60);
    return this.dkBankPaymentService.initiatePayment(req.user.userId, {
      amount: paymentData.amount,
      customerPhone: paymentData.customerPhone,
      description: paymentData.description,
      marketId: paymentData.marketId,
      disputeId: paymentData.disputeId,
    });
  }

  @Post('dkbank/confirm')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2: Confirm DK Bank payment with OTP' })
  @ApiBody({ type: ConfirmPaymentDto })
  @ApiResponse({ status: 200, description: 'Payment submitted to DK Bank' })
  async confirmDKBankPayment(@Body() dto: ConfirmPaymentDto, @Request() req: any) {
    // 5 OTP confirmation attempts per 15 minutes per user
    await this.enforceRateLimit(`payment:confirm:${req.user.userId}`, 5, 900);
    return this.dkBankPaymentService.confirmPayment(req.user.userId, dto.paymentId, dto.otp);
  }

  @Post('dkbank/account-inquiry')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Look up DK Bank account by CID — returns account number, name, and phone' })
  @ApiBody({ type: ClientInquiryDto })
  @ApiResponse({ status: 200, description: 'Account found', schema: { example: { accountNumber: '1234567890', accountName: 'Sonam Tenzin', phoneNumber: '17123456' } } })
  async dkAccountInquiry(@Body() dto: ClientInquiryDto) {
    if (!dto?.id_number || dto.id_number.length < 11) {
      throw new BadRequestException('id_number must be 11 digits');
    }
    return this.dkGatewayService.lookupAccountByCID(dto.id_number);
  }

  // Public endpoint (no JWT) - aligned to CLIENT_INQUIRY_API.md
  @Post("client-inquiry")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "DK client inquiry by CID" })
  @ApiBody({ type: ClientInquiryDto })
  async clientInquiry(@Body() dto: ClientInquiryDto, @Request() req: any) {
    if (!dto?.id_type || dto.id_type !== "CID") {
      throw new BadRequestException(`id_type must be "CID"`);
    }
    if (!dto?.id_number || dto.id_number.length < 11) {
      throw new BadRequestException(`id_number must be 11 digits`);
    }
    // 3 CID lookups per minute per IP — public endpoint, keep tight
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    await this.enforceRateLimit(`client-inquiry:${ip}`, 3, 60);

    return this.dkGatewayService.clientInquiry(dto);
  }

  @Get("dkbank/status/:paymentId")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Check DK Bank payment status" })
  async checkDKBankPaymentStatusOwned(
    @Param("paymentId") paymentId: string,
    @Request() req: any,
  ) {
    return this.dkBankPaymentService.getPaymentStatus(req.user.userId, paymentId);
  }

  // DK webhook/callback endpoint (no user JWT required)
  @Post("dkbank/webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "DK Bank webhook: update payment status" })
  async dkBankWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    const signature =
      headers["x-dk-signature"] ||
      headers["dk-signature"] ||
      headers["x-dk-signature-v1"];
    return this.dkBankPaymentService.handleWebhook(payload, signature);
  }

  // Backward-compatible alias
  @Post("dkbank/callback")
  @HttpCode(HttpStatus.OK)
  async dkBankCallback(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    const signature =
      headers["x-dk-signature"] ||
      headers["dk-signature"] ||
      headers["x-dk-signature-v1"];
    return this.dkBankPaymentService.handleWebhook(payload, signature);
  }

  @Get('methods')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get available payment methods' })
  @ApiResponse({ status: 200, description: 'Available payment methods' })
  async getPaymentMethods() {
    return {
      methods: [
        {
          id: 'dkbank',
          name: 'DK Bank',
          type: 'dkbank',
          currency: 'BTN',
          enabled: true,
          minAmount: 50,
          maxAmount: 10000,
          icon: '🏦',
        },
        {
          id: 'ton',
          name: 'TON Wallet',
          type: 'ton',
          currency: 'USDT',
          enabled: true,
          minAmount: 0.5,
          maxAmount: 100,
          icon: '💎',
        },
        {
          id: 'credits',
          name: 'Tara Credits',
          type: 'credits',
          currency: 'CREDITS',
          enabled: true,
          minAmount: 1,
          icon: '🪙',
        },
      ],
    };
  }

  @Get('config')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get payment configuration' })
  @ApiResponse({ status: 200, description: 'Payment configuration' })
  async getPaymentConfig() {
    const baseUrl = this.configService.get("DK_BASE_URL") || "";
    return {
      dkBank: {
        // Public/non-secret flags only; do not leak DK internal endpoints/beneficiary identifiers.
        isStaging: baseUrl.includes("sit"),
      },
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
