import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class ResolveDto {
  @ApiProperty({ description: "UUID of the winning outcome" })
  @IsUUID()
  winningOutcomeId: string;
}
