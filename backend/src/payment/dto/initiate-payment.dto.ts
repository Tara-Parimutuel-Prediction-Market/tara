import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsNumber,
  IsOptional,
  IsUUID,
} from "class-validator";

export class InitiatePaymentDto {
  @ApiProperty({
    description: "Payment description",
    example: "Tara Credits top-up",
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  description: string;

  @ApiProperty({ description: "Amount in BTN", example: 100 })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: "Customer CID linked to DK Bank account",
    example: "11000000000",
  })
  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @ApiProperty({
    description: "Market ID to link this payment to (optional)",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  marketId?: string;

  @ApiProperty({
    description: "Dispute ID to link this payment to (optional)",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  disputeId?: string;
}
