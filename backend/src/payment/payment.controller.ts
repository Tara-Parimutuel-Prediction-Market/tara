import { Controller, Post, Body, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly configService: ConfigService) {}

  // DTO for DK Bank payment initiation
  @Post('dkbank/initiate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate DK Bank payment' })
  @ApiResponse({ status: 200, description: 'Payment initiated successfully' })
  async initiateDKBankPayment(@Body() paymentData: { amount: number; customerPhone: string; description: string }) {
    // Validate required fields
    if (!paymentData || !paymentData.amount) {
      throw new Error('Amount is required for DK Bank payment');
    }

    console.log('🏦 DK Bank Payment Request:', paymentData);
    
    // Mock response for now - replace with actual DK Bank API call
    return {
      success: true,
      paymentId: `DKBANK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      amount: paymentData.amount,
      currency: 'BTN',
      method: 'dkbank',
      message: 'Payment initiated. Please complete in your DK Bank app.',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('dkbank/status/:paymentId')
  @ApiOperation({ summary: 'Check DK Bank payment status' })
  @ApiResponse({ status: 200, description: 'Payment status retrieved' })
  async checkDKBankPaymentStatus(@Param('paymentId') paymentId: string) {
    // TODO: Implement actual status check with DK Bank
    console.log('🏦 Checking DK Bank payment status:', paymentId);
    
    // Mock response for now - replace with actual DK Bank status check
    return {
      paymentId,
      status: 'success', // pending | success | failed
      amount: 100, // Mock amount
      currency: 'BTN',
      method: 'dkbank',
      confirmedAt: new Date().toISOString(),
      message: 'Payment completed successfully',
    };
  }

  @Get('methods')
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
          currency: 'TON',
          enabled: true,
          minAmount: 0.5,
          maxAmount: 100,
          icon: '💎',
        },
        // {
        //   id: 'credits',
        //   name: 'Test Credits',
        //   type: 'credits',
        //   currency: 'CREDITS',
        //   enabled: true,
        //   minAmount: 1,
        //   icon: '🪙',
        // },
      ],
    };
  }

  @Get('config')
  @ApiOperation({ summary: 'Get payment configuration' })
  @ApiResponse({ status: 200, description: 'Payment configuration' })
  async getPaymentConfig() {
    return {
      dkBank: {
        baseUrl: this.configService.get('DK_BASE_URL'),
        isStaging: this.configService.get('DK_BASE_URL')?.includes('sit') || false,
        beneficiaryAccount: this.configService.get('DK_BENEFICIARY_ACCOUNT'),
        bankCode: this.configService.get('DK_BANK_CODE'),
      },
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
