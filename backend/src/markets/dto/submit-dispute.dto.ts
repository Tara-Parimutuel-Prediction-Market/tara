import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsNumber, IsPositive, IsUUID, IsString } from "class-validator";

export class SubmitDisputeDto {
  @ApiPropertyOptional({
    description: "Bond amount in credits (used when paying from credit balance)",
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  bondAmount?: number;

  @ApiPropertyOptional({
    description: "Completed DK Bank payment ID to use as bond",
  })
  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @ApiPropertyOptional({
    description: "Reason for disputing the proposed outcome",
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
